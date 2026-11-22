import { describe, expect, it } from 'vitest';
import {
  TOMBSTONE_TTL_MS,
  mergeHabitsStore,
  mergeRecentReadsStore,
  mergeTasksStore,
  validateBackupBundle,
} from '../../src/domain/storeMerge';
import {
  DEFAULT_SETTINGS,
  DEFAULT_TASK_CATEGORIES,
  type HabitsStore,
  type TasksStore,
} from '../../src/domain/types';

describe('storeMerge', () => {
  it('merges tasks per record by updatedAt, respects tombstones, and GCs tombstones older than 30 days', () => {
    const now = 100 * 86_400_000;
    const local: TasksStore = {
      version: 1,
      categories: DEFAULT_TASK_CATEGORIES,
      tasks: [
        {
          id: 't1',
          title: '本地新版',
          priority: 'high',
          categoryId: 'cat-work',
          completed: false,
          createdAt: 100,
          updatedAt: 500,
          sortOrder: 0,
        },
        {
          id: 't2',
          title: '远端已删但本地较旧',
          priority: 'low',
          categoryId: 'cat-work',
          completed: false,
          createdAt: 100,
          updatedAt: now - 5000,
          sortOrder: 1,
        },
        {
          id: 't-old-deleted',
          title: '31天前删除',
          priority: 'low',
          categoryId: 'cat-work',
          completed: false,
          createdAt: 10,
          updatedAt: now - TOMBSTONE_TTL_MS - 1000,
          deleted: true,
          sortOrder: 2,
        },
      ],
    };

    const disk: TasksStore = {
      version: 1,
      categories: DEFAULT_TASK_CATEGORIES,
      tasks: [
        {
          id: 't1',
          title: '磁盘旧版',
          priority: 'low',
          categoryId: 'cat-work',
          completed: false,
          createdAt: 100,
          updatedAt: 300,
          sortOrder: 0,
        },
        {
          id: 't2',
          title: '远端已删但本地较旧',
          priority: 'low',
          categoryId: 'cat-work',
          completed: false,
          createdAt: 100,
          updatedAt: now - 1000,
          deleted: true,
          sortOrder: 1,
        },
        {
          id: 't3',
          title: '远端新增任务',
          priority: 'medium',
          categoryId: 'cat-study',
          completed: false,
          createdAt: 600,
          updatedAt: 600,
          sortOrder: 2,
        },
      ],
    };

    const merged = mergeTasksStore(local, disk, now);
    const byId = new Map(merged.tasks.map((t) => [t.id, t]));
    expect(byId.get('t1')?.title).toBe('本地新版');
    expect(byId.get('t2')?.deleted).toBe(true);
    expect(byId.get('t3')?.title).toBe('远端新增任务');
    expect(byId.has('t-old-deleted')).toBe(false);
  });

  it('merges habits and per-day checkins without clobbering unrelated dates', () => {
    const now = 50 * 86_400_000;
    const baseHabit = {
      id: 'h1',
      name: '阅读',
      icon: '📖',
      color: '#3b82f6',
      frequencyType: 'daily' as const,
      weeklyTarget: 7,
      trackDuration: true,
      defaultDurationMinutes: 30,
      createdAt: '2026-11-01',
      archived: false,
      sortOrder: 0,
      updatedAt: 100,
    };

    const local: HabitsStore = {
      version: 1,
      habits: [baseHabit],
      checkins: {
        h1: {
          '2026-11-21': { done: true, durationMinutes: 30, checkedAt: 500, updatedAt: 500 },
        },
      },
    };
    const disk: HabitsStore = {
      version: 1,
      habits: [{ ...baseHabit, name: '每日深度阅读', updatedAt: 900 }],
      checkins: {
        h1: {
          '2026-11-20': { done: true, durationMinutes: 45, checkedAt: 400, updatedAt: 400 },
          '2026-11-21': { done: false, checkedAt: 300, updatedAt: 300 },
        },
      },
    };

    const merged = mergeHabitsStore(local, disk, now);
    expect(merged.habits[0].name).toBe('每日深度阅读');
    expect(merged.checkins.h1['2026-11-20'].durationMinutes).toBe(45);
    expect(merged.checkins.h1['2026-11-21'].done).toBe(true);
  });

  it('merges recent reads by latest timestamp and caps at maxItems', () => {
    const merged = mergeRecentReadsStore(
      { version: 1, records: [{ docId: 'a', lastReadAt: 200, readCount: 2 }] },
      {
        version: 1,
        records: [
          { docId: 'a', lastReadAt: 100, readCount: 3 },
          { docId: 'b', lastReadAt: 300, readCount: 1 },
        ],
      },
      2,
    );
    expect(merged.records.map((r) => r.docId)).toEqual(['b', 'a']);
    expect(merged.records[1].readCount).toBe(3);
  });

  it('validates backup bundle and rejects malformed payloads', () => {
    expect(() => validateBackupBundle(null)).toThrow();
    expect(() => validateBackupBundle({ version: 2, plugin: 'siyuan-personal-home' })).toThrow();
    expect(() =>
      validateBackupBundle({ version: 1, plugin: 'other', settings: DEFAULT_SETTINGS }),
    ).toThrow();

    const valid = validateBackupBundle({
      version: 1,
      exportedAt: '2026-11-22T00:00:00.000Z',
      plugin: 'siyuan-personal-home',
      settings: DEFAULT_SETTINGS,
      tasks: { version: 1, categories: DEFAULT_TASK_CATEGORIES, tasks: [] },
      habits: { version: 1, habits: [], checkins: {} },
      recentReads: { version: 1, records: [] },
    });
    expect(valid.plugin).toBe('siyuan-personal-home');

    // Rejects malformed elements inside arrays
    expect(() =>
      validateBackupBundle({
        version: 1,
        exportedAt: '2026-11-22T00:00:00.000Z',
        plugin: 'siyuan-personal-home',
        settings: DEFAULT_SETTINGS,
        tasks: { version: 1, categories: DEFAULT_TASK_CATEGORIES, tasks: [null] },
        habits: { version: 1, habits: [], checkins: {} },
        recentReads: { version: 1, records: [] },
      }),
    ).toThrow();
  });

  it('prunes orphaned checkins when a deleted habit tombstone is garbage collected', () => {
    const now = 100 * 86_400_000;
    const oldDeletedHabit = {
      id: 'h-gc',
      name: '旧习惯',
      icon: '✨',
      color: '#3b82f6',
      frequencyType: 'daily' as const,
      weeklyTarget: 7,
      trackDuration: false,
      createdAt: '2026-01-01',
      archived: false,
      deleted: true,
      sortOrder: 0,
      updatedAt: now - TOMBSTONE_TTL_MS - 1000,
    };
    const store: HabitsStore = {
      version: 1,
      habits: [oldDeletedHabit],
      checkins: {
        'h-gc': { '2026-01-02': { done: true, checkedAt: 1, updatedAt: 1 } },
      },
    };
    const merged = mergeHabitsStore(store, store, now);
    expect(merged.habits).toHaveLength(0);
    expect(merged.checkins['h-gc']).toBeUndefined();
  });
});
