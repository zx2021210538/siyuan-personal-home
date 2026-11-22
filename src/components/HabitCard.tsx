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
    const parsed = Number(durationDraft);
    if (Number.isFinite(parsed) && parsed >= 0) {
      onUpdateTodayDuration(habitId, Math.round(parsed));
    }
    setEditingDurationId(null);
  };

  return (
    <section className="sph-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ backgroundColor: 'var(--sph-accent-soft)', color: 'var(--sph-accent)' }}
          >
            <Sparkles size={14} />
          </span>
          <h2 className="text-sm font-semibold m-0">习惯打卡</h2>
          <span className="text-xs" style={{ color: 'var(--sph-muted)' }}>
            {visibleHabits.filter((h) => Boolean(checkins[h.id]?.[todayStr]?.done)).length}/
            {visibleHabits.length}
          </span>
        </div>

        <button
          type="button"
          className="sph-btn !py-1 !px-2"
          onClick={() => setCreating((v) => !v)}
        >
          <Plus size={13} />
          <span>{creating ? '取消' : '新建'}</span>
        </button>
      </div>

      {creating && (
        <form
          onSubmit={handleSubmitNew}
          className="rounded-xl p-3 flex flex-col gap-2.5"
          style={{
            backgroundColor: 'var(--sph-surface)',
            border: '1px solid var(--sph-border)',
          }}
        >
          <div className="flex gap-2">
            <input
              type="text"
              aria-label="习惯图标"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="sph-input w-12 text-center"
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

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              aria-label="打卡频率"
              className="sph-input !py-1 !text-xs"
              value={frequencyType}
              onChange={(e) => setFrequencyType(e.target.value as HabitFrequencyType)}
            >
              <option value="daily">每天打卡</option>
              <option value="weekly">每周目标</option>
            </select>

            {frequencyType === 'weekly' && (
              <label className="inline-flex items-center gap-1">
                <span>每周</span>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={weeklyTarget}
                  onChange={(e) => setWeeklyTarget(Number(e.target.value))}
                  className="sph-input w-14 !py-1 !text-xs text-center"
                />
                <span>次</span>
              </label>
            )}

            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={trackDuration}
                onChange={(e) => setTrackDuration(e.target.checked)}
              />
              <span>记录耗时</span>
            </label>

            {trackDuration && (
              <label className="inline-flex items-center gap-1">
                <span>默认</span>
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={defaultDurationMinutes}
                  onChange={(e) => setDefaultDurationMinutes(Number(e.target.value))}
                  className="sph-input w-16 !py-1 !text-xs text-center"
                />
                <span>分钟</span>
              </label>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`选择颜色 ${c}`}
                  onClick={() => setColor(c)}
                  className="w-5 h-5 rounded-full border-0 cursor-pointer"
                  style={{
                    backgroundColor: c,
                    outline: color === c ? '2px solid var(--sph-text)' : 'none',
                    outlineOffset: '2px',
                  }}
                />
              ))}
            </div>
            <button type="submit" className="sph-btn sph-btn-primary">
              保存习惯
            </button>
          </div>
        </form>
      )}

      {visibleHabits.length === 0 ? (
        <div
          className="rounded-xl py-6 px-4 text-center text-xs"
          style={{
            backgroundColor: 'var(--sph-surface)',
            color: 'var(--sph-muted)',
            border: '1px dashed var(--sph-border)',
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
                className="rounded-xl px-3 py-2.5 flex items-center gap-2.5"
                style={{
                  backgroundColor: 'var(--sph-surface)',
                  border: '1px solid var(--sph-border)',
                }}
              >
                <button
                  type="button"
                  aria-label={`打卡 ${habit.name}`}
                  onClick={() => onToggleToday(habit.id)}
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                  style={{
                    backgroundColor: stats.todayDone ? habit.color : 'transparent',
                    border: `2px solid ${stats.todayDone ? habit.color : 'var(--sph-border)'}`,
                    color: '#ffffff',
                  }}
                >
                  {stats.todayDone && <Check size={14} strokeWidth={3} />}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenDetail(habit.id)}
                      className="text-left text-xs font-medium bg-transparent border-0 p-0 cursor-pointer truncate flex items-center gap-1.5"
                      style={{ color: 'var(--sph-text)' }}
                    >
                      <span>{habit.icon}</span>
                      <span className="truncate">{habit.name}</span>
                    </button>

                    <div className="flex items-center gap-1 shrink-0" aria-label="本周打卡状态">
                      {stats.weekDots.map((dot) => (
                        <span
                          key={dot.date}
                          title={`${dot.date}${dot.state === 'done' ? ' 已打卡' : ''}`}
                          className="inline-block rounded-full"
                          style={{
                            width: dot.state === 'future' ? 5 : 7,
                            height: dot.state === 'future' ? 5 : 7,
                            backgroundColor:
                              dot.state === 'done'
                                ? habit.color
                                : dot.state === 'future'
                                  ? 'var(--sph-border)'
                                  : 'transparent',
                            border:
                              dot.state === 'missed'
                                ? '1.5px solid var(--sph-muted)'
                                : 'none',
                            outline: dot.isToday ? `1.5px solid ${habit.color}` : 'none',
                            outlineOffset: '1.5px',
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div
                    className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1 text-[11px]"
                    style={{ color: 'var(--sph-muted)' }}
                  >
                    <span className="inline-flex items-center gap-0.5">
                      <Flame size={11} style={{ color: habit.color }} />
                      {streakText}
                    </span>
                    <span>
                      本周 {stats.thisWeekCount}/{stats.weeklyTarget}次
                    </span>
                    <span>已坚持 {stats.spanDays} 天</span>

                    {habit.trackDuration && stats.todayDone && (
                      editingDurationId === habit.id ? (
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
                            if (e.key === 'Enter') commitDurationEdit(habit.id);
                            if (e.key === 'Escape') setEditingDurationId(null);
                          }}
                          className="sph-input !py-0 !px-1.5 w-14 !text-[11px]"
                        />
                      ) : (
                        <button
                          type="button"
                          aria-label={`修改 ${habit.name} 今日耗时`}
                          onClick={() => {
                            setEditingDurationId(habit.id);
                            setDurationDraft(String(stats.todayDurationMinutes));
                          }}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full border-0 cursor-pointer text-[10px]"
                          style={{
                            backgroundColor: 'var(--sph-accent-soft)',
                            color: 'var(--sph-accent)',
                          }}
                        >
                          <Clock size={10} />
                          <span>{formatDurationMinutes(stats.todayDurationMinutes)}</span>
                        </button>
                      )
                    )}
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
