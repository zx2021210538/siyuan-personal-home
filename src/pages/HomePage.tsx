import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  CheckSquare,
  Compass,
  Palette,
  RefreshCw,
  Settings,
} from 'lucide-react';
import { DocPickerModal } from '../components/DocPickerModal';
import { HabitCard, type CreateHabitDraft } from '../components/HabitCard';
import { HabitDetailModal } from '../components/HabitDetailModal';
import { MiniCalendarCard } from '../components/MiniCalendarCard';
import { RecentDocsCard } from '../components/RecentDocsCard';
import { SettingsModal } from '../components/SettingsModal';
import { StatsHeatmapCard } from '../components/StatsHeatmapCard';
import { TaskCard } from '../components/TaskCard';
import { ThemeStudioModal } from '../components/ThemeStudioModal';
import { TodayDailyNoteCard } from '../components/TodayDailyNoteCard';
import type { ProtyleMountFn } from '../components/ReadOnlyProtyleView';
import { formatRelativeTime } from '../domain/docPreview';
import { buildThemeCssVars, DEFAULT_THEME_ID, resolveActiveTheme } from '../domain/themes';
import { getActiveTasks, moveItemOrder, sortTasksByPriority } from '../domain/taskLogic';
import {
  DEFAULT_NOTE_CARD_PREFS,
  DEFAULT_SETTINGS,
  DEFAULT_TASK_CATEGORIES,
  type DocPreviewItem,
  type HabitItem,
  type HabitsStore,
  type HeatmapDay,
  type HomeSubTab,
  type HomeThemePreset,
  type MonthCalendarDay,
  type NoteCardDisplayPrefs,
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
  fetchDailyNoteByDate,
  fetchMonthCalendarDays,
  fetchTodayDailyNote,
  openOrCreateDailyNote,
  resolveActiveDiaryNotebook,
} from '../services/dailyNoteService';
import {
  fetchRecentModifiedDocs,
  fetchRecentReadDocs,
  resolveHiddenIdLabels,
} from '../services/recentDocsService';
import {
  getRuntimeEditorFontFamily,
  type SiYuanClient,
  type SiYuanNotebook,
} from '../services/siyuanApi';
import { fetchOverviewStats, fetchYearHeatmap } from '../services/statsService';
import type { StorageService } from '../services/storageService';

export interface HomePageProps {
  api: SiYuanClient;
  storage: StorageService;
  openDoc: (docId: string) => void;
  mountProtyle?: ProtyleMountFn;
  subscribeSyncRefresh?: (cb: () => void) => () => void;
  todayOverride?: string;
  initialSubTab?: HomeSubTab;
}

const PAGE_SIZE = 12;
const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

const SUB_TABS: Array<{ key: HomeSubTab; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { key: 'overview', label: '总览', icon: Compass },
  { key: 'notes', label: '笔记', icon: BookOpen },
  { key: 'journal', label: '日记与日历', icon: Calendar },
  { key: 'plan', label: '计划与习惯', icon: CheckSquare },
];

