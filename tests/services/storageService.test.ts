import { describe, expect, it } from 'vitest';
import { StorageService, type PluginDataAdapter } from '../../src/services/storageService';
import type { HabitsStore, TasksStore } from '../../src/domain/types';

function createMemoryAdapter() {
  const files = new Map<string, unknown>();
  const adapter: PluginDataAdapter = {
    async loadData(name: string) {
      const val = files.get(name);
      return val === undefined ? null : structuredClone(val);
    },
    async saveData(name: string, data: unknown) {
      files.set(name, structuredClone(data));
    },
  };
  return { adapter, files };
}

describe('StorageService', () => {
  it('serializes concurrent task updates without dropping any writes', async () => {
    const { adapter } = createMemoryAdapter();
    const storage = new StorageService(adapter);

    await Promise.all(
      [1, 2, 3, 4, 5].map((n) =>
        storage.updateTasks((curr) => ({
          ...curr,
          tasks: [
            ...curr.tasks,
            {
              id: `t-${n}`,
              title: `任务 ${n}`,
              priority: 'medium',
              categoryId: 'cat-work',
              completed: false,
              createdAt: n * 10,
              updatedAt: n * 10,
              sortOrder: n,
            },
          ],
        })),
      ),
    );

    const loaded = await storage.loadTasks();
    expect(loaded.tasks).toHaveLength(5);
  });

  it('merges disk changes from external sync before writing habit updates', async () => {
    const { adapter, files } = createMemoryAdapter();
    const storage = new StorageService(adapter);

    // Initial habit saved locally
    await storage.updateHabits((curr) => ({
      ...curr,
      habits: [
        {
          id: 'h1',
          name: '冥想',
          icon: '🧘',
          color: '#10b981',
          frequencyType: 'daily',
          weeklyTarget: 7,
          trackDuration: false,
          createdAt: '2026-11-01',
          archived: false,
          sortOrder: 0,
          updatedAt: 100,
        },
      ],
    }));

    // Simulate another device syncing a 2026-11-20 checkin straight to disk
    const diskSnapshot = structuredClone(files.get('habits.json')) as HabitsStore;
    diskSnapshot.checkins.h1 = {
      '2026-11-20': { done: true, checkedAt: 500, updatedAt: 500 },
    };
    files.set('habits.json', diskSnapshot);

    // Local tab checks in 2026-11-22 without reloading first
    await storage.updateHabits((curr) => ({
      ...curr,
      checkins: {
        ...curr.checkins,
        h1: {
          ...(curr.checkins.h1 ?? {}),
          '2026-11-22': { done: true, checkedAt: 900, updatedAt: 900 },
        },
      },
    }));

    const finalOnDisk = files.get('habits.json') as HabitsStore;
    expect(finalOnDisk.checkins.h1['2026-11-20'].done).toBe(true);
    expect(finalOnDisk.checkins.h1['2026-11-22'].done).toBe(true);
  });

  it('refuses to overwrite corrupt JSON on disk during load/update', async () => {
    const { adapter, files } = createMemoryAdapter();
    files.set('tasks.json', 'CORRUPT_RAW_STRING_NOT_OBJECT');
    const storage = new StorageService(adapter);

    await expect(storage.loadTasks()).rejects.toThrow(/损坏|corrupt/i);
    expect(files.get('tasks.json')).toBe('CORRUPT_RAW_STRING_NOT_OBJECT');
  });

  it('exports and restores full backup bundle cleanly', async () => {
    const { adapter } = createMemoryAdapter();
    const storage = new StorageService(adapter);

    await storage.updateTasks((curr: TasksStore) => ({
      ...curr,
      tasks: [
        {
          id: 't-export',
          title: '导出测试',
          priority: 'high',
          categoryId: 'cat-work',
          completed: false,
          createdAt: 100,
          updatedAt: 100,
          sortOrder: 0,
        },
      ],
    }));
    await storage.saveRecentRead('doc-abc', 2000);

    const bundle = await storage.exportAllData();
    const { adapter: adapter2 } = createMemoryAdapter();
    const storage2 = new StorageService(adapter2);
    await storage2.importAllData(bundle);

    const restoredTasks = await storage2.loadTasks();
    const restoredReads = await storage2.loadRecentReads();
    expect(restoredTasks.tasks[0].title).toBe('导出测试');
    expect(restoredReads.records[0].docId).toBe('doc-abc');
  });

  it('pruneRecentReads removes only explicit deadIds without wiping concurrent disk additions', async () => {
    const { adapter, files } = createMemoryAdapter();
    const storage = new StorageService(adapter);

    await storage.saveRecentRead('doc-alive', 1000);
    await storage.saveRecentRead('doc-dead', 2000);

    // Concurrent write from another device/tracker lands on disk after snapshot
    const disk = structuredClone(files.get('recent-reads.json')) as {
      version: 1;
      records: Array<{ docId: string; lastReadAt: number; readCount: number }>;
    };
    disk.records.unshift({ docId: 'doc-concurrent-new', lastReadAt: 3000, readCount: 1 });
    files.set('recent-reads.json', disk);

    const pruned = await storage.pruneRecentReads(new Set(['doc-dead']));
    expect(pruned.records.map((r) => r.docId)).toEqual(['doc-concurrent-new', 'doc-alive']);
  });

  it('serializes updateSettings without losing concurrent patches', async () => {
    const { adapter } = createMemoryAdapter();
    const storage = new StorageService(adapter);

    await Promise.all([
      storage.updateSettings((s) => ({ ...s, showHeatmap: false })),
      storage.updateSettings((s) => ({ ...s, diaryNotebookId: 'nb-sync' })),
    ]);

    const finalSettings = await storage.loadSettings();
    expect(finalSettings.showHeatmap).toBe(false);
    expect(finalSettings.diaryNotebookId).toBe('nb-sync');
  });
});
