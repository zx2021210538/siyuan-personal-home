import { describe, expect, it } from 'vitest';
import {
  computeHabitStats,
  formatDurationMinutes,
  getCurrentWeekDots,
  getWeekStartDate,
} from '../../src/domain/habitStats';
import type { HabitCheckin, HabitItem } from '../../src/domain/types';

function makeHabit(overrides: Partial<HabitItem> = {}): HabitItem {
  return {
    id: 'h-1',
    name: '每日阅读',
    icon: '📖',
    color: '#3b82f6',
    frequencyType: 'daily',
    weeklyTarget: 7,
    trackDuration: false,
    createdAt: '2025-12-01',
    archived: false,
    sortOrder: 0,
    updatedAt: 1000,
    ...overrides,
  };
}

function makeCheckin(done = true, durationMinutes?: number): HabitCheckin {
  return {
    done,
    durationMinutes,
    checkedAt: 1000,
    updatedAt: 1000,
  };
}

describe('habitStats', () => {
  it('computes week start date for Monday and Sunday settings including year boundary', () => {
    // 2026-01-01 is Thursday
    expect(getWeekStartDate('2026-01-01', 1)).toBe('2025-12-29');
    expect(getWeekStartDate('2026-01-01', 0)).toBe('2025-12-28');
    // 2026-11-22 is Sunday
    expect(getWeekStartDate('2026-11-22', 1)).toBe('2026-11-16');
    expect(getWeekStartDate('2026-11-22', 0)).toBe('2026-11-22');
  });

  it('keeps daily streak alive before today is checked in and crosses year and leap-year boundaries', () => {
    const habit = makeHabit({ createdAt: '2025-12-20' });
    const yearBoundaryCheckins: Record<string, HabitCheckin> = {
      '2025-12-30': makeCheckin(true),
      '2025-12-31': makeCheckin(true),
      '2026-01-01': makeCheckin(true),
    };
    const stats = computeHabitStats(habit, yearBoundaryCheckins, '2026-01-02', 1);
    expect(stats.streakUnit).toBe('day');
    expect(stats.currentStreak).toBe(3);
    expect(stats.bestStreak).toBe(3);
    expect(stats.todayDone).toBe(false);
    expect(stats.totalDays).toBe(3);

    const leapHabit = makeHabit({ createdAt: '2024-02-20' });
    const leapCheckins: Record<string, HabitCheckin> = {
      '2024-02-28': makeCheckin(true),
      '2024-02-29': makeCheckin(true),
      '2024-03-01': makeCheckin(true),
    };
    const leapStats = computeHabitStats(leapHabit, leapCheckins, '2024-03-01', 1);
    expect(leapStats.currentStreak).toBe(3);
    expect(leapStats.bestStreak).toBe(3);
    expect(leapStats.todayDone).toBe(true);
  });

  it('computes weekly habit streak in consecutive goal-met calendar weeks across year boundary', () => {
    const habit = makeHabit({
      name: '力量训练',
      frequencyType: 'weekly',
      weeklyTarget: 3,
      createdAt: '2025-12-10',
    });
    // Week 1: 2025-12-15..2025-12-21 (3 checkins - met)
    // Week 2: 2025-12-22..2025-12-28 (3 checkins - met)
    // Week 3: 2025-12-29..2026-01-04 (3 checkins across year boundary - met)
    // Current Week 4: 2026-01-05..2026-01-11 (2 checkins so far - not yet met)
    const checkins: Record<string, HabitCheckin> = {
      '2025-12-15': makeCheckin(true),
      '2025-12-17': makeCheckin(true),
      '2025-12-19': makeCheckin(true),
      '2025-12-22': makeCheckin(true),
      '2025-12-24': makeCheckin(true),
      '2025-12-26': makeCheckin(true),
      '2025-12-30': makeCheckin(true),
      '2026-01-01': makeCheckin(true),
      '2026-01-03': makeCheckin(true),
      '2026-01-05': makeCheckin(true),
      '2026-01-07': makeCheckin(true),
    };
    const stats = computeHabitStats(habit, checkins, '2026-01-08', 1);
    expect(stats.streakUnit).toBe('week');
    expect(stats.currentStreak).toBe(3);
    expect(stats.bestStreak).toBe(3);
    expect(stats.thisWeekCount).toBe(2);
    expect(stats.weeklyTarget).toBe(3);

    // If current week also reaches 3 checkins, streak becomes 4
    const statsMet = computeHabitStats(
      habit,
      { ...checkins, '2026-01-08': makeCheckin(true) },
      '2026-01-08',
      1,
    );
    expect(statsMet.currentStreak).toBe(4);
    expect(statsMet.bestStreak).toBe(4);
    expect(statsMet.thisWeekCount).toBe(3);
  });

  it('aligns 7-dot strip to current calendar week with done/missed/future/isToday states', () => {
    // 2026-11-19 is Thursday; week (Mon start) is 2026-11-16..2026-11-22
    const checkins: Record<string, HabitCheckin> = {
      '2026-11-16': makeCheckin(true, 30),
      '2026-11-18': makeCheckin(false),
      '2026-11-19': makeCheckin(true, 45),
    };
    const dots = getCurrentWeekDots(checkins, '2026-11-19', 1);
    expect(dots).toHaveLength(7);
    expect(dots[0]).toEqual({ date: '2026-11-16', state: 'done', isToday: false, durationMinutes: 30 });
    expect(dots[1]).toEqual({ date: '2026-11-17', state: 'missed', isToday: false, durationMinutes: undefined });
    expect(dots[2]).toEqual({ date: '2026-11-18', state: 'missed', isToday: false, durationMinutes: undefined });
    expect(dots[3]).toEqual({ date: '2026-11-19', state: 'done', isToday: true, durationMinutes: 45 });
    expect(dots[4]).toEqual({ date: '2026-11-20', state: 'future', isToday: false, durationMinutes: undefined });
    expect(dots[6]).toEqual({ date: '2026-11-22', state: 'future', isToday: false, durationMinutes: undefined });
  });

  it('computes spanDays and duration minutes across today, current week, and all time', () => {
    const habit = makeHabit({
      trackDuration: true,
      defaultDurationMinutes: 30,
      createdAt: '2026-11-10',
    });
    const checkins: Record<string, HabitCheckin> = {
      '2026-11-08': makeCheckin(true, 20), // backfilled earlier than createdAt -> span starts here
      '2026-11-16': makeCheckin(true, 30),
      '2026-11-19': makeCheckin(true, 45),
    };
    const stats = computeHabitStats(habit, checkins, '2026-11-19', 1);
    expect(stats.totalDays).toBe(3);
    expect(stats.spanDays).toBe(12); // Nov 8 .. Nov 19 inclusive
    expect(stats.todayDurationMinutes).toBe(45);
    expect(stats.thisWeekDurationMinutes).toBe(75);
    expect(stats.totalDurationMinutes).toBe(95);

    expect(formatDurationMinutes(0)).toBe('0m');
    expect(formatDurationMinutes(45)).toBe('45m');
    expect(formatDurationMinutes(90)).toBe('1h 30m');
    expect(formatDurationMinutes(120)).toBe('2h');
  });

  it('ignores future-dated checkin entries when computing weekly counts and total duration', () => {
    const habit = makeHabit({ trackDuration: true, createdAt: '2026-11-16' });
    const checkins: Record<string, HabitCheckin> = {
      '2026-11-19': makeCheckin(true, 30),
      '2026-11-21': makeCheckin(true, 60), // future relative to today 2026-11-19
    };
    const stats = computeHabitStats(habit, checkins, '2026-11-19', 1);
    expect(stats.thisWeekCount).toBe(1);
    expect(stats.thisWeekDurationMinutes).toBe(30);
    expect(stats.totalDurationMinutes).toBe(30);
  });
});
