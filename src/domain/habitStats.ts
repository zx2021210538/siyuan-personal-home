import type { HabitCheckin, HabitItem, WeekStartDay } from './types';

const MS_PER_DAY = 86_400_000;

export interface WeekDot {
  date: string;
  state: 'done' | 'missed' | 'future';
  isToday: boolean;
  durationMinutes?: number;
}

export interface HabitStats {
  currentStreak: number;
  bestStreak: number;
  streakUnit: 'day' | 'week';
  thisWeekCount: number;
  weeklyTarget: number;
  totalDays: number;
  spanDays: number;
  todayDone: boolean;
  todayDurationMinutes: number;
  thisWeekDurationMinutes: number;
  totalDurationMinutes: number;
  weekDots: WeekDot[];
}

export function parseDateToUtcMs(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1);
}

export function formatUtcMsToDate(utcMs: number): string {
  const dt = new Date(utcMs);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(dateStr: string, delta: number): string {
  return formatUtcMsToDate(parseDateToUtcMs(dateStr) + delta * MS_PER_DAY);
}

export function diffDays(startDateStr: string, endDateStr: string): number {
  return Math.round((parseDateToUtcMs(endDateStr) - parseDateToUtcMs(startDateStr)) / MS_PER_DAY);
}

export function getWeekStartDate(dateStr: string, weekStartDay: WeekStartDay): string {
  const utcMs = parseDateToUtcMs(dateStr);
  const dayOfWeek = new Date(utcMs).getUTCDay(); // 0=Sun..6=Sat
  const offset = (dayOfWeek - weekStartDay + 7) % 7;
  return formatUtcMsToDate(utcMs - offset * MS_PER_DAY);
}

export function getCurrentWeekDots(
  checkins: Record<string, HabitCheckin>,
  todayStr: string,
  weekStartDay: WeekStartDay,
): WeekDot[] {
  const weekStart = getWeekStartDate(todayStr, weekStartDay);
  const dots: WeekDot[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    const entry = checkins[date];
    const isToday = date === todayStr;
    let state: WeekDot['state'];
    if (date > todayStr) {
      state = 'future';
    } else if (entry?.done) {
      state = 'done';
    } else {
      state = 'missed';
    }
    dots.push({
      date,
      state,
      isToday,
      durationMinutes: entry?.done ? entry.durationMinutes : undefined,
    });
  }
  return dots;
}

export function formatDurationMinutes(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  if (safe < 60) {
    return `${safe}m`;
  }
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function computeHabitStats(
  habit: HabitItem,
  checkins: Record<string, HabitCheckin>,
  todayStr: string,
  weekStartDay: WeekStartDay,
): HabitStats {
  const doneDates = Object.entries(checkins)
    .filter(([date, c]) => Boolean(c?.done) && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= todayStr)
    .map(([date]) => date)
    .sort();

  const doneSet = new Set(doneDates);
  const todayEntry = checkins[todayStr];
  const todayDone = Boolean(todayEntry?.done);
  const todayDurationMinutes = todayDone ? Math.max(0, todayEntry?.durationMinutes ?? 0) : 0;

  const weekDots = getCurrentWeekDots(checkins, todayStr, weekStartDay);
  const weekStart = weekDots[0].date;
  const weekEnd = weekDots[6].date;

  let thisWeekCount = 0;
  let thisWeekDurationMinutes = 0;
  let totalDurationMinutes = 0;

  for (const [date, entry] of Object.entries(checkins)) {
    if (!entry?.done || date > todayStr) continue;
    const dur = Math.max(0, entry.durationMinutes ?? 0);
    totalDurationMinutes += dur;
    if (date >= weekStart && date <= weekEnd) {
      thisWeekCount += 1;
      thisWeekDurationMinutes += dur;
    }
  }

  const totalDays = doneDates.length;
  const createdAnchor = /^\d{4}-\d{2}-\d{2}$/.test(habit.createdAt) ? habit.createdAt : todayStr;
  const earliest = doneDates.length > 0 && doneDates[0] < createdAnchor ? doneDates[0] : createdAnchor;
  const spanDays = Math.max(1, diffDays(earliest, todayStr) + 1);

  const weeklyTarget = habit.frequencyType === 'daily' ? 7 : Math.max(1, Math.min(6, habit.weeklyTarget || 1));

  if (habit.frequencyType === 'daily') {
    let currentStreak = 0;
    let cursor = todayDone ? todayStr : addDays(todayStr, -1);
    while (doneSet.has(cursor)) {
      currentStreak += 1;
      cursor = addDays(cursor, -1);
    }

    let bestStreak = 0;
    let run = 0;
    let prevDate: string | null = null;
    for (const d of doneDates) {
      if (prevDate && diffDays(prevDate, d) === 1) {
        run += 1;
      } else {
        run = 1;
      }
      if (run > bestStreak) bestStreak = run;
      prevDate = d;
    }

    return {
      currentStreak,
      bestStreak,
      streakUnit: 'day',
      thisWeekCount,
      weeklyTarget,
      totalDays,
      spanDays,
      todayDone,
      todayDurationMinutes,
      thisWeekDurationMinutes,
      totalDurationMinutes,
      weekDots,
    };
  }

  // Weekly habit: streak measured in consecutive goal-met calendar weeks
  const weekCounts = new Map<string, number>();
  for (const d of doneDates) {
    const ws = getWeekStartDate(d, weekStartDay);
    weekCounts.set(ws, (weekCounts.get(ws) ?? 0) + 1);
  }

  const metWeeks = Array.from(weekCounts.entries())
    .filter(([, count]) => count >= weeklyTarget)
    .map(([ws]) => ws)
    .sort();
  const metSet = new Set(metWeeks);

  const currentWeekStart = getWeekStartDate(todayStr, weekStartDay);
  let currentStreak = 0;
  let weekCursor = metSet.has(currentWeekStart)
    ? currentWeekStart
    : addDays(currentWeekStart, -7);
  while (metSet.has(weekCursor)) {
    currentStreak += 1;
    weekCursor = addDays(weekCursor, -7);
  }

  let bestStreak = 0;
  let weekRun = 0;
  let prevWeek: string | null = null;
  for (const ws of metWeeks) {
    if (prevWeek && diffDays(prevWeek, ws) === 7) {
      weekRun += 1;
    } else {
      weekRun = 1;
    }
    if (weekRun > bestStreak) bestStreak = weekRun;
    prevWeek = ws;
  }

  return {
    currentStreak,
    bestStreak,
    streakUnit: 'week',
    thisWeekCount,
    weeklyTarget,
    totalDays,
    spanDays,
    todayDone,
    todayDurationMinutes,
    thisWeekDurationMinutes,
    totalDurationMinutes,
    weekDots,
  };
}