const PRIORITY_BADGE: Record<TaskPriority, { label: string; color: string; bg: string }> = {
  high: { label: '高', color: '#e11d48', bg: 'rgba(225, 29, 72, 0.14)' },
  medium: { label: '中', color: '#d97706', bg: 'rgba(217, 119, 6, 0.14)' },
  low: { label: '低', color: '#64748b', bg: 'rgba(100, 116, 139, 0.14)' },
};

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
  return `${y} 年 ${m} 月 ${d} 日 · ${WEEKDAYS[dt.getDay()] ?? ''}`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了';
  if (hour < 12) return '早安';
  if (hour < 18) return '下午好';
  return '晚上好';
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const HomePage: React.FC<HomePageProps> = ({
  api,
  storage,
  openDoc,
  mountProtyle,
  subscribeSyncRefresh,
  todayOverride,
  initialSubTab = 'overview',
}) => {
  const todayStr = todayOverride || getLocalTodayStr();
  const currentYear = Number(todayStr.slice(0, 4));
  const currentMonth = Number(todayStr.slice(5, 7));

  const [activeSubTab, setActiveSubTab] = useState<HomeSubTab>(initialSubTab);
  const [editorFontFamily, setEditorFontFamily] = useState<string>(() =>
    getRuntimeEditorFontFamily(),
  );

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
  const [selectedJournalDate, setSelectedJournalDate] = useState<string>(todayStr);
  const [selectedJournalNote, setSelectedJournalNote] = useState<DocPreviewItem | null>(null);
  const [selectedJournalLoading, setSelectedJournalLoading] = useState<boolean>(false);

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
  const [themeStudioOpen, setThemeStudioOpen] = useState<boolean>(false);
  const [previewTheme, setPreviewTheme] = useState<HomeThemePreset | null>(null);
  const [hiddenIdLabels, setHiddenIdLabels] = useState<Record<string, string>>({});
  const [docPickerTarget, setDocPickerTarget] = useState<
    { kind: 'task'; id: string } | { kind: 'habit'; id: string } | { kind: 'hiddenDoc' } | null
  >(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [protyleRefreshNonce, setProtyleRefreshNonce] = useState<number>(0);

  const recentReqIdRef = useRef(0);
  const diaryReqIdRef = useRef(0);
  const journalPreviewReqIdRef = useRef(0);
  const keywordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightDailyDatesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    return () => {
      if (keywordTimerRef.current) clearTimeout(keywordTimerRef.current);
    };
  }, []);

  const reportError = useCallback((err: unknown, fallback: string) => {
    setErrorBanner(err instanceof Error ? err.message : fallback);
  }, []);

  const safeRun = useCallback(
    async (fn: () => Promise<void>, fallbackMsg: string) => {
      try {
        await fn();
      } catch (err) {
        reportError(err, fallbackMsg);
      }
    },
    [reportError],
  );

  const activeNotebookName = useMemo(
    () => notebooks.find((n) => n.id === activeDiaryNotebookId)?.name ?? '',
    [notebooks, activeDiaryNotebookId],
  );

  const loadStoredData = useCallback(async () => {
    const errors: string[] = [];
    const [settingsRes, tasksRes, habitsRes, readsRes] = await Promise.allSettled([
      storage.loadSettings(),
      storage.loadTasks(),
      storage.loadHabits(),
      storage.loadRecentReads(),
    ]);

    const loadedSettings =
      settingsRes.status === 'fulfilled'
        ? settingsRes.value
        : (errors.push(
            settingsRes.reason instanceof Error
              ? settingsRes.reason.message
              : 'settings.json 读取失败',
          ),
          DEFAULT_SETTINGS);
    if (tasksRes.status === 'fulfilled') {
      setTasksStore(tasksRes.value);
    } else {
      errors.push(
        tasksRes.reason instanceof Error ? tasksRes.reason.message : 'tasks.json 读取失败',
      );
    }
    if (habitsRes.status === 'fulfilled') {
      setHabitsStore(habitsRes.value);
    } else {
      errors.push(
        habitsRes.reason instanceof Error ? habitsRes.reason.message : 'habits.json 读取失败',
      );
    }
    const loadedReads =
      readsRes.status === 'fulfilled'
        ? readsRes.value
        : (errors.push(
            readsRes.reason instanceof Error
              ? readsRes.reason.message
              : 'recent-reads.json 读取失败',
          ),
          { version: 1 as const, records: [] });

    setSettings(loadedSettings);
    setRecentTab(loadedSettings.recentTab);
    setRecentReadsStore(loadedReads);
    if (errors.length > 0) {
      setErrorBanner(errors.join('；'));
    }
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
      const reqId = ++diaryReqIdRef.current;
      setTodayLoading(true);
      try {
        const [ovStats, hm, calMap, todayDoc] = await Promise.all([
          fetchOverviewStats(api, nbId, todayStr),
          fetchYearHeatmap(api, hYear, nbId),
          fetchMonthCalendarDays(api, nbId, cYear, cMonth, showTodoBadge),
          fetchTodayDailyNote(api, nbId, todayStr, nbName),
        ]);
        if (reqId !== diaryReqIdRef.current) return;
        setStats(ovStats);
        setHeatmapData(hm);
        setCalendarDays(calMap);
        setTodayDailyNote(todayDoc);
        if (selectedJournalDate === todayStr) {
          setSelectedJournalNote(todayDoc);
        }
      } finally {
        if (reqId === diaryReqIdRef.current) {
          setTodayLoading(false);
        }
      }
    },
    [api, todayStr, selectedJournalDate],
  );

  const loadRecentDocs = useCallback(
    async (
      tab: RecentTabKey,
      nbs: SiYuanNotebook[],
      reads: RecentReadsStore,
      hideDaily: boolean,
      hiddenNbIds: string[],
      hiddenIds: string[],
      nbFilter: string,
      kw: string,
      offset: number,
      append: boolean,
    ) => {
      const reqId = ++recentReqIdRef.current;
      setRecentLoading(true);
      try {
        const query = {
          notebookId: nbFilter,
          hideDailyNotes: hideDaily,
          hiddenNotebookIds: hiddenNbIds,
          hiddenIds,
          keyword: kw,
          limit: PAGE_SIZE,
          offset,
        };
        const res =
          tab === 'modified'
            ? await fetchRecentModifiedDocs(api, nbs, query)
            : await fetchRecentReadDocs(api, nbs, reads.records, query, (deadIds) => {
                void storage
                  .pruneRecentReads(deadIds)
                  .then(setRecentReadsStore)
                  .catch(() => undefined);
              });
        if (reqId !== recentReqIdRef.current) return;
        setRecentItems((prev) => (append ? [...prev, ...res.items] : res.items));
        setRecentHasMore(res.hasMore);
        setRecentOffset(offset);
      } finally {
        if (reqId === recentReqIdRef.current) {
          setRecentLoading(false);
        }
      }
    },
    [api, storage],
  );

  const bootstrapAll = useCallback(async () => {
    setRefreshing(true);
    setErrorBanner(null);
    try {
      const [{ loadedSettings, loadedReads }, nbs, localStore, resolvedFont] = await Promise.all([
        loadStoredData(),
        api.lsNotebooks(),
        api.getLocalStorage(),
        api.getEditorFontFamily
          ? api.getEditorFontFamily().catch(() => getRuntimeEditorFontFamily())
          : Promise.resolve(getRuntimeEditorFontFamily()),
      ]);
      if (resolvedFont) {
        setEditorFontFamily(resolvedFont);
      }
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
          loadedSettings.hiddenRecentNotebookIds ?? [],
          loadedSettings.hiddenRecentIds ?? [],
          recentNotebookId,
          recentKeyword,
          0,
          false,
        ),
        resolveHiddenIdLabels(api, nbs, loadedSettings.hiddenRecentIds ?? []).then(setHiddenIdLabels),
      ]);
      setProtyleRefreshNonce((n) => n + 1);
    } catch (err) {
      reportError(err, '加载个人主页数据时发生错误');
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
    reportError,
  ]);

  useEffect(() => {
    void bootstrapAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!subscribeSyncRefresh) return;
    return subscribeSyncRefresh(() => {
      void bootstrapAll();
    });
  }, [subscribeSyncRefresh, bootstrapAll]);

  const handlePatchSettings = async (patch: Partial<PluginSettings>) => {
    await safeRun(async () => {
      const saved = await storage.updateSettings((curr) => ({
        ...curr,
        ...patch,
        version: 1,
      }));
      setSettings(saved);
      if (patch.showDiaryTodoBadge !== undefined) {
        const calMap = await fetchMonthCalendarDays(
          api,
          activeDiaryNotebookId,
          calYear,
          calMonth,
          saved.showDiaryTodoBadge,
        );
        setCalendarDays(calMap);
      }
    }, '保存设置失败');
  };

  const handleSelectDiaryNotebook = async (nbId: string) => {
    await safeRun(async () => {
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
      if (selectedJournalDate !== todayStr) {
        const doc = await fetchDailyNoteByDate(api, nbId, selectedJournalDate, nbName);
        setSelectedJournalNote(doc);
      }
    }, '切换日记本失败');
  };

  const handleChangeHeatmapYear = async (year: number) => {
    await safeRun(async () => {
      setHeatmapYear(year);
      const hm = await fetchYearHeatmap(api, year, activeDiaryNotebookId);
      setHeatmapData(hm);
    }, '加载年度热力图失败');
  };

  const handleChangeCalendarMonth = async (year: number, month: number) => {
    await safeRun(async () => {
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
    }, '加载月历失败');
  };

  const handleSelectJournalDate = async (dateStr: string) => {
    setSelectedJournalDate(dateStr);
    const reqId = ++journalPreviewReqIdRef.current;
    setSelectedJournalLoading(true);
    try {
      const doc = await fetchDailyNoteByDate(
        api,
        activeDiaryNotebookId,
        dateStr,
        activeNotebookName,
      );
      if (reqId === journalPreviewReqIdRef.current) {
        setSelectedJournalNote(doc);
      }
    } catch (err) {
      reportError(err, '读取该日日记预览失败');
    } finally {
      if (reqId === journalPreviewReqIdRef.current) {
        setSelectedJournalLoading(false);
      }
    }
  };

  const handleClickDiaryDate = async (dateStr: string) => {
    const lockKey = `${activeDiaryNotebookId}:${dateStr}`;
    if (inFlightDailyDatesRef.current.has(lockKey)) return;
    inFlightDailyDatesRef.current.add(lockKey);
    try {
      const docId = await openOrCreateDailyNote(api, activeDiaryNotebookId, dateStr, todayStr);
      openDoc(docId);
      await loadDiaryAndStats(
        activeDiaryNotebookId,
        activeNotebookName,
        heatmapYear,
        calYear,
        calMonth,
        settings.showDiaryTodoBadge,
      );
      if (dateStr === selectedJournalDate) {
        const refreshed = await fetchDailyNoteByDate(
          api,
          activeDiaryNotebookId,
          dateStr,
          activeNotebookName,
        );
        setSelectedJournalNote(refreshed);
      }
    } catch (err) {
      reportError(err, '打开或创建日记失败');
    } finally {
      inFlightDailyDatesRef.current.delete(lockKey);
    }
  };

  const handleChangeRecentTab = async (tab: RecentTabKey) => {
    await safeRun(async () => {
      setRecentTab(tab);
      await handlePatchSettings({ recentTab: tab });
      const latestReads = tab === 'read' ? await storage.loadRecentReads() : recentReadsStore;
      if (tab === 'read') setRecentReadsStore(latestReads);
      await loadRecentDocs(
        tab,
        notebooks,
        latestReads,
        settings.hideDailyNotesInRecent,
        settings.hiddenRecentNotebookIds ?? [],
        settings.hiddenRecentIds ?? [],
        recentNotebookId,
        recentKeyword,
        0,
        false,
      );
    }, '加载最近笔记失败');
  };

  const handleToggleHideDailyNotes = async () => {
    await safeRun(async () => {
      const nextVal = !settings.hideDailyNotesInRecent;
      await handlePatchSettings({ hideDailyNotesInRecent: nextVal });
      await loadRecentDocs(
        recentTab,
        notebooks,
        recentReadsStore,
        nextVal,
        settings.hiddenRecentNotebookIds ?? [],
        settings.hiddenRecentIds ?? [],
        recentNotebookId,
        recentKeyword,
        0,
        false,
      );
    }, '更新筛选条件失败');
  };

  const handleToggleHiddenNotebook = async (nbId: string) => {
    await safeRun(async () => {
      const curr = settings.hiddenRecentNotebookIds ?? [];
      const exists = curr.includes(nbId);
      const nextIds = exists ? curr.filter((id) => id !== nbId) : [...curr, nbId];
      await handlePatchSettings({ hiddenRecentNotebookIds: nextIds });
      await loadRecentDocs(
        recentTab,
        notebooks,
        recentReadsStore,
        settings.hideDailyNotesInRecent,
        nextIds,
        settings.hiddenRecentIds ?? [],
        recentNotebookId,
        recentKeyword,
        0,
        false,
      );
    }, '更新隐藏笔记本设置失败');
  };

  const handleAddHiddenIds = async (incoming: string[]) => {
    await safeRun(async () => {
      const curr = settings.hiddenRecentIds ?? [];
      const merged = Array.from(new Set([...curr, ...incoming.map((x) => x.trim()).filter(Boolean)]));
      await handlePatchSettings({ hiddenRecentIds: merged });
      const labels = await resolveHiddenIdLabels(api, notebooks, merged);
      setHiddenIdLabels(labels);
      await loadRecentDocs(
        recentTab,
        notebooks,
        recentReadsStore,
        settings.hideDailyNotesInRecent,
        settings.hiddenRecentNotebookIds ?? [],
        merged,
        recentNotebookId,
        recentKeyword,
        0,
        false,
      );
    }, '添加隐藏 ID 失败');
  };

  const handleRemoveHiddenId = async (targetId: string) => {
    await safeRun(async () => {
      const curr = settings.hiddenRecentIds ?? [];
      const nextIds = curr.filter((id) => id !== targetId);
      await handlePatchSettings({ hiddenRecentIds: nextIds });
      await loadRecentDocs(
        recentTab,
        notebooks,
        recentReadsStore,
        settings.hideDailyNotesInRecent,
        settings.hiddenRecentNotebookIds ?? [],
        nextIds,
        recentNotebookId,
        recentKeyword,
        0,
        false,
      );
    }, '移除隐藏 ID 失败');
  };

  const handleChangeRecentNotebook = async (nbId: string) => {
    await safeRun(async () => {
      setRecentNotebookId(nbId);
      await loadRecentDocs(
        recentTab,
        notebooks,
        recentReadsStore,
        settings.hideDailyNotesInRecent,
        settings.hiddenRecentNotebookIds ?? [],
        settings.hiddenRecentIds ?? [],
        nbId,
        recentKeyword,
        0,
        false,
      );
    }, '筛选笔记本失败');
  };

  const handleChangeRecentKeyword = (kw: string) => {
    setRecentKeyword(kw);
    if (keywordTimerRef.current) clearTimeout(keywordTimerRef.current);
    keywordTimerRef.current = setTimeout(() => {
      void safeRun(
        () =>
          loadRecentDocs(
            recentTab,
            notebooks,
            recentReadsStore,
            settings.hideDailyNotesInRecent,
            settings.hiddenRecentNotebookIds ?? [],
            settings.hiddenRecentIds ?? [],
            recentNotebookId,
            kw,
            0,
            false,
          ),
        '搜索最近笔记失败',
      );
    }, 200);
  };

  const handleJumpToTagFilter = (tag: string) => {
    const kw = `#${tag}`;
    setActiveSubTab('notes');
    setRecentKeyword(kw);
    if (keywordTimerRef.current) clearTimeout(keywordTimerRef.current);
    void safeRun(
      () =>
        loadRecentDocs(
          recentTab,
          notebooks,
          recentReadsStore,
          settings.hideDailyNotesInRecent,
          settings.hiddenRecentNotebookIds ?? [],
          settings.hiddenRecentIds ?? [],
          recentNotebookId,
          kw,
          0,
          false,
        ),
      '按标签筛选笔记失败',
    );
  };

  // --- Habits handlers ---
  const handleCreateHabit = async (draft: CreateHabitDraft) => {
    await safeRun(async () => {
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
    }, '创建习惯失败');
  };

  const handleToggleHabitToday = async (habitId: string) => {
    await safeRun(async () => {
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
    }, '习惯打卡保存失败');
  };

  const handleUpdateHabitTodayDuration = async (habitId: string, minutes: number) => {
    await safeRun(async () => {
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
    }, '更新耗时失败');
  };

  const handleSetHabitDateCheckin = async (
    habitId: string,
    dateStr: string,
    payload: { done: boolean; durationMinutes?: number; note?: string },
  ) => {
    await safeRun(async () => {
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
    }, '更新补卡记录失败');
  };

  const handleUpdateHabit = async (habitId: string, patch: Partial<HabitItem>) => {
    await safeRun(async () => {
      const now = Date.now();
      const nextStore = await storage.updateHabits((curr) => ({
        ...curr,
        habits: curr.habits.map((h) => (h.id === habitId ? { ...h, ...patch, updatedAt: now } : h)),
      }));
      setHabitsStore(nextStore);
    }, '更新习惯失败');
  };

  const handleMoveHabitOrder = async (habitId: string, direction: 'up' | 'down') => {
    await safeRun(async () => {
      const now = Date.now();
      const nextStore = await storage.updateHabits((curr) => {
        const visible = curr.habits.filter((h) => !h.deleted && !h.archived);
        const others = curr.habits.filter((h) => h.deleted || h.archived);
        const reordered = moveItemOrder(visible, habitId, direction, now);
        return { ...curr, habits: [...reordered, ...others] };
      });
      setHabitsStore(nextStore);
    }, '调整习惯顺序失败');
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
    await safeRun(async () => {
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
    }, '创建任务失败');
  };

  const handleToggleTaskComplete = async (taskId: string) => {
    await safeRun(async () => {
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
    }, '更新任务状态失败');
  };

  const handleUpdateTask = async (taskId: string, patch: Partial<TaskItem>) => {
    await safeRun(async () => {
      const now = Date.now();
      const nextStore = await storage.updateTasks((curr) => ({
        ...curr,
        tasks: curr.tasks.map((t) => (t.id === taskId ? { ...t, ...patch, updatedAt: now } : t)),
      }));
      setTasksStore(nextStore);
    }, '更新任务失败');
  };

  const handleDeleteTask = async (taskId: string) => {
    await handleUpdateTask(taskId, { deleted: true });
  };

  const handleClearCompletedTasks = async () => {
    await safeRun(async () => {
      const now = Date.now();
      const nextStore = await storage.updateTasks((curr) => ({
        ...curr,
        tasks: curr.tasks.map((t) =>
          t.completed && !t.deleted ? { ...t, deleted: true, updatedAt: now } : t,
        ),
      }));
      setTasksStore(nextStore);
    }, '清空已完成任务失败');
  };

  const handleSaveCategories = async (categories: TaskCategory[]) => {
    await safeRun(async () => {
      const nextStore = await storage.updateTasks((curr) => ({
        ...curr,
        categories,
      }));
      setTasksStore(nextStore);
    }, '保存任务维度失败');
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
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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

  const topActiveTasks = useMemo(
    () => sortTasksByPriority(getActiveTasks(tasksStore.tasks)).slice(0, 5),
    [tasksStore.tasks],
  );
  const totalActiveTasks = useMemo(
    () => getActiveTasks(tasksStore.tasks).length,
    [tasksStore.tasks],
  );
  const doneHabitsTodayCount = useMemo(
    () =>
      visibleHabitsSorted.filter((h) =>
        Boolean(habitsStore.checkins[h.id]?.[todayStr]?.done),
      ).length,
    [visibleHabitsSorted, habitsStore.checkins, todayStr],
  );

  const noteCardPrefs = useMemo<NoteCardDisplayPrefs>(
    () => ({
      previewLines: settings.previewLines ?? DEFAULT_NOTE_CARD_PREFS.previewLines,
      showThumbnail: settings.showCardThumbnail ?? DEFAULT_NOTE_CARD_PREFS.showThumbnail,
      showTags: settings.showCardTags ?? DEFAULT_NOTE_CARD_PREFS.showTags,
      snippetJustify: settings.snippetJustify ?? DEFAULT_NOTE_CARD_PREFS.snippetJustify,
      snippetIndent: settings.snippetIndent ?? DEFAULT_NOTE_CARD_PREFS.snippetIndent,
      groupByDate: settings.groupNotesByDate ?? DEFAULT_NOTE_CARD_PREFS.groupByDate,
    }),
    [settings],
  );

  const handleChangeNoteCardPrefs = (patch: Partial<NoteCardDisplayPrefs>) => {
    const settingsPatch: Partial<PluginSettings> = {};
    if (patch.previewLines !== undefined) settingsPatch.previewLines = patch.previewLines;
    if (patch.showThumbnail !== undefined) settingsPatch.showCardThumbnail = patch.showThumbnail;
    if (patch.showTags !== undefined) settingsPatch.showCardTags = patch.showTags;
    if (patch.snippetJustify !== undefined) settingsPatch.snippetJustify = patch.snippetJustify;
    if (patch.snippetIndent !== undefined) settingsPatch.snippetIndent = patch.snippetIndent;
    if (patch.groupByDate !== undefined) settingsPatch.groupNotesByDate = patch.groupByDate;
    void handlePatchSettings(settingsPatch);
  };

  const activeTheme = useMemo(
    () => resolveActiveTheme(settings.activeThemeId, settings.customThemes),
    [settings.activeThemeId, settings.customThemes],
  );
  const effectiveTheme = previewTheme ?? activeTheme;

  const handleSelectTheme = (themeId: string) => {
    void handlePatchSettings({ activeThemeId: themeId });
  };

  const handleSaveCustomTheme = (saved: HomeThemePreset, activate: boolean) => {
    const curr = Array.isArray(settings.customThemes) ? settings.customThemes : [];
    const exists = curr.some((t) => t.id === saved.id);
    const nextList = exists ? curr.map((t) => (t.id === saved.id ? saved : t)) : [...curr, saved];
    void handlePatchSettings({
      customThemes: nextList,
      ...(activate ? { activeThemeId: saved.id } : {}),
    });
  };

  const handleDeleteCustomTheme = (themeId: string) => {
    const curr = Array.isArray(settings.customThemes) ? settings.customThemes : [];
    const nextList = curr.filter((t) => t.id !== themeId);
    const nextActiveId =
      settings.activeThemeId === themeId ? DEFAULT_THEME_ID : settings.activeThemeId;
    void handlePatchSettings({
      customThemes: nextList,
      activeThemeId: nextActiveId,
    });
  };

  const rootStyle = useMemo(() => {
    const vars: Record<string, string> = buildThemeCssVars(effectiveTheme);
    if (settings.followEditorFont && editorFontFamily) {
      const stack = editorFontFamily
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) =>
          /^['"].*['"]$/.test(p) ||
          /^(serif|sans-serif|monospace|cursive|fantasy|system-ui)$/i.test(p)
            ? p
            : `"${p}"`,
        )
        .join(', ');
      if (stack) {
        vars['--sph-font-editor'] = `${stack}, var(--b3-font-family-protyle, var(--sph-font-ui))`;
      }
    }
    return vars as React.CSSProperties;
  }, [effectiveTheme, settings.followEditorFont, editorFontFamily]);

  return (
    <div
      data-sph-theme-mode={effectiveTheme.mode}
      className={`sph-root ${settings.followEditorFont ? '' : 'sph-font-ui-only'}`}
      style={rootStyle}
    >
      {/* Top Minimal Editorial Navigation Bar */}
      <nav className="sph-nav-bar">
        <div className="max-w-[1160px] mx-auto px-6 sm:px-10 flex items-center justify-between gap-4">
          <div className="sph-nav-tabs" role="tablist" aria-label="个人主页功能页签">
            {SUB_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={activeSubTab === tab.key}
                  onClick={() => setActiveSubTab(tab.key)}
                  className="sph-nav-tab"
                >
                  <Icon size={15} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              className="sph-btn-ghost px-2.5 py-1.5 text-xs"
              aria-label="打开主题配色"
              onClick={() => setThemeStudioOpen(true)}
            >
              <Palette size={13} />
              <span className="hidden sm:inline">主题</span>
            </button>
            <button
              type="button"
              className="sph-btn-ghost px-2.5 py-1.5 text-xs"
              aria-label="刷新主页"
              disabled={refreshing}
              onClick={() => void bootstrapAll()}
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">刷新</span>
            </button>
            <button
              type="button"
              className="sph-btn-ghost px-2.5 py-1.5 text-xs"
              aria-label="打开设置"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings size={13} />
              <span className="hidden sm:inline">设置</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Container */}
      <main className="max-w-[1160px] mx-auto px-6 sm:px-10 py-8 sm:py-10 flex flex-col gap-9">
        {errorBanner && (
          <div
            className="rounded-xl px-4 py-3 text-xs flex items-center justify-between gap-2"
            style={{
              backgroundColor: 'rgba(190, 18, 60, 0.08)',
              border: '1px solid rgba(190, 18, 60, 0.22)',
              color: '#be123c',
            }}
          >
            <span>{errorBanner}</span>
            <button
              type="button"
              className="text-xs font-medium"
              style={{ color: '#be123c' }}
              onClick={() => setErrorBanner(null)}
            >
              关闭
            </button>
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {activeSubTab === 'overview' && (
          <>
            {/* Editorial Greeting Header */}
            <header className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-col gap-1">
                <p
                  className="text-[12.5px] tracking-[0.06em]"
                  style={{ color: 'var(--sph-subtle)' }}
                >
                  {formatChineseDateHeader(todayStr)}
                </p>
                <h1 className="text-[32px] sm:text-[36px] font-medium tracking-[0.03em] leading-tight">
                  {getGreeting()}
                </h1>
              </div>

              <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--sph-muted)' }}>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('plan')}
                  className="sph-btn px-3.5 py-2 sph-num-font"
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: 'var(--sph-accent)' }}
                  />
                  <span>
                    今日习惯 {doneHabitsTodayCount}/{visibleHabitsSorted.length} · 待办 {totalActiveTasks} 项
                  </span>
                </button>
              </div>
            </header>

            {/* Editorial Stat Strip + Full-Width Heatmap */}
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

            {/* Focus Row: Left Today's Journal + Right Today's Rhythm Snapshot */}
            <div className="sph-bento-grid">
              <div className="sph-bento-col-left h-full">
                <div className="sph-order-today h-full">
                  <TodayDailyNoteCard
                    todayStr={todayStr}
                    dailyNote={todayDailyNote}
                    loading={todayLoading}
                    mountProtyle={mountProtyle}
                    refreshNonce={protyleRefreshNonce}
                    onOpenDoc={openDoc}
                    onCreateToday={() => void handleClickDiaryDate(todayStr)}
                  />
                </div>
              </div>

              <div className="sph-bento-col-right h-full">
                <section className="flex flex-col gap-3 h-full">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[16px] font-medium tracking-wide">今日节奏</h2>
                    <button
                      type="button"
                      className="sph-btn-ghost px-2 py-1 text-xs"
                      onClick={() => setActiveSubTab('plan')}
                    >
                      <span>管理全部</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>

                  <div className="sph-panel p-5 flex flex-col gap-4 flex-1">
                    {/* Quick Habits Strip */}
                    <div className="flex flex-col gap-2">
                      <div className="text-xs" style={{ color: 'var(--sph-subtle)' }}>
                        习惯打卡
                      </div>
                      {visibleHabitsSorted.length === 0 ? (
                        <div className="text-xs" style={{ color: 'var(--sph-muted)' }}>
                          还没有设置习惯，去「计划与习惯」添加一个吧。
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {visibleHabitsSorted.map((h) => {
                            const done = Boolean(habitsStore.checkins[h.id]?.[todayStr]?.done);
                            return (
                              <button
                                key={h.id}
                                type="button"
                                onClick={() => void handleToggleHabitToday(h.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all"
                                style={{
                                  backgroundColor: done ? h.color : 'var(--sph-card)',
                                  color: done ? '#ffffff' : 'var(--sph-text)',
                                  border: `1px solid ${done ? h.color : 'var(--sph-hairline)'}`,
                                }}
                              >
                                {done ? <Check size={12} strokeWidth={3} /> : <span>{h.icon}</span>}
                                <span>{h.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Quick Priority Tasks */}
                    <div
                      className="flex flex-col gap-1.5 pt-3"
                      style={{ borderTop: '1px solid var(--sph-hairline)' }}
                    >
                      <div className="text-xs pb-0.5" style={{ color: 'var(--sph-subtle)' }}>
                        近期重点待办
                      </div>
                      {topActiveTasks.length === 0 ? (
                        <div className="text-xs py-1" style={{ color: 'var(--sph-muted)' }}>
                          暂无待办事项，享受清净的一天。
                        </div>
                      ) : (
                        topActiveTasks.map((t) => {
                          const pm = PRIORITY_BADGE[t.priority];
                          return (
                            <div
                              key={t.id}
                              className="flex items-center gap-2.5 py-1.5 text-[13.5px]"
                            >
                              <button
                                type="button"
                                aria-label={`完成任务 ${t.title}`}
                                onClick={() => void handleToggleTaskComplete(t.id)}
                                className="w-4 h-4 rounded-[5px] shrink-0 flex items-center justify-center"
                                style={{ border: '1.5px solid var(--sph-border-strong)' }}
                              />
                              <span
                                className="px-1.5 py-0.5 rounded text-[10.5px] shrink-0"
                                style={{ backgroundColor: pm.bg, color: pm.color }}
                              >
                                {pm.label}
                              </span>
                              <span className="truncate flex-1">{t.title}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {/* Selected Recent Notes Gallery */}
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2.5">
                  <h2 className="text-[16px] font-medium tracking-wide">近期笔记</h2>
                  <span className="text-xs" style={{ color: 'var(--sph-subtle)' }}>
                    {recentTab === 'modified' ? '按最近修改排序' : '按最近阅读排序'}
                  </span>
                </div>
                <button
                  type="button"
                  className="sph-btn-ghost px-2 py-1 text-xs"
                  onClick={() => setActiveSubTab('notes')}
                >
                  <span>进入全部笔记</span>
                  <ArrowRight size={13} />
                </button>
              </div>

              {recentItems.length === 0 ? (
                <div className="sph-panel py-8 text-center text-xs" style={{ color: 'var(--sph-muted)' }}>
                  暂无近期笔记
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {recentItems.slice(0, 4).map((doc) => {
                    const clampClass =
                      noteCardPrefs.previewLines > 0
                        ? `sph-line-clamp-${Math.max(1, Math.min(5, Math.round(noteCardPrefs.previewLines)))}`
                        : '';
                    const ovSnippetClass = [
                      clampClass,
                      noteCardPrefs.snippetJustify ? 'sph-snippet-justify' : '',
                      noteCardPrefs.snippetIndent ? 'sph-snippet-indent' : '',
                    ]
                      .filter(Boolean)
                      .join(' ');
                    return (
                      <article
                        key={doc.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openDoc(doc.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openDoc(doc.id);
                          }
                        }}
                        className="sph-doc-card p-4 sm:p-5 flex gap-4 cursor-pointer"
                      >
                        <div className="min-w-0 flex-1 flex flex-col justify-between gap-2.5">
                          <div>
                            <div className="flex items-center gap-1.5 text-[15.5px] font-medium leading-snug">
                              {doc.icon?.type === 'emoji' && (
                                <span className="text-sm shrink-0">{doc.icon.value}</span>
                              )}
                              <span className="truncate">{doc.title}</span>
                            </div>
                            {noteCardPrefs.previewLines > 0 && doc.snippet && (
                              <p
                                className={`text-[13.5px] mt-1.5 leading-relaxed ${ovSnippetClass}`}
                                style={{ color: 'var(--sph-muted)' }}
                              >
                                {doc.snippet}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center flex-wrap gap-1.5 text-[11.5px]" style={{ color: 'var(--sph-subtle)' }}>
                            {doc.notebookName && <span>{doc.notebookName}</span>}
                            {noteCardPrefs.showTags &&
                              doc.tags.slice(0, 2).map((tag) => (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleJumpToTagFilter(tag);
                                  }}
                                  className="sph-tag-pill"
                                >
                                  #{tag}
                                </button>
                              ))}
                            <span className="ml-auto sph-num-font shrink-0">
                              {formatRelativeTime(doc.readAtMs ?? doc.updatedAtMs, Date.now())}
                            </span>
                          </div>
                        </div>
                        {noteCardPrefs.showThumbnail && doc.thumbnailUrl && (
                          <div
                            className="w-20 h-20 rounded-xl overflow-hidden shrink-0 self-center"
                            style={{ border: '1px solid var(--sph-hairline)' }}
                          >
                            <img
                              src={doc.thumbnailUrl}
                              alt={doc.title}
                              loading="lazy"
                              className="sph-doc-thumb w-full h-full object-cover"
                            />
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {/* TAB 2: NOTES (Notebook Navigator Dual-Pane Studio) */}
        {activeSubTab === 'notes' && (
          <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-1">
              <h1 className="text-[28px] font-medium tracking-[0.03em] leading-tight">笔记浏览</h1>
              <p className="text-[13.5px]" style={{ color: 'var(--sph-muted)' }}>
                按笔记本、标签与最近读写快速回到你的思考上下文
              </p>
            </header>

            <RecentDocsCard
              navigatorMode
              viewMode={settings.recentViewMode ?? 'list'}
              onChangeViewMode={(mode) => void handlePatchSettings({ recentViewMode: mode })}
              displayPrefs={noteCardPrefs}
              onChangeDisplayPrefs={handleChangeNoteCardPrefs}
              activeTab={recentTab}
              onChangeTab={(tab) => void handleChangeRecentTab(tab)}
              items={recentItems}
              hasMore={recentHasMore}
              loading={recentLoading}
              hideDailyNotes={settings.hideDailyNotesInRecent}
              onToggleHideDailyNotes={() => void handleToggleHideDailyNotes()}
              hiddenNotebookIds={settings.hiddenRecentNotebookIds ?? []}
              hiddenIdsCount={(settings.hiddenRecentIds ?? []).length}
              onToggleHiddenNotebook={(nbId) => void handleToggleHiddenNotebook(nbId)}
              onOpenHiddenIdsSettings={() => setSettingsOpen(true)}
              diaryNotebookId={activeDiaryNotebookId}
              notebookId={recentNotebookId}
              notebooks={notebooks}
              onChangeNotebook={(nbId) => void handleChangeRecentNotebook(nbId)}
              keyword={recentKeyword}
              onChangeKeyword={(kw) => handleChangeRecentKeyword(kw)}
              onLoadMore={() =>
                void loadRecentDocs(
                  recentTab,
                  notebooks,
                  recentReadsStore,
                  settings.hideDailyNotesInRecent,
                  settings.hiddenRecentNotebookIds ?? [],
                  settings.hiddenRecentIds ?? [],
                  recentNotebookId,
                  recentKeyword,
                  recentOffset + PAGE_SIZE,
                  true,
                )
              }
              onOpenDoc={openDoc}
            />
          </div>
        )}

        {/* TAB 3: JOURNAL & CALENDAR */}
        {activeSubTab === 'journal' && (
          <div className="flex flex-col gap-8">
            <header className="flex flex-col gap-1">
              <h1 className="text-[28px] font-medium tracking-[0.03em] leading-tight">日记与日历</h1>
              <p className="text-[13.5px]" style={{ color: 'var(--sph-muted)' }}>
                点选日历任意一天即可原样预览当日日记，或一键按模板新建日记
              </p>
            </header>

            <div className="sph-journal-split">
              <MiniCalendarCard
                expanded
                year={calYear}
                month={calMonth}
                todayStr={todayStr}
                selectedDate={selectedJournalDate}
                weekStartDay={settings.weekStartDay}
                showTodoBadge={settings.showDiaryTodoBadge}
                daysMap={calendarDays}
                notebooks={notebooks}
                activeNotebookId={activeDiaryNotebookId}
                onChangeMonth={(y, m) => void handleChangeCalendarMonth(y, m)}
                onSelectNotebook={(nbId) => void handleSelectDiaryNotebook(nbId)}
                onClickDate={(d) => void handleSelectJournalDate(d)}
                onJumpToday={() => {
                  void handleChangeCalendarMonth(currentYear, currentMonth);
                  void handleSelectJournalDate(todayStr);
                }}
              />

              <TodayDailyNoteCard
                expanded
                todayStr={selectedJournalDate}
                heading={selectedJournalDate === todayStr ? '今日日记' : '日记预览'}
                createLabel={
                  selectedJournalDate === todayStr ? '写今天的日记' : '创建这一天的日记'
                }
                dailyNote={
                  selectedJournalDate === todayStr ? todayDailyNote : selectedJournalNote
                }
                loading={selectedJournalDate === todayStr ? todayLoading : selectedJournalLoading}
                mountProtyle={mountProtyle}
                refreshNonce={protyleRefreshNonce}
                onOpenDoc={openDoc}
                onCreateToday={() => void handleClickDiaryDate(selectedJournalDate)}
              />
            </div>

            <StatsHeatmapCard
              heatmapOnly
              stats={stats}
              heatmap={heatmapData.days}
              totalBlocksInYear={heatmapData.totalBlocks}
              activeDaysInYear={heatmapData.activeDays}
              year={heatmapYear}
              showHeatmap={true}
              weekStartDay={settings.weekStartDay}
              onChangeYear={(y) => void handleChangeHeatmapYear(y)}
              onToggleHeatmap={() => undefined}
              onClickDate={(d) => void handleClickDiaryDate(d)}
            />
          </div>
        )}

        {/* TAB 4: PLAN & HABITS */}
        {activeSubTab === 'plan' && (
          <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-1">
              <h1 className="text-[28px] font-medium tracking-[0.03em] leading-tight">计划与习惯</h1>
              <p className="text-[13.5px]" style={{ color: 'var(--sph-muted)' }}>
                不设焦虑的截止时间，只保留每天的习惯节律与按轻重缓急整理的待办
              </p>
            </header>

            <div className="sph-plan-split">
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
        )}
      </main>

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
        title={
          docPickerTarget?.kind === 'hiddenDoc'
            ? '选择要屏蔽的父文档（含其下全部子文档）'
            : '关联思源笔记'
        }
        onClose={() => setDocPickerTarget(null)}
        onSearch={(kw) => api.searchDocs(kw)}
        onSelect={(doc) => {
          if (!docPickerTarget) return;
          if (docPickerTarget.kind === 'task') {
            void handleUpdateTask(docPickerTarget.id, {
              linkedDocId: doc.id,
              linkedDocTitle: doc.title,
            });
          } else if (docPickerTarget.kind === 'habit') {
            void handleUpdateHabit(docPickerTarget.id, {
              linkedDocId: doc.id,
              linkedDocTitle: doc.title,
            });
          } else if (docPickerTarget.kind === 'hiddenDoc') {
            setHiddenIdLabels((prev) => ({ ...prev, [doc.id]: doc.title }));
            void handleAddHiddenIds([doc.id]);
          }
        }}
      />

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        activeTheme={activeTheme}
        notebooks={notebooks}
        diaryNotebookId={activeDiaryNotebookId}
        hiddenIdLabels={hiddenIdLabels}
        disableEscape={Boolean(docPickerTarget) || themeStudioOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenThemeStudio={() => {
          setSettingsOpen(false);
          setThemeStudioOpen(true);
        }}
        onChangeSettings={(patch) => void handlePatchSettings(patch)}
        onToggleHiddenNotebook={(nbId) => void handleToggleHiddenNotebook(nbId)}
        onAddHiddenIds={(ids) => void handleAddHiddenIds(ids)}
        onRemoveHiddenId={(id) => void handleRemoveHiddenId(id)}
        onPickHiddenDoc={() => setDocPickerTarget({ kind: 'hiddenDoc' })}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
      />

      <ThemeStudioModal
        open={themeStudioOpen}
        activeTheme={activeTheme}
        customThemes={settings.customThemes ?? []}
        onClose={() => setThemeStudioOpen(false)}
        onSelectTheme={handleSelectTheme}
        onSaveCustomTheme={handleSaveCustomTheme}
        onDeleteCustomTheme={handleDeleteCustomTheme}
        onPreviewTheme={setPreviewTheme}
      />
    </div>
  );
};
