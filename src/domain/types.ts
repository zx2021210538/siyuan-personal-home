export type WeekStartDay = 0 | 1; // 0 = Sunday, 1 = Monday
export type TopBarPosition = 'left' | 'right';
export type RecentTabKey = 'modified' | 'read';
export type HomeSubTab = 'overview' | 'notes' | 'journal' | 'plan';

export interface PluginSettings {
  version: 1;
  topBarPosition: TopBarPosition;
  autoOpenOnStart: boolean;
  weekStartDay: WeekStartDay;
  showHeatmap: boolean;
  showDiaryTodoBadge: boolean;
  useThemeAccent: boolean;
  followEditorFont: boolean;
  hideDailyNotesInRecent: boolean;
  recentTab: RecentTabKey;
  recentViewMode?: 'list' | 'grid';
  diaryNotebookId: string;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  version: 1,
  topBarPosition: 'left',
  autoOpenOnStart: true,
  weekStartDay: 1,
  showHeatmap: true,
  showDiaryTodoBadge: true,
  useThemeAccent: true,
  followEditorFont: true,
  hideDailyNotesInRecent: false,
  recentTab: 'modified',
  diaryNotebookId: '',
};

export type TaskPriority = 'high' | 'medium' | 'low';

export interface TaskCategory {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  updatedAt: number;
  deleted?: boolean;
}

export interface TaskItem {
  id: string;
  title: string;
  priority: TaskPriority;
  categoryId: string;
  completed: boolean;
  completedAt?: number;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
  sortOrder: number;
  linkedDocId?: string;
  linkedDocTitle?: string;
}

export interface TasksStore {
  version: 1;
  categories: TaskCategory[];
  tasks: TaskItem[];
}

export const DEFAULT_TASK_CATEGORIES: TaskCategory[] = [
  { id: 'cat-work', name: '工作', color: '#3b82f6', sortOrder: 0, updatedAt: 0 },
  { id: 'cat-study', name: '学习', color: '#8b5cf6', sortOrder: 1, updatedAt: 0 },
  { id: 'cat-life', name: '生活', color: '#10b981', sortOrder: 2, updatedAt: 0 },
  { id: 'cat-misc', name: '随手记', color: '#6b7280', sortOrder: 3, updatedAt: 0 },
];

export type HabitFrequencyType = 'daily' | 'weekly';

export interface HabitItem {
  id: string;
  name: string;
  icon: string;
  color: string;
  frequencyType: HabitFrequencyType;
  weeklyTarget: number;
  trackDuration: boolean;
  defaultDurationMinutes?: number;
  linkedDocId?: string;
  linkedDocTitle?: string;
  createdAt: string; // YYYY-MM-DD
  archived: boolean;
  deleted?: boolean;
  sortOrder: number;
  updatedAt: number;
}

export interface HabitCheckin {
  done: boolean;
  durationMinutes?: number;
  note?: string;
  checkedAt: number;
  updatedAt: number;
}

export interface HabitsStore {
  version: 1;
  habits: HabitItem[];
  checkins: Record<string, Record<string, HabitCheckin>>;
}

export interface RecentReadRecord {
  docId: string;
  lastReadAt: number;
  readCount: number;
}

export interface RecentReadsStore {
  version: 1;
  records: RecentReadRecord[];
}

export interface DocIconInfo {
  type: 'emoji' | 'image';
  value: string;
}

export interface DocPreviewItem {
  id: string;
  box: string;
  notebookName: string;
  hpath: string;
  title: string;
  icon: DocIconInfo | null;
  snippet: string;
  thumbnailUrl: string | null;
  tags: string[];
  updatedAtMs: number;
  readAtMs?: number;
  wordCount?: number;
}

export interface OverviewStats {
  totalDocs: number;
  totalWords: number;
  totalBlocks: number;
  recent7DaysDocs: number;
  yearDiaryDays: number;
}

export interface HeatmapDay {
  date: string; // YYYY-MM-DD
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  hasDiary: boolean;
}

export interface MonthCalendarDay {
  date: string; // YYYY-MM-DD
  hasDiary: boolean;
  diaryDocId?: string;
  hasUnfinishedTodo: boolean;
}

export interface BackupBundle {
  version: 1;
  exportedAt: string;
  plugin: 'siyuan-personal-home';
  settings: PluginSettings;
  tasks: TasksStore;
  habits: HabitsStore;
  recentReads: RecentReadsStore;
}
