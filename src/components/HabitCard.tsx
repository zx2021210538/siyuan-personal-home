import React, { useState } from 'react';
import { Check, Clock, Flame, Plus, Sparkles } from 'lucide-react';
import { computeHabitStats, formatDurationMinutes } from '../domain/habitStats';
import type {
  HabitCheckin,
  HabitFrequencyType,
  HabitItem,
  WeekStartDay,
} from '../domain/types';

export interface CreateHabitDraft {
  name: string;
  icon: string;
  color: string;
  frequencyType: HabitFrequencyType;
  weeklyTarget: number;
  trackDuration: boolean;
  defaultDurationMinutes?: number;
}

export interface HabitCardProps {
  habits: HabitItem[];
  checkins: Record<string, Record<string, HabitCheckin>>;
  todayStr: string;
  weekStartDay: WeekStartDay;
  onToggleToday: (habitId: string) => void;
  onUpdateTodayDuration: (habitId: string, minutes: number) => void;
  onOpenDetail: (habitId: string) => void;
  onCreateHabit: (draft: CreateHabitDraft) => void;
}

const PRESET_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];

export const HabitCard: React.FC<HabitCardProps> = ({
  habits,
  checkins,
  todayStr,
  weekStartDay,
  onToggleToday,
  onUpdateTodayDuration,
  onOpenDetail,
  onCreateHabit,
}) => {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('✨');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [frequencyType, setFrequencyType] = useState<HabitFrequencyType>('daily');
  const [weeklyTarget, setWeeklyTarget] = useState(3);
  const [trackDuration, setTrackDuration] = useState(false);
  const [defaultDurationMinutes, setDefaultDurationMinutes] = useState(30);

  const [editingDurationId, setEditingDurationId] = useState<string | null>(null);
  const [durationDraft, setDurationDraft] = useState('');

  const visibleHabits = habits
    .filter((h) => !h.deleted && !h.archived)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const doneTodayCount = visibleHabits.filter((h) =>
    Boolean(checkins[h.id]?.[todayStr]?.done),
  ).length;
  const progressPct =
    visibleHabits.length > 0 ? Math.round((doneTodayCount / visibleHabits.length) * 100) : 0;

  const handleSubmitNew = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreateHabit({
      name: trimmed,
      icon: icon.trim() || '✨',
      color,
      frequencyType,
      weeklyTarget: frequencyType === 'daily' ? 7 : Math.max(1, Math.min(6, weeklyTarget)),
      trackDuration,
      defaultDurationMinutes: trackDuration ? Math.max(1, defaultDurationMinutes || 30) : undefined,
    });
    setName('');
    setIcon('✨');
    setFrequencyType('daily');
    setWeeklyTarget(3);
    setTrackDuration(false);
    setDefaultDurationMinutes(30);
    setCreating(false);
  };

  const commitDurationEdit = (habitId: string) => {
    if (durationDraft.trim() === '') {
      setEditingDurationId(null);
      return;
    }
    const parsed = Number(durationDraft);
    if (Number.isFinite(parsed) && parsed >= 0) {
      onUpdateTodayDuration(habitId, Math.round(parsed));
    }
    setEditingDurationId(null);
  };

  return (
    <section className="sph-card p-5 flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'var(--sph-accent-soft)', color: 'var(--sph-accent)' }}
          >
            <Sparkles size={14} />
          </span>
          <div className="flex items-baseline gap-2">
            <h2 className="text-[15px] font-semibold">习惯打卡</h2>
            <span className="text-xs sph-tabular" style={{ color: 'var(--sph-muted)' }}>
              {doneTodayCount}/{visibleHabits.length}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="sph-btn px-2.5 py-1 text-xs"
          onClick={() => setCreating((v) => !v)}
        >
          <Plus size={13} />
          <span>{creating ? '取消' : '新建'}</span>
        </button>
      </div>

      {visibleHabits.length > 0 && (
        <div
          className="h-1.5 w-full rounded-full overflow-hidden"
          style={{ backgroundColor: 'var(--sph-tile)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progressPct}%`,
              backgroundColor: 'var(--sph-accent)',
            }}
          />
        </div>
      )}

      {creating && (
        <form
          onSubmit={handleSubmitNew}
          className="rounded-xl p-3.5 flex flex-col gap-3"
          style={{
            backgroundColor: 'var(--sph-tile)',
            border: '1px solid var(--sph-border)',
          }}
        >
          <div className="flex gap-2">
            <input
              type="text"
              aria-label="习惯图标"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="sph-input w-11 text-center"
              maxLength={4}
            />
            <input
              type="text"
              aria-label="习惯名称"
              placeholder="习惯名称（如：每日阅读、力量训练）"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="sph-input flex-1"
              autoFocus
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <select
              aria-label="打卡频率"
              className="sph-select"
              value={frequencyType}
              onChange={(e) => setFrequencyType(e.target.value as HabitFrequencyType)}
            >
              <option value="daily">每天打卡</option>
              <option value="weekly">每周目标</option>
            </select>

            {frequencyType === 'weekly' && (
              <label className="inline-flex items-center gap-1" style={{ color: 'var(--sph-muted)' }}>
                <span>每周</span>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={weeklyTarget}
                  onChange={(e) => setWeeklyTarget(Number(e.target.value))}
                  className="sph-input w-14 py-1 text-xs text-center"
                />
                <span>次</span>
              </label>
            )}

            <label
              className="inline-flex items-center gap-1.5 cursor-pointer select-none"
              style={{ color: 'var(--sph-muted)' }}
            >
              <input
                type="checkbox"
                checked={trackDuration}
                onChange={(e) => setTrackDuration(e.target.checked)}
              />
              <span>记录耗时</span>
            </label>

            {trackDuration && (
              <label className="inline-flex items-center gap-1" style={{ color: 'var(--sph-muted)' }}>
                <span>默认</span>
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={defaultDurationMinutes}
                  onChange={(e) => setDefaultDurationMinutes(Number(e.target.value))}
                  className="sph-input w-16 py-1 text-xs text-center"
                />
                <span>分钟</span>
              </label>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`选择颜色 ${c}`}
                  onClick={() => setColor(c)}
                  className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    outline: color === c ? '2px solid var(--sph-text)' : 'none',
                    outlineOffset: '2px',
                  }}
                />
              ))}
            </div>
            <button type="submit" className="sph-btn sph-btn-primary px-3.5 py-1.5">
              保存习惯
            </button>
          </div>
        </form>
      )}

      {visibleHabits.length === 0 ? (
        <div
          className="rounded-xl py-7 px-4 text-center text-xs"
          style={{
            backgroundColor: 'var(--sph-tile)',
            color: 'var(--sph-muted)',
          }}
        >
          还没有习惯，点右上角「新建」开始养成你的第一个日常习惯。
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleHabits.map((habit) => {
            const habitCheckins = checkins[habit.id] ?? {};
            const stats = computeHabitStats(habit, habitCheckins, todayStr, weekStartDay);
            const streakText =
              stats.streakUnit === 'day'
                ? `连续 ${stats.currentStreak} 天`
                : `连续 ${stats.currentStreak} 周`;

            return (
              <div
                key={habit.id}
                className="sph-doc-row px-3.5 py-3 flex items-center gap-3"
              >
                <button
                  type="button"
                  aria-label={`打卡 ${habit.name}`}
                  onClick={() => onToggleToday(habit.id)}
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all"
                  style={{
                    backgroundColor: stats.todayDone ? habit.color : 'transparent',
                    border: `2px solid ${stats.todayDone ? habit.color : 'var(--sph-border-strong)'}`,
                    color: '#ffffff',
                    boxShadow: stats.todayDone
                      ? `0 2px 8px -1px color-mix(in srgb, ${habit.color} 55%, transparent)`
                      : 'none',
                  }}
                >
                  {stats.todayDone && <Check size={13} strokeWidth={3} />}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenDetail(habit.id)}
                      className="text-left text-[13px] font-semibold truncate flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                      style={{ color: 'var(--sph-text)' }}
                    >
                      <span>{habit.icon}</span>
                      <span className="truncate">{habit.name}</span>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0" aria-label="本周打卡状态">
                      {stats.weekDots.map((dot) => (
                        <span
                          key={dot.date}
                          title={`${dot.date}${dot.state === 'done' ? ' 已打卡' : ''}`}
                          className="inline-block rounded-full transition-transform"
                          style={{
                            width: dot.state === 'future' ? 5 : 7,
                            height: dot.state === 'future' ? 5 : 7,
                            backgroundColor:
                              dot.state === 'done'
                                ? habit.color
                                : dot.state === 'future'
                                  ? 'var(--sph-border-strong)'
                                  : 'transparent',
                            border:
                              dot.state === 'missed'
                                ? '1.5px solid var(--sph-subtle)'
                                : 'none',
                            outline: dot.isToday ? `1.5px solid ${habit.color}` : 'none',
                            outlineOffset: '1.5px',
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div
                    className="flex items-center flex-wrap gap-x-2.5 gap-y-1 mt-1.5 text-[11px] sph-tabular"
                    style={{ color: 'var(--sph-muted)' }}
                  >
                    <span className="inline-flex items-center gap-1 font-medium">
                      <Flame size={11} style={{ color: habit.color }} />
                      {streakText}
                    </span>
                    <span>
                      本周 {stats.thisWeekCount}/{stats.weeklyTarget}次
                    </span>
                    <span style={{ color: 'var(--sph-subtle)' }}>已坚持 {stats.spanDays} 天</span>

                    {habit.trackDuration &&
                      stats.todayDone &&
                      (editingDurationId === habit.id ? (
                        <input
                          type="number"
                          aria-label="今日耗时分钟"
                          min={0}
                          max={1440}
                          value={durationDraft}
                          autoFocus
                          onChange={(e) => setDurationDraft(e.target.value)}
                          onBlur={() => commitDurationEdit(habit.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.nativeEvent.isComposing)
                              commitDurationEdit(habit.id);
                            if (e.key === 'Escape') setEditingDurationId(null);
                          }}
                          className="sph-input py-0 px-1.5 w-14 text-[11px]"
                        />
                      ) : (
                        <button
                          type="button"
                          aria-label={`修改 ${habit.name} 今日耗时`}
                          onClick={() => {
                            setEditingDurationId(habit.id);
                            setDurationDraft(String(stats.todayDurationMinutes));
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium transition-opacity hover:opacity-80"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${habit.color} 14%, transparent)`,
                            color: habit.color,
                          }}
                        >
                          <Clock size={10} />
                          <span>{formatDurationMinutes(stats.todayDurationMinutes)}</span>
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
