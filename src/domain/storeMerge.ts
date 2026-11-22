import {
  DEFAULT_SETTINGS,
  DEFAULT_TASK_CATEGORIES,
  type BackupBundle,
  type HabitCheckin,
  type HabitsStore,
  type PluginSettings,
  type RecentReadRecord,
  type RecentReadsStore,
  type TasksStore,
} from './types';

export const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface VersionedEntity {
  id: string;
  updatedAt: number;
  deleted?: boolean;
}

function mergeEntities<T extends VersionedEntity>(local: T[], disk: T[], nowMs: number): T[] {
  const byId = new Map<string, T>();
  for (const item of disk) {
    byId.set(item.id, item);
  }
  for (const item of local) {
    const existing = byId.get(item.id);
    if (!existing || item.updatedAt >= existing.updatedAt) {
      byId.set(item.id, item);
    }
  }
  return Array.from(byId.values()).filter(
    (item) => !(item.deleted && nowMs - item.updatedAt > TOMBSTONE_TTL_MS),
  );
}

export function mergeTasksStore(local: TasksStore, disk: TasksStore, nowMs: number): TasksStore {
  return {
    version: 1,
    categories: mergeEntities(local.categories, disk.categories, nowMs),
    tasks: mergeEntities(local.tasks, disk.tasks, nowMs),
  };
}

export function mergeHabitsStore(
  local: HabitsStore,
  disk: HabitsStore,
  nowMs: number,
): HabitsStore {
  const habits = mergeEntities(local.habits, disk.habits, nowMs);
  const allHabitIds = new Set<string>([
    ...Object.keys(disk.checkins ?? {}),
    ...Object.keys(local.checkins ?? {}),
  ]);

  const mergedCheckins: Record<string, Record<string, HabitCheckin>> = {};
  for (const habitId of allHabitIds) {
    const diskMap = disk.checkins?.[habitId] ?? {};
    const localMap = local.checkins?.[habitId] ?? {};
    const dateKeys = new Set([...Object.keys(diskMap), ...Object.keys(localMap)]);
    const out: Record<string, HabitCheckin> = {};
    for (const date of dateKeys) {
      const dEntry = diskMap[date];
      const lEntry = localMap[date];
      if (!dEntry && lEntry) {
        out[date] = lEntry;
      } else if (dEntry && !lEntry) {
        out[date] = dEntry;
      } else if (dEntry && lEntry) {
        out[date] = lEntry.updatedAt >= dEntry.updatedAt ? lEntry : dEntry;
      }
    }
    mergedCheckins[habitId] = out;
  }

  return {
    version: 1,
    habits,
    checkins: mergedCheckins,
  };
}

export function mergeRecentReadsStore(
  local: RecentReadsStore,
  disk: RecentReadsStore,
  maxItems = 100,
): RecentReadsStore {
  const byDoc = new Map<string, RecentReadRecord>();
  for (const r of [...disk.records, ...local.records]) {
    const prev = byDoc.get(r.docId);
    if (!prev) {
      byDoc.set(r.docId, { ...r });
    } else {
      byDoc.set(r.docId, {
        docId: r.docId,
        lastReadAt: Math.max(prev.lastReadAt, r.lastReadAt),
        readCount: Math.max(prev.readCount, r.readCount),
      });
    }
  }
  const records = Array.from(byDoc.values())
    .sort((a, b) => b.lastReadAt - a.lastReadAt)
    .slice(0, maxItems);
  return { version: 1, records };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function normalizeSettings(raw: unknown): PluginSettings {
  if (raw == null) return { ...DEFAULT_SETTINGS };
  if (!isPlainObject(raw)) {
    throw new Error('settings.json 数据格式损坏（非 JSON 对象）');
  }
  return {
    ...DEFAULT_SETTINGS,
    ...(raw as Partial<PluginSettings>),
    version: 1,
  };
}

export function normalizeTasksStore(raw: unknown): TasksStore {
  if (raw == null) {
    return {
      version: 1,
      categories: DEFAULT_TASK_CATEGORIES.map((c) => ({ ...c })),
      tasks: [],
    };
  }
  if (!isPlainObject(raw) || !Array.isArray(raw.tasks) || !Array.isArray(raw.categories)) {
    throw new Error('tasks.json 数据格式损坏，已拒绝覆盖原文件');
  }
  return {
    version: 1,
    categories: raw.categories.length > 0
      ? raw.categories
      : DEFAULT_TASK_CATEGORIES.map((c) => ({ ...c })),
    tasks: raw.tasks,
  };
}

export function normalizeHabitsStore(raw: unknown): HabitsStore {
  if (raw == null) {
    return { version: 1, habits: [], checkins: {} };
  }
  if (!isPlainObject(raw) || !Array.isArray(raw.habits) || !isPlainObject(raw.checkins)) {
    throw new Error('habits.json 数据格式损坏，已拒绝覆盖原文件');
  }
  return {
    version: 1,
    habits: raw.habits,
    checkins: raw.checkins as Record<string, Record<string, HabitCheckin>>,
  };
}

export function normalizeRecentReadsStore(raw: unknown): RecentReadsStore {
  if (raw == null) {
    return { version: 1, records: [] };
  }
  if (!isPlainObject(raw) || !Array.isArray(raw.records)) {
    throw new Error('recent-reads.json 数据格式损坏，已拒绝覆盖原文件');
  }
  return {
    version: 1,
    records: raw.records,
  };
}

export function validateBackupBundle(raw: unknown): BackupBundle {
  if (!isPlainObject(raw)) {
    throw new Error('备份文件不是有效的 JSON 对象');
  }
  if (raw.version !== 1 || raw.plugin !== 'siyuan-personal-home') {
    throw new Error('备份文件版本或插件标识不匹配');
  }
  if (!isPlainObject(raw.settings) || !isPlainObject(raw.tasks) || !isPlainObject(raw.habits)) {
    throw new Error('备份文件缺少必要的数据段（settings / tasks / habits）');
  }
  const settings = normalizeSettings(raw.settings);
  const tasks = normalizeTasksStore(raw.tasks);
  const habits = normalizeHabitsStore(raw.habits);
  const recentReads = normalizeRecentReadsStore(raw.recentReads ?? { version: 1, records: [] });

  return {
    version: 1,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(),
    plugin: 'siyuan-personal-home',
    settings,
    tasks,
    habits,
    recentReads,
  };
}
