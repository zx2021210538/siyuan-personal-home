import React, { useState } from 'react';
import { Check, Clock, Flame, Plus } from 'lucide-react';
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

const PRESET_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#d97706', '#e11d48', '#0891b2'];

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

  const weekDayChars =
    weekStartDay === 1
      ? ['一', '二', '三', '四', '五', '六', '日']
      : ['日', '一', '二', '三', '四', '五', '六'];

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
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-[17px] font-semibold tracking-wide">习惯打卡</h2>
          <span className="text-xs sph-num-font" style={{ color: 'var(--sph-muted)' }}>
            今日 {doneTodayCount}/{visibleHabits.length}
          </span>
        </div>

        <button
          type="button"
          className="sph-btn px-3 py-1 text-xs"
          onClick={() => setCreating((v) => !v)}
        >
          <Plus size={13} />
          <span>{creating ? '取消' : '新建'}</span>
        </button>
      </div>

      {visibleHabits.length > 0 && (
        <div
          className="h-1 w-full rounded-full overflow-hidden"
          style={{ backgroundColor: 'var(--sph-wash)' }}
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
        <form onSubmit={handleSubmitNew} className="sph-panel p-4 flex flex-col gap-3">
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
              placeholder="习惯名称（如：深度阅读、力量训练）"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="sph-input flex-1"
              autoFocus
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
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

          <div className="flex items-center justify-between gap-2 pt-1">
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
            <button type="submit" className="sph-btn sph-btn-primary px-4 py-1.5">
              保存习惯
            </button>
          </div>
        </form>
      )}

      {visibleHabits.length === 0 ? (
        <div className="sph-panel py-10 px-4 text-center text-[13px]" style={{ color: 'var(--sph-muted)' }}>
          还没有习惯，点右上角「新建」开始养成你的第一个日常习惯。
        </div>
      ) : (
        <div className="flex flex-col gap-3">
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
                className="sph-doc-card px-4 py-3.5 flex items-center gap-3.5"
              >
                <button
                  type="button"
                  aria-label={`打卡 ${habit.name}`}
                  onClick={() => onToggleToday(habit.id)}
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all"
                  style={{
                    backgroundColor: stats.todayDone ? habit.color : 'transparent',
                    border: `2px solid ${stats.todayDone ? habit.color : 'var(--sph-border-strong)'}`,
                    color: '#ffffff',
                  }}
                >
                  {stats.todayDone && <Check size={14} strokeWidth={3} />}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onOpenDetail(habit.id)}
                      className="text-left text-[15px] font-semibold truncate flex items-center gap-1.5 hover:opacity-75 transition-opacity"
                      style={{ color: 'var(--sph-text)' }}
                    >
                      <span>{habit.icon}</span>
                      <span className="truncate">{habit.name}</span>
                    </button>

                    <div className="flex items-center gap-2 shrink-0" aria-label="本周打卡状态">
                      {stats.weekDots.map((dot, idx) => (
                        <div key={dot.date} className="flex flex-col items-center gap-1">
                          <span
                            className="text-[9.5px] leading-none select-none"
                            style={{ color: dot.isToday ? habit.color : 'var(--sph-subtle)' }}
                          >
                            {weekDayChars[idx]}
                          </span>
                          <span
                            title={`${dot.date}${dot.state === 'done' ? ' 已打卡' : ''}`}
                            className="inline-block rounded-full"
                            style={{
                              width: dot.state === 'future' ? 6 : 8,
                              height: dot.state === 'future' ? 6 : 8,
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
                        </div>
                      ))}
                    </div>
                  </div>

                  <div
                    className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2 text-xs sph-num-font"
                    style={{ color: 'var(--sph-muted)' }}
                  >
                    <span className="inline-flex items-center gap-1 font-medium">
                      <Flame size={12} style={{ color: habit.color }} />
                      {streakText}
                    </span>
                    <span>
                      本周 {stats.thisWeekCount}/{stats.weeklyTarget} 次
                    </span>
                    <span style={{ color: 'var(--sph-subtle)' }}>已坚持 {stats.spanDays} 天</span>
                    {habit.trackDuration && stats.totalDurationMinutes > 0 && (
                      <span style={{ color: 'var(--sph-subtle)' }}>
                        累计 {formatDurationMinutes(stats.totalDurationMinutes)}
                      </span>
                    )}

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
                          className="sph-input py-0 px-1.5 w-14 text-xs"
                        />
                      ) : (
                        <button
                          type="button"
                          aria-label={`修改 ${habit.name} 今日耗时`}
                          onClick={() => {
                            setEditingDurationId(habit.id);
                            setDurationDraft(String(stats.todayDurationMinutes));
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium hover:opacity-80"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${habit.color} 13%, transparent)`,
                            color: habit.color,
                          }}
                        >
                          <Clock size={10} />
                          <span>今日 {formatDurationMinutes(stats.todayDurationMinutes)}</span>
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
