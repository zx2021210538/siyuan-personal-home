import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Link2,
  Trash2,
  X,
} from 'lucide-react';
import { computeHabitStats, formatDurationMinutes } from '../domain/habitStats';
import type {
  HabitCheckin,
  HabitFrequencyType,
  HabitItem,
  WeekStartDay,
} from '../domain/types';

export interface HabitDetailModalProps {
  habit: HabitItem;
  checkins: Record<string, HabitCheckin>;
  todayStr: string;
  weekStartDay: WeekStartDay;
  isFirst: boolean;
  isLast: boolean;
  onClose: () => void;
  onSetDateCheckin: (
    habitId: string,
    dateStr: string,
    payload: { done: boolean; durationMinutes?: number; note?: string },
  ) => void;
  onUpdateHabit: (habitId: string, patch: Partial<HabitItem>) => void;
  onMoveOrder: (habitId: string, direction: 'up' | 'down') => void;
  onArchive: (habitId: string) => void;
  onDelete: (habitId: string) => void;
  onPickDoc: (habitId: string) => void;
  onOpenDoc: (docId: string) => void;
}

export const HabitDetailModal: React.FC<HabitDetailModalProps> = ({
  habit,
  checkins,
  todayStr,
  weekStartDay,
  isFirst,
  isLast,
  onClose,
  onSetDateCheckin,
  onUpdateHabit,
  onMoveOrder,
  onArchive,
  onDelete,
  onPickDoc,
  onOpenDoc,
}) => {
  const [viewYear, setViewYear] = useState(Number(todayStr.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(Number(todayStr.slice(5, 7)));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const [name, setName] = useState(habit.name);
  const [icon, setIcon] = useState(habit.icon);
  const [frequencyType, setFrequencyType] = useState<HabitFrequencyType>(habit.frequencyType);
  const [weeklyTarget, setWeeklyTarget] = useState(habit.weeklyTarget);
  const [trackDuration, setTrackDuration] = useState(habit.trackDuration);
  const [defaultDurationMinutes, setDefaultDurationMinutes] = useState(
    habit.defaultDurationMinutes ?? 30,
  );

  useEffect(() => {
    if (editing) return;
    setName(habit.name);
    setIcon(habit.icon);
    setFrequencyType(habit.frequencyType);
    setWeeklyTarget(habit.weeklyTarget);
    setTrackDuration(habit.trackDuration);
    setDefaultDurationMinutes(habit.defaultDurationMinutes ?? 30);
  }, [habit, editing]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const stats = useMemo(
    () => computeHabitStats(habit, checkins, todayStr, weekStartDay),
    [habit, checkins, todayStr, weekStartDay],
  );

  const monthCells = useMemo(() => {
    const firstDow = new Date(Date.UTC(viewYear, viewMonth - 1, 1)).getUTCDay();
    const leading = (firstDow - weekStartDay + 7) % 7;
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();
    const cells: Array<{ date: string; day: number } | null> = [];
    for (let i = 0; i < leading; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        date: `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        day: d,
      });
    }
    return cells;
  }, [viewYear, viewMonth, weekStartDay]);

  const shiftMonth = (delta: number) => {
    const dt = new Date(Date.UTC(viewYear, viewMonth - 1 + delta, 1));
    setViewYear(dt.getUTCFullYear());
    setViewMonth(dt.getUTCMonth() + 1);
  };

  const selectedEntry = selectedDate ? checkins[selectedDate] : undefined;
  const [noteDraft, setNoteDraft] = useState('');
  const [durDraft, setDurDraft] = useState('');

  const handleSelectDate = (dateStr: string) => {
    if (dateStr > todayStr) return;
    const existing = checkins[dateStr];
    setSelectedDate(dateStr);
    if (!existing?.done) {
      const defDur = habit.trackDuration ? habit.defaultDurationMinutes ?? 30 : undefined;
      onSetDateCheckin(habit.id, dateStr, {
        done: true,
        durationMinutes: defDur,
        note: existing?.note,
      });
      setNoteDraft(existing?.note ?? '');
      setDurDraft(String(defDur ?? 30));
    } else {
      setNoteDraft(existing.note ?? '');
      setDurDraft(String(existing.durationMinutes ?? habit.defaultDurationMinutes ?? 30));
    }
  };

  const saveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onUpdateHabit(habit.id, {
      name: trimmed,
      icon: icon.trim() || '✨',
      frequencyType,
      weeklyTarget: frequencyType === 'daily' ? 7 : Math.max(1, Math.min(6, weeklyTarget)),
      trackDuration,
      defaultDurationMinutes: trackDuration ? Math.max(1, defaultDurationMinutes || 30) : undefined,
    });
    setEditing(false);
  };

  const weekHeaders =
    weekStartDay === 1
      ? ['一', '二', '三', '四', '五', '六', '日']
      : ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div
      className="sph-backdrop fixed inset-0 z-[1000] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="sph-modal w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg">{habit.icon}</span>
            <h3 className="text-base font-semibold m-0 truncate">{habit.name}</h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="sph-btn !p-1.5"
              aria-label="上移习惯"
              disabled={isFirst}
              onClick={() => onMoveOrder(habit.id, 'up')}
            >
              <ArrowUp size={13} />
            </button>
            <button
              type="button"
              className="sph-btn !p-1.5"
              aria-label="下移习惯"
              disabled={isLast}
              onClick={() => onMoveOrder(habit.id, 'down')}
            >
              <ArrowDown size={13} />
            </button>
            <button
              type="button"
              className="sph-btn !px-2 !py-1"
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? '完成编辑' : '编辑'}
            </button>
            <button type="button" className="sph-btn !p-1.5" aria-label="关闭" onClick={onClose}>
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-xl p-2.5" style={{ backgroundColor: 'var(--sph-surface)' }}>
            <div className="text-[11px]" style={{ color: 'var(--sph-muted)' }}>
              当前 / 最长连击
            </div>
            <div className="text-sm font-semibold mt-0.5">
              {stats.currentStreak} / {stats.bestStreak} {stats.streakUnit === 'day' ? '天' : '周'}
            </div>
          </div>
          <div className="rounded-xl p-2.5" style={{ backgroundColor: 'var(--sph-surface)' }}>
            <div className="text-[11px]" style={{ color: 'var(--sph-muted)' }}>
              累计 / 已坚持
            </div>
            <div className="text-sm font-semibold mt-0.5">
              {stats.totalDays} 天 / {stats.spanDays} 天
            </div>
          </div>
          <div className="rounded-xl p-2.5" style={{ backgroundColor: 'var(--sph-surface)' }}>
            <div className="text-[11px]" style={{ color: 'var(--sph-muted)' }}>
              本周完成
            </div>
            <div className="text-sm font-semibold mt-0.5">
              {stats.thisWeekCount} / {stats.weeklyTarget} 次
            </div>
          </div>
          <div className="rounded-xl p-2.5" style={{ backgroundColor: 'var(--sph-surface)' }}>
            <div className="text-[11px]" style={{ color: 'var(--sph-muted)' }}>
              {habit.trackDuration ? '本周 / 累计耗时' : '创建日期'}
            </div>
            <div className="text-sm font-semibold mt-0.5">
              {habit.trackDuration
                ? `${formatDurationMinutes(stats.thisWeekDurationMinutes)} / ${formatDurationMinutes(stats.totalDurationMinutes)}`
                : habit.createdAt}
            </div>
          </div>
        </div>

        {editing && (
          <form
            onSubmit={saveEdit}
            className="rounded-xl p-3 flex flex-col gap-2.5"
            style={{ backgroundColor: 'var(--sph-surface)', border: '1px solid var(--sph-border)' }}
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="sph-input w-12 text-center"
                maxLength={4}
              />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="sph-input flex-1"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
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
            <div className="flex justify-end">
              <button type="submit" className="sph-btn sph-btn-primary">
                保存修改
              </button>
            </div>
          </form>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">月度打卡记录（点空白日补卡，点已打日编辑或取消）</span>
            <div className="flex items-center gap-1">
              <button type="button" className="sph-btn !p-1" onClick={() => shiftMonth(-1)}>
                <ChevronLeft size={13} />
              </button>
              <span className="text-xs px-1">
                {viewYear}年{viewMonth}月
              </span>
              <button type="button" className="sph-btn !p-1" onClick={() => shiftMonth(1)}>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {weekHeaders.map((w) => (
              <div key={w} className="text-[11px] py-1" style={{ color: 'var(--sph-muted)' }}>
                {w}
              </div>
            ))}
            {monthCells.map((cell, idx) => {
              if (!cell) return <div key={`e-${idx}`} className="h-8" />;
              const entry = checkins[cell.date];
              const isDone = Boolean(entry?.done);
              const isFuture = cell.date > todayStr;
              return (
                <button
                  key={cell.date}
                  type="button"
                  disabled={isFuture}
                  aria-label={`补卡 ${cell.date}`}
                  onClick={() => handleSelectDate(cell.date)}
                  className="h-8 rounded-lg border-0 text-xs cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: isDone ? habit.color : 'var(--sph-surface)',
                    color: isDone ? '#ffffff' : 'var(--sph-text)',
                  }}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {selectedDate && selectedEntry?.done && (
            <div
              className="rounded-xl p-2.5 flex flex-wrap items-center gap-2 text-xs"
              style={{ backgroundColor: 'var(--sph-surface)' }}
            >
              <span className="font-medium">{selectedDate}</span>
              {habit.trackDuration && (
                <label className="inline-flex items-center gap-1">
                  <span>耗时</span>
                  <input
                    type="number"
                    min={0}
                    max={1440}
                    value={durDraft}
                    onChange={(e) => setDurDraft(e.target.value)}
                    className="sph-input w-16 !py-0.5 !text-xs text-center"
                  />
                  <span>分</span>
                </label>
              )}
              <input
                type="text"
                placeholder="一句话备注（可选）"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                className="sph-input flex-1 !py-0.5 !text-xs"
              />
              <button
                type="button"
                className="sph-btn sph-btn-primary !py-0.5"
                onClick={() => {
                  onSetDateCheckin(habit.id, selectedDate, {
                    done: true,
                    durationMinutes: habit.trackDuration ? Math.max(0, Number(durDraft) || 0) : undefined,
                    note: noteDraft.trim() || undefined,
                  });
                }}
              >
                更新当日
              </button>
              <button
                type="button"
                className="sph-btn !py-0.5"
                style={{ color: '#ef4444' }}
                onClick={() => {
                  onSetDateCheckin(habit.id, selectedDate, {
                    done: false,
                    durationMinutes: undefined,
                    note: selectedEntry.note,
                  });
                  setSelectedDate(null);
                }}
              >
                取消打卡
              </button>
            </div>
          )}
        </div>

        <div
          className="flex items-center justify-between gap-2 pt-3"
          style={{ borderTop: '1px solid var(--sph-border)' }}
        >
          <div className="flex items-center gap-1.5">
            {habit.linkedDocId ? (
              <button
                type="button"
                className="sph-btn"
                onClick={() => onOpenDoc(habit.linkedDocId!)}
              >
                <ExternalLink size={12} />
                <span>{habit.linkedDocTitle || '打开关联笔记'}</span>
              </button>
            ) : null}
            <button type="button" className="sph-btn" onClick={() => onPickDoc(habit.id)}>
              <Link2 size={12} />
              <span>{habit.linkedDocId ? '更换笔记' : '关联笔记'}</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button type="button" className="sph-btn" onClick={() => onArchive(habit.id)}>
              <Archive size={12} />
              <span>归档</span>
            </button>
            <button
              type="button"
              className="sph-btn"
              style={{ color: '#ef4444' }}
              onClick={() => onDelete(habit.id)}
            >
              <Trash2 size={12} />
              <span>删除</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
