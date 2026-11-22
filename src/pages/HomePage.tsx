import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Settings } from 'lucide-react';
import { DocPickerModal } from '../components/DocPickerModal';
import { HabitCard, type CreateHabitDraft } from '../components/HabitCard';
import { HabitDetailModal } from '../components/HabitDetailModal';
import { MiniCalendarCard } from '../components/MiniCalendarCard';
import { RecentDocsCard } from '../components/RecentDocsCard';
import { SettingsModal } from '../components/SettingsModal';
import { StatsHeatmapCard } from '../components/StatsHeatmapCard';
import { TaskCard } from '../components/TaskCard';
import { TodayDailyNoteCard } from '../components/TodayDailyNoteCard';
import { moveItemOrder } from '../domain/taskLogic';
import {
  DEFAULT_SETTINGS,
  DEFAULT_TASK_CATEGORIES,
  type DocPreviewItem,
  type HabitItem,
  type HabitsStore,
  type HeatmapDay,
  type MonthCalendarDay,
  type OverviewStats,
  type PluginSettings,
  type RecentReadsStore,
  type RecentTabKey,
  type TaskCategory,
  type TaskItem,
  type TaskPriority,
  type TasksStore,
} from '../domain/types';
import {
  fetchMonthCalendarDays,
  fetchTodayDailyNote,
  openOrCreateDailyNote,
  resolveActiveDiaryNotebook,
} from '../services/dailyNoteService';
import { fetchRecentModifiedDocs, fetchRecentReadDocs } from '../services/recentDocsService';
import type { SiYuanClient, SiYuanNotebook } from '../services/siyuanApi';
import { fetchOverviewStats, fetchYearHeatmap } from '../services/statsService';
import type { StorageService } from '../services/storageService';

export interface HomePageProps {
  api: SiYuanClient;
  storage: StorageService;
  openDoc: (docId: string) => void;
  subscribeSyncRefresh?: (cb: () => void) => () => void;
  todayOverride?: string;
}

const PAGE_SIZE = 12;
const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

function getLocalTodayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatChineseDateHeader(todayStr: string): string {
  const [y, m, d] = todayStr.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return `${y}年${m}月${d}日 ${WEEKDAYS[dt.getDay()] ?? ''}`;
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const HomePage: React.FC<HomePageProps> = ({
  api,
  storage,
  openDoc,
  subscribeSyncRefresh,
  todayOverride,
}) => {
  const todayStr = todayOverride || getLocalTodayStr();
  const currentYear = Number(todayStr.slice(0, 4));
  const currentMonth = Number(todayStr.slice(5, 7));

  const [settings, setSettings] = useState<PluginSettings>(DEFAULT_SETTINGS);
  const [notebooks, setNotebooks] = useState<SiYuanNotebook[]>([]);
  const [activeDiaryNotebookId, setActiveDiaryNotebookId] = useState<string>('');

  const [stats, setStats] = useState<OverviewStats>({
    totalDocs: 0,
    totalWords: 0,
    totalBlocks: 0,
    recent7DaysDocs: 0,
    yearDiaryDays: 0,
  });
  const [heatmapYear, setHeatmapYear] = useState<number>(currentYear);
  const [heatmapData, setHeatmapData] = useState<{
    days: HeatmapDay[];
    totalBlocks: number;
    activeDays: number;
  }>({ days: [], totalBlocks: 0, activeDays: 0 });

  const [todayDailyNote, setTodayDailyNote] = useState<DocPreviewItem | null>(null);
  const [todayLoading, setTodayLoading] = useState<boolean>(true);

  const [calYear, setCalYear] = useState<number>(currentYear);
  const [calMonth, setCalMonth] = useState<number>(currentMonth);
  const [calendarDays, setCalendarDays] = useState<Record<string, MonthCalendarDay>>({});

  const [recentTab, setRecentTab] = useState<RecentTabKey>('modified');
  const [recentNotebookId, setRecentNotebookId] = useState<string>('all');
  const [recentKeyword, setRecentKeyword] = useState<string>('');
  const [recentItems, setRecentItems] = useState<DocPreviewItem[]>([]);
  const [recentHasMore, setRecentHasMore] = useState<boolean>(false);
  const [recentLoading, setRecentLoading] = useState<boolean>(false);
  const [recentOffset, setRecentOffset] = useState<number>(0);

  const [tasksStore, setTasksStore] = useState<TasksStore>({
    version: 1,
    categories: DEFAULT_TASK_CATEGORIES,
    tasks: [],
  });
  const [habitsStore, setHabitsStore] = useState<HabitsStore>({
    version: 1,
    habits: [],
    checkins: {},
  });
  const [recentReadsStore, setRecentReadsStore] = useState<RecentReadsStore>({
    version: 1,
    records: [],
  });

  const [activeHabitId, setActiveHabitId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [docPickerTarget, setDocPickerTarget] = useState<
    { kind: 'task'; id: string } | { kind: 'habit'; id: string } | null
  >(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const activeNotebookName = useMemo(
    () => notebooks.find((n) => n.id === activeDiaryNotebookId)?.name ?? '',
    [notebooks, activeDiaryNotebookId],
  );

  const loadStoredData = useCallback(async () => {
    const [loadedSettings, loadedTasks, loadedHabits, loadedReads] = await Promise.all([
      storage.loadSettings(),
      storage.loadTasks(),
      storage.loadHabits(),
      storage.loadRecentReads(),
    ]);
    setSettings(loadedSettings);
    setRecentTab(loadedSettings.recentTab);
    setTasksStore(loadedTasks);
    setHabitsStore(loadedHabits);
    setRecentReadsStore(loadedReads);
    return { loadedSettings, loadedReads };
  }, [storage]);

  const loadDiaryAndStats = useCallback(
    async (
      nbId: string,
      nbName: string,
      hYear: number,
      cYear: number,
      cMonth: number,
      showTodoBadge: boolean,
    ) => {
      setTodayLoading(true);
      try {
        const [ovStats, hm, calMap, todayDoc] = await Promise.all([
          fetchOverviewStats(api, nbId, todayStr),
          fetchYearHeatmap(api, hYear, nbId),
          fetchMonthCalendarDays(api, nbId, cYear, cMonth, showTodoBadge),
          fetchTodayDailyNote(api, nbId, todayStr, nbName),
        ]);
        setStats(ovStats);
        setHeatmapData(hm);
        setCalendarDays(calMap);
        setTodayDailyNote(todayDoc);
      } finally {
        setTodayLoading(false);
      }
    },
    [api, todayStr],
  );

  const loadRecentDocs = useCallback(
    async (
      tab: RecentTabKey,
      nbs: SiYuanNotebook[],
      reads: RecentReadsStore,
      hideDaily: boolean,
      nbFilter: string,
      kw: string,
      offset: number,
      append: boolean,
    ) => {
      setRecentLoading(true);
      try {
        const query = {
          notebookId: nbFilter,
          hideDailyNotes: hideDaily,
          keyword: kw,
          limit: PAGE_SIZE,
          offset,
        };
        const res =
          tab === 'modified'
            ? await fetchRecentModifiedDocs(api, nbs, query)
            : await fetchRecentReadDocs(api, nbs, reads.records, query, (validIds) => {
                void storage.pruneRecentReads(validIds).then(setRecentReadsStore);
              });
        setRecentItems((prev) => (append ? [...prev, ...res.items] : res.items));
        setRecentHasMore(res.hasMore);
        setRecentOffset(offset);
      } finally {
        setRecentLoading(false);
      }
    },
    [api, storage],
  );

  const bootstrapAll = useCallback(async () => {
    setRefreshing(true);
    setErrorBanner(null);
    try {
      const [{ loadedSettings, loadedReads }, nbs, localStore] = await Promise.all([
        loadStoredData(),
        api.lsNotebooks(),
        api.getLocalStorage(),
      ]);
      setNotebooks(nbs);
      const localDailyNoteId =
        typeof localStore['local-dailynoteid'] === 'string'
          ? localStore['local-dailynoteid']
          : undefined;
      const resolvedNbId = resolveActiveDiaryNotebook(
        nbs,
        localDailyNoteId,
        loadedSettings.diaryNotebookId,
      );
      setActiveDiaryNotebookId(resolvedNbId);
      const resolvedNbName = nbs.find((n) => n.id === resolvedNbId)?.name ?? '';

      await Promise.all([
        loadDiaryAndStats(
          resolvedNbId,
          resolvedNbName,
          heatmapYear,
          calYear,
          calMonth,
          loadedSettings.showDiaryTodoBadge,
        ),
        loadRecentDocs(
          loadedSettings.recentTab,
          nbs,
          loadedReads,
          loadedSettings.hideDailyNotesInRecent,
          recentNotebookId,
          recentKeyword,
          0,
          false,
        ),
      ]);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : '加载个人主页数据时发生错误');
    } finally {
      setRefreshing(false);
    }
  }, [
    api,
    calMonth,
    calYear,
    heatmapYear,
    loadDiaryAndStats,
    loadRecentDocs,
    loadStoredData,
    recentKeyword,
    recentNotebookId,
  ]);

  useEffect(() => {
    void bootstrapAll();
    // Initial load only; subsequent filter changes trigger targeted reloads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!subscribeSyncRefresh) return;
    return subscribeSyncRefresh(() => {
      void bootstrapAll();
    });
  }, [subscribeSyncRefresh, bootstrapAll]);

  const handlePatchSettings = async (patch: Partial<PluginSettings>) => {
    const next = { ...settings, ...patch, version: 1 as const };
    setSettings(next);
    await storage.saveSettings(next);
    if (patch.showDiaryTodoBadge !== undefined) {
      const calMap = await fetchMonthCalendarDays(
        api,
        activeDiaryNotebookId,
        calYear,
        calMonth,
        next.showDiaryTodoBadge,
      );
      setCalendarDays(calMap);
    }
  };

  const handleSelectDiaryNotebook = async (nbId: string) => {
    setActiveDiaryNotebookId(nbId);
    const nbName = notebooks.find((n) => n.id === nbId)?.name ?? '';
    await Promise.all([
      api.setLocalStorageVal('local-dailynoteid', nbId),
      handlePatchSettings({ diaryNotebookId: nbId }),
    ]);
    await loadDiaryAndStats(
      nbId,
      nbName,
      heatmapYear,
      calYear,
      calMonth,
      settings.showDiaryTodoBadge,
    );
  };

  const handleChangeHeatmapYear = async (year: number) => {
    setHeatmapYear(year);
    const hm = await fetchYearHeatmap(api, year, activeDiaryNotebookId);
    setHeatmapData(hm);
  };

  const handleChangeCalendarMonth = async (year: number, month: number) => {
    setCalYear(year);
    setCalMonth(month);
    const calMap = await fetchMonthCalendarDays(
      api,
      activeDiaryNotebookId,
      year,
      month,
      settings.showDiaryTodoBadge,
    );
    setCalendarDays(calMap);
  };

  const handleClickDiaryDate = async (dateStr: string) => {
    try {
      const docId = await openOrCreateDailyNote(api, activeDiaryNotebookId, dateStr, todayStr);
      openDoc(docId);
      // Refresh calendar & today card softly
      await loadDiaryAndStats(
        activeDiaryNotebookId,
        activeNotebookName,
        heatmapYear,
        calYear,
        calMonth,
        settings.showDiaryTodoBadge,
      );
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : '打开或创建日记失败');
    }
  };

  const handleChangeRecentTab = async (tab: RecentTabKey) => {
    setRecentTab(tab);
    await handlePatchSettings({ recentTab: tab });
    const latestReads = tab === 'read' ? await storage.loadRecentReads() : recentReadsStore;
    if (tab === 'read') setRecentReadsStore(latestReads);
    await loadRecentDocs(
      tab,
      notebooks,
      latestReads,
      settings.hideDailyNotesInRecent,
      recentNotebookId,
      recentKeyword,
      0,
      false,
    );
  };

  const handleToggleHideDailyNotes = async () => {
    const nextVal = !settings.hideDailyNotesInRecent;
    await handlePatchSettings({ hideDailyNotesInRecent: nextVal });
    await loadRecentDocs(
      recentTab,
      notebooks,
      recentReadsStore,
      nextVal,
      recentNotebookId,
      recentKeyword,
      0,
      false,
    );
  };

  const handleChangeRecentNotebook = async (nbId: string) => {
    setRecentNotebookId(nbId);
    await loadRecentDocs(
      recentTab,
      notebooks,
      recentReadsStore,
      settings.hideDailyNotesInRecent,
      nbId,
      recentKeyword,
      0,
      false,
    );
  };

  const handleChangeRecentKeyword = async (kw: string) => {
    setRecentKeyword(kw);
    await loadRecentDocs(
      recentTab,
      notebooks,
      recentReadsStore,
      settings.hideDailyNotesInRecent,
      recentNotebookId,
      kw,
      0,
      false,
    );
  };

  // --- Habits handlers ---
  const handleCreateHabit = async (draft: CreateHabitDraft) => {
    const now = Date.now();
    const nextStore = await storage.updateHabits((curr) => {
      const activeCount = curr.habits.filter((h) => !h.deleted && !h.archived).length;
      const item: HabitItem = {
        id: generateId('habit'),
        name: draft.name,
        icon: draft.icon,
        color: draft.color,
        frequencyType: draft.frequencyType,
        weeklyTarget: draft.weeklyTarget,
        trackDuration: draft.trackDuration,
        defaultDurationMinutes: draft.defaultDurationMinutes,
        createdAt: todayStr,
        archived: false,
        sortOrder: activeCount,
        updatedAt: now,
      };
      return { ...curr, habits: [...curr.habits, item] };
    });
    setHabitsStore(nextStore);
  };

  const handleToggleHabitToday = async (habitId: string) => {
    const now = Date.now();
    const nextStore = await storage.updateHabits((curr) => {
      const habit = curr.habits.find((h) => h.id === habitId);
      const map = { ...(curr.checkins[habitId] ?? {}) };
      const existing = map[todayStr];
      const nextDone = !existing?.done;
      map[todayStr] = {
        done: nextDone,
        durationMinutes: nextDone
          ? existing?.durationMinutes ??
            (habit?.trackDuration ? habit.defaultDurationMinutes ?? 30 : undefined)
          : undefined,
        note: existing?.note,
        checkedAt: now,
        updatedAt: now,
      };
      return {
        ...curr,
        checkins: { ...curr.checkins, [habitId]: map },
      };
    });
    setHabitsStore(nextStore);
  };

  const handleUpdateHabitTodayDuration = async (habitId: string, minutes: number) => {
    const now = Date.now();
    const nextStore = await storage.updateHabits((curr) => {
      const map = { ...(curr.checkins[habitId] ?? {}) };
      const existing = map[todayStr];
      map[todayStr] = {
        done: true,
        durationMinutes: Math.max(0, minutes),
        note: existing?.note,
        checkedAt: existing?.checkedAt ?? now,
        updatedAt: now,
      };
      return {
        ...curr,
        checkins: { ...curr.checkins, [habitId]: map },
      };
    });
    setHabitsStore(nextStore);
  };

  const handleSetHabitDateCheckin = async (
    habitId: string,
    dateStr: string,
    payload: { done: boolean; durationMinutes?: number; note?: string },
  ) => {
    const now = Date.now();
    const nextStore = await storage.updateHabits((curr) => {
      const map = { ...(curr.checkins[habitId] ?? {}) };
      map[dateStr] = {
        done: payload.done,
        durationMinutes: payload.done ? payload.durationMinutes : undefined,
        note: payload.note,
        checkedAt: now,
        updatedAt: now,
      };
      return {
        ...curr,
        checkins: { ...curr.checkins, [habitId]: map },
      };
    });
    setHabitsStore(nextStore);
  };

  const handleUpdateHabit = async (habitId: string, patch: Partial<HabitItem>) => {
    const now = Date.now();
    const nextStore = await storage.updateHabits((curr) => ({
      ...curr,
      habits: curr.habits.map((h) => (h.id === habitId ? { ...h, ...patch, updatedAt: now } : h)),
    }));
    setHabitsStore(nextStore);
  };

  const handleMoveHabitOrder = async (habitId: string, direction: 'up' | 'down') => {
    const now = Date.now();
    const nextStore = await storage.updateHabits((curr) => {
      const visible = curr.habits.filter((h) => !h.deleted && !h.archived);
      const others = curr.habits.filter((h) => h.deleted || h.archived);
      const reordered = moveItemOrder(visible, habitId, direction, now);
      return { ...curr, habits: [...reordered, ...others] };
    });
    setHabitsStore(nextStore);
  };

  const handleArchiveHabit = async (habitId: string) => {
    await handleUpdateHabit(habitId, { archived: true });
    setActiveHabitId(null);
  };

  const handleDeleteHabit = async (habitId: string) => {
    await handleUpdateHabit(habitId, { deleted: true });
    setActiveHabitId(null);
  };

  // --- Tasks handlers ---
  const handleCreateTask = async (title: string, priority: TaskPriority, categoryId: string) => {
    const now = Date.now();
    const nextStore = await storage.updateTasks((curr) => {
      const item: TaskItem = {
        id: generateId('task'),
        title,
        priority,
        categoryId,
        completed: false,
        createdAt: now,
        updatedAt: now,
        sortOrder: curr.tasks.length,
      };
      return { ...curr, tasks: [...curr.tasks, item] };
    });
    setTasksStore(nextStore);
  };

  const handleToggleTaskComplete = async (taskId: string) => {
    const now = Date.now();
    const nextStore = await storage.updateTasks((curr) => ({
      ...curr,
      tasks: curr.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              completed: !t.completed,
              completedAt: !t.completed ? now : undefined,
              updatedAt: now,
            }
          : t,
      ),
    }));
    setTasksStore(nextStore);
  };

  const handleUpdateTask = async (taskId: string, patch: Partial<TaskItem>) => {
    const now = Date.now();
    const nextStore = await storage.updateTasks((curr) => ({
      ...curr,
      tasks: curr.tasks.map((t) => (t.id === taskId ? { ...t, ...patch, updatedAt: now } : t)),
    }));
    setTasksStore(nextStore);
  };

  const handleDeleteTask = async (taskId: string) => {
    await handleUpdateTask(taskId, { deleted: true });
  };

  const handleClearCompletedTasks = async () => {
    const now = Date.now();
    const nextStore = await storage.updateTasks((curr) => ({
      ...curr,
      tasks: curr.tasks.map((t) =>
        t.completed && !t.deleted ? { ...t, deleted: true, updatedAt: now } : t,
      ),
    }));
    setTasksStore(nextStore);
  };

  const handleSaveCategories = async (categories: TaskCategory[]) => {
    const nextStore = await storage.updateTasks((curr) => ({
      ...curr,
      categories,
    }));
    setTasksStore(nextStore);
  };

  // --- Backup handlers ---
  const handleExportJson = async () => {
    const bundle = await storage.exportAllData();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `siyuan-personal-home-backup-${todayStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = async (raw: unknown) => {
    await storage.importAllData(raw);
    await bootstrapAll();
  };

  const visibleHabitsSorted = useMemo(
    () =>
      habitsStore.habits
        .filter((h) => !h.deleted && !h.archived)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [habitsStore.habits],
  );
  const activeHabit = activeHabitId
    ? visibleHabitsSorted.find((h) => h.id === activeHabitId) ?? null
    : null;
  const activeHabitIdx = activeHabit
    ? visibleHabitsSorted.findIndex((h) => h.id === activeHabit.id)
    : -1;

  return (
    <div className={`sph-root ${settings.useThemeAccent ? 'sph-use-accent' : ''}`}>
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-5 flex flex-col gap-4">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-3 min-w-0">
            <h1 className="text-lg font-semibold m-0">个人主页</h1>
            <span className="text-xs truncate" style={{ color: 'var(--sph-muted)' }}>
              {formatChineseDateHeader(todayStr)}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className="sph-btn"
              aria-label="刷新主页"
              disabled={refreshing}
              onClick={() => void bootstrapAll()}
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              <span>刷新</span>
            </button>
            <button
              type="button"
              className="sph-btn"
              aria-label="打开设置"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings size={13} />
              <span>设置</span>
            </button>
          </div>
        </header>

        {errorBanner && (
          <div
            className="rounded-xl px-4 py-2.5 text-xs flex items-center justify-between gap-2"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
            }}
          >
            <span>{errorBanner}</span>
            <button
              type="button"
              className="border-0 bg-transparent cursor-pointer text-xs"
              style={{ color: '#ef4444' }}
              onClick={() => setErrorBanner(null)}
            >
              关闭
            </button>
          </div>
        )}

        <StatsHeatmapCard
          stats={stats}
          heatmap={heatmapData.days}
          totalBlocksInYear={heatmapData.totalBlocks}
          activeDaysInYear={heatmapData.activeDays}
          year={heatmapYear}
          showHeatmap={settings.showHeatmap}
          weekStartDay={settings.weekStartDay}
          onChangeYear={(y) => void handleChangeHeatmapYear(y)}
          onToggleHeatmap={() => void handlePatchSettings({ showHeatmap: !settings.showHeatmap })}
          onClickDate={(d) => void handleClickDiaryDate(d)}
        />

        <div className="sph-bento-grid">
          <div className="flex flex-col gap-4 min-w-0">
            <TodayDailyNoteCard
              todayStr={todayStr}
              dailyNote={todayDailyNote}
              loading={todayLoading}
              onOpenDoc={openDoc}
              onCreateToday={() => void handleClickDiaryDate(todayStr)}
            />

            <RecentDocsCard
              activeTab={recentTab}
              onChangeTab={(tab) => void handleChangeRecentTab(tab)}
              items={recentItems}
              hasMore={recentHasMore}
              loading={recentLoading}
              hideDailyNotes={settings.hideDailyNotesInRecent}
              onToggleHideDailyNotes={() => void handleToggleHideDailyNotes()}
              notebookId={recentNotebookId}
              notebooks={notebooks}
              onChangeNotebook={(nbId) => void handleChangeRecentNotebook(nbId)}
              keyword={recentKeyword}
              onChangeKeyword={(kw) => void handleChangeRecentKeyword(kw)}
              onLoadMore={() =>
                void loadRecentDocs(
                  recentTab,
                  notebooks,
                  recentReadsStore,
                  settings.hideDailyNotesInRecent,
                  recentNotebookId,
                  recentKeyword,
                  recentOffset + PAGE_SIZE,
                  true,
                )
              }
              onOpenDoc={openDoc}
            />
          </div>

          <div className="flex flex-col gap-4 min-w-0">
            <MiniCalendarCard
              year={calYear}
              month={calMonth}
              todayStr={todayStr}
              weekStartDay={settings.weekStartDay}
              showTodoBadge={settings.showDiaryTodoBadge}
              daysMap={calendarDays}
              notebooks={notebooks}
              activeNotebookId={activeDiaryNotebookId}
              onChangeMonth={(y, m) => void handleChangeCalendarMonth(y, m)}
              onSelectNotebook={(nbId) => void handleSelectDiaryNotebook(nbId)}
              onClickDate={(d) => void handleClickDiaryDate(d)}
              onJumpToday={() => {
                void handleChangeCalendarMonth(currentYear, currentMonth);
                void handleClickDiaryDate(todayStr);
              }}
            />

            <HabitCard
              habits={habitsStore.habits}
              checkins={habitsStore.checkins}
              todayStr={todayStr}
              weekStartDay={settings.weekStartDay}
              onToggleToday={(id) => void handleToggleHabitToday(id)}
              onUpdateTodayDuration={(id, mins) => void handleUpdateHabitTodayDuration(id, mins)}
              onOpenDetail={(id) => setActiveHabitId(id)}
              onCreateHabit={(draft) => void handleCreateHabit(draft)}
            />

            <TaskCard
              tasks={tasksStore.tasks}
              categories={tasksStore.categories}
              onCreateTask={(title, pr, cat) => void handleCreateTask(title, pr, cat)}
              onToggleComplete={(id) => void handleToggleTaskComplete(id)}
              onUpdateTask={(id, patch) => void handleUpdateTask(id, patch)}
              onDeleteTask={(id) => void handleDeleteTask(id)}
              onClearCompleted={() => void handleClearCompletedTasks()}
              onSaveCategories={(cats) => void handleSaveCategories(cats)}
              onPickDoc={(id) => setDocPickerTarget({ kind: 'task', id })}
              onOpenDoc={openDoc}
            />
          </div>
        </div>
      </div>

      {activeHabit && (
        <HabitDetailModal
          habit={activeHabit}
          checkins={habitsStore.checkins[activeHabit.id] ?? {}}
          todayStr={todayStr}
          weekStartDay={settings.weekStartDay}
          isFirst={activeHabitIdx <= 0}
          isLast={activeHabitIdx === visibleHabitsSorted.length - 1}
          onClose={() => setActiveHabitId(null)}
          onSetDateCheckin={(id, dateStr, payload) =>
            void handleSetHabitDateCheckin(id, dateStr, payload)
          }
          onUpdateHabit={(id, patch) => void handleUpdateHabit(id, patch)}
          onMoveOrder={(id, dir) => void handleMoveHabitOrder(id, dir)}
          onArchive={(id) => void handleArchiveHabit(id)}
          onDelete={(id) => void handleDeleteHabit(id)}
          onPickDoc={(id) => setDocPickerTarget({ kind: 'habit', id })}
          onOpenDoc={openDoc}
        />
      )}

      <DocPickerModal
        open={Boolean(docPickerTarget)}
        onClose={() => setDocPickerTarget(null)}
        onSearch={(kw) => api.searchDocs(kw)}
        onSelect={(doc) => {
          if (!docPickerTarget) return;
          if (docPickerTarget.kind === 'task') {
            void handleUpdateTask(docPickerTarget.id, {
              linkedDocId: doc.id,
              linkedDocTitle: doc.title,
            });
          } else {
            void handleUpdateHabit(docPickerTarget.id, {
              linkedDocId: doc.id,
              linkedDocTitle: doc.title,
            });
          }
        }}
      />

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onChangeSettings={(patch) => void handlePatchSettings(patch)}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
      />
    </div>
  );
};
