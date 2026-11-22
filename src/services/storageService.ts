import {
  mergeHabitsStore,
  mergeRecentReadsStore,
  mergeTasksStore,
  normalizeHabitsStore,
  normalizeRecentReadsStore,
  normalizeSettings,
  normalizeTasksStore,
  validateBackupBundle,
} from '../domain/storeMerge';
import type {
  BackupBundle,
  HabitsStore,
  PluginSettings,
  RecentReadsStore,
  TasksStore,
} from '../domain/types';

export const STORAGE_FILES = {
  settings: 'settings.json',
  tasks: 'tasks.json',
  habits: 'habits.json',
  recentReads: 'recent-reads.json',
} as const;

export interface PluginDataAdapter {
  loadData(name: string): Promise<unknown>;
  saveData(name: string, data: unknown): Promise<void>;
}

function parseRawIfNeeded(raw: unknown): unknown {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return raw; // Let normalizer detect corrupt string
    }
  }
  return raw;
}

export class StorageService {
  private readonly queues = new Map<string, Promise<unknown>>();
  private tasksBaseline: TasksStore | null = null;
  private habitsBaseline: HabitsStore | null = null;
  private recentReadsBaseline: RecentReadsStore | null = null;

  constructor(private readonly adapter: PluginDataAdapter) {}

  private enqueue<T>(fileName: string, work: () => Promise<T>): Promise<T> {
    const prev = this.queues.get(fileName) ?? Promise.resolve();
    const next = prev.then(work, work);
    this.queues.set(
      fileName,
      next.catch(() => undefined),
    );
    return next;
  }

  async loadSettings(): Promise<PluginSettings> {
    const raw = parseRawIfNeeded(await this.adapter.loadData(STORAGE_FILES.settings));
    return normalizeSettings(raw);
  }

  async saveSettings(next: PluginSettings): Promise<PluginSettings> {
    return this.enqueue(STORAGE_FILES.settings, async () => {
      const normalized = normalizeSettings(next);
      await this.adapter.saveData(STORAGE_FILES.settings, normalized);
      return normalized;
    });
  }

  async updateSettings(updater: (curr: PluginSettings) => PluginSettings): Promise<PluginSettings> {
    return this.enqueue(STORAGE_FILES.settings, async () => {
      const rawDisk = parseRawIfNeeded(await this.adapter.loadData(STORAGE_FILES.settings));
      const disk = normalizeSettings(rawDisk);
      const next = normalizeSettings(updater(structuredClone(disk)));
      await this.adapter.saveData(STORAGE_FILES.settings, next);
      return next;
    });
  }

  async loadTasks(): Promise<TasksStore> {
    const raw = parseRawIfNeeded(await this.adapter.loadData(STORAGE_FILES.tasks));
    const store = normalizeTasksStore(raw);
    this.tasksBaseline = structuredClone(store);
    return store;
  }

  async updateTasks(updater: (curr: TasksStore) => TasksStore): Promise<TasksStore> {
    return this.enqueue(STORAGE_FILES.tasks, async () => {
      const now = Date.now();
      const rawDisk = parseRawIfNeeded(await this.adapter.loadData(STORAGE_FILES.tasks));
      const disk = normalizeTasksStore(rawDisk);
      const base = this.tasksBaseline ? mergeTasksStore(this.tasksBaseline, disk, now) : disk;
      const updated = normalizeTasksStore(updater(structuredClone(base)));
      const merged = mergeTasksStore(updated, disk, now);
      await this.adapter.saveData(STORAGE_FILES.tasks, merged);
      this.tasksBaseline = structuredClone(merged);
      return merged;
    });
  }

  async loadHabits(): Promise<HabitsStore> {
    const raw = parseRawIfNeeded(await this.adapter.loadData(STORAGE_FILES.habits));
    const store = normalizeHabitsStore(raw);
    this.habitsBaseline = structuredClone(store);
    return store;
  }

  async updateHabits(updater: (curr: HabitsStore) => HabitsStore): Promise<HabitsStore> {
    return this.enqueue(STORAGE_FILES.habits, async () => {
      const now = Date.now();
      const rawDisk = parseRawIfNeeded(await this.adapter.loadData(STORAGE_FILES.habits));
      const disk = normalizeHabitsStore(rawDisk);
      const base = this.habitsBaseline ? mergeHabitsStore(this.habitsBaseline, disk, now) : disk;
      const updated = normalizeHabitsStore(updater(structuredClone(base)));
      const merged = mergeHabitsStore(updated, disk, now);
      await this.adapter.saveData(STORAGE_FILES.habits, merged);
      this.habitsBaseline = structuredClone(merged);
      return merged;
    });
  }

  async loadRecentReads(): Promise<RecentReadsStore> {
    const raw = parseRawIfNeeded(await this.adapter.loadData(STORAGE_FILES.recentReads));
    const store = normalizeRecentReadsStore(raw);
    this.recentReadsBaseline = structuredClone(store);
    return store;
  }

  async saveRecentRead(docId: string, nowMs = Date.now()): Promise<RecentReadsStore> {
    return this.enqueue(STORAGE_FILES.recentReads, async () => {
      const rawDisk = parseRawIfNeeded(await this.adapter.loadData(STORAGE_FILES.recentReads));
      const disk = normalizeRecentReadsStore(rawDisk);
      const base = this.recentReadsBaseline
        ? mergeRecentReadsStore(this.recentReadsBaseline, disk, 100)
        : disk;

      const existing = base.records.find((r) => r.docId === docId);
      const nextRecords = [
        {
          docId,
          lastReadAt: nowMs,
          readCount: (existing?.readCount ?? 0) + 1,
        },
        ...base.records.filter((r) => r.docId !== docId),
      ].slice(0, 100);

      const nextStore: RecentReadsStore = { version: 1, records: nextRecords };
      await this.adapter.saveData(STORAGE_FILES.recentReads, nextStore);
      this.recentReadsBaseline = structuredClone(nextStore);
      return nextStore;
    });
  }

  async pruneRecentReads(deadIds: Set<string>): Promise<RecentReadsStore> {
    if (deadIds.size === 0) {
      return this.loadRecentReads();
    }
    return this.enqueue(STORAGE_FILES.recentReads, async () => {
      const rawDisk = parseRawIfNeeded(await this.adapter.loadData(STORAGE_FILES.recentReads));
      const disk = normalizeRecentReadsStore(rawDisk);
      const filtered: RecentReadsStore = {
        version: 1,
        records: disk.records.filter((r) => !deadIds.has(r.docId)),
      };
      if (filtered.records.length !== disk.records.length) {
        await this.adapter.saveData(STORAGE_FILES.recentReads, filtered);
      }
      this.recentReadsBaseline = structuredClone(filtered);
      return filtered;
    });
  }

  async exportAllData(): Promise<BackupBundle> {
    const [settings, tasks, habits, recentReads] = await Promise.all([
      this.loadSettings(),
      this.loadTasks(),
      this.loadHabits(),
      this.loadRecentReads(),
    ]);
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      plugin: 'siyuan-personal-home',
      settings,
      tasks,
      habits,
      recentReads,
    };
  }

  async importAllData(raw: unknown): Promise<void> {
    const bundle = validateBackupBundle(raw);
    await Promise.all([
      this.enqueue(STORAGE_FILES.settings, () =>
        this.adapter.saveData(STORAGE_FILES.settings, bundle.settings),
      ),
      this.enqueue(STORAGE_FILES.tasks, async () => {
        await this.adapter.saveData(STORAGE_FILES.tasks, bundle.tasks);
        this.tasksBaseline = structuredClone(bundle.tasks);
      }),
      this.enqueue(STORAGE_FILES.habits, async () => {
        await this.adapter.saveData(STORAGE_FILES.habits, bundle.habits);
        this.habitsBaseline = structuredClone(bundle.habits);
      }),
      this.enqueue(STORAGE_FILES.recentReads, async () => {
        await this.adapter.saveData(STORAGE_FILES.recentReads, bundle.recentReads);
        this.recentReadsBaseline = structuredClone(bundle.recentReads);
      }),
    ]);
  }
}
