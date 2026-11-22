import React, { useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import type { MonthCalendarDay, WeekStartDay } from '../domain/types';
import type { SiYuanNotebook } from '../services/siyuanApi';

export interface MiniCalendarCardProps {
  year: number;
  month: number; // 1..12
  todayStr: string;
  weekStartDay: WeekStartDay;
  showTodoBadge: boolean;
  daysMap: Record<string, MonthCalendarDay>;
  notebooks: SiYuanNotebook[];
  activeNotebookId: string;
  onChangeMonth: (year: number, month: number) => void;
  onSelectNotebook: (notebookId: string) => void;
  onClickDate: (dateStr: string) => void;
  onJumpToday: () => void;
}

export const MiniCalendarCard: React.FC<MiniCalendarCardProps> = ({
  year,
  month,
  todayStr,
  weekStartDay,
  showTodoBadge,
  daysMap,
  notebooks,
  activeNotebookId,
  onChangeMonth,
  onSelectNotebook,
  onClickDate,
  onJumpToday,
}) => {
  const openNotebooks = notebooks.filter((nb) => !nb.closed);
  const weekHeaders =
    weekStartDay === 1
      ? ['一', '二', '三', '四', '五', '六', '日']
      : ['日', '一', '二', '三', '四', '五', '六'];

  const cells = useMemo(() => {
    const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const leading = (firstDow - weekStartDay + 7) % 7;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const list: Array<{ date: string; day: number } | null> = [];
    for (let i = 0; i < leading; i++) list.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      list.push({ date, day: d });
    }
    return list;
  }, [year, month, weekStartDay]);

  const shiftMonth = (delta: number) => {
    const dt = new Date(Date.UTC(year, month - 1 + delta, 1));
    onChangeMonth(dt.getUTCFullYear(), dt.getUTCMonth() + 1);
  };

  return (
    <section className="sph-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ backgroundColor: 'var(--sph-accent-soft)', color: 'var(--sph-accent)' }}
          >
            <Calendar size={14} />
          </span>
          <h2 className="text-sm font-semibold m-0">日记月历</h2>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="sph-btn !p-1"
            aria-label="上个月"
            onClick={() => shiftMonth(-1)}
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-medium px-1.5 min-w-[74px] text-center">
            {year}年{month}月
          </span>
          <button
            type="button"
            className="sph-btn !p-1"
            aria-label="下个月"
            onClick={() => shiftMonth(1)}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <select
          aria-label="切换日记本"
          className="sph-input !py-1 !px-2 !text-xs flex-1 min-w-0"
          value={activeNotebookId}
          onChange={(e) => onSelectNotebook(e.target.value)}
          disabled={openNotebooks.length === 0}
        >
          {openNotebooks.length === 0 ? (
            <option value="">暂无已打开笔记本</option>
          ) : (
            openNotebooks.map((nb) => (
              <option key={nb.id} value={nb.id}>
                {nb.name}
              </option>
            ))
          )}
        </select>

        <button type="button" className="sph-btn !py-1 !px-2.5 shrink-0" onClick={onJumpToday}>
          今天
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {weekHeaders.map((w) => (
          <div key={w} className="text-[11px] py-1" style={{ color: 'var(--sph-muted)' }}>
            {w}
          </div>
        ))}

        {cells.map((cell, idx) => {
          if (!cell) {
            return <div key={`empty-${idx}`} className="h-8" />;
          }
          const info = daysMap[cell.date];
          const isToday = cell.date === todayStr;
          const hasDiary = Boolean(info?.hasDiary);
          const hasTodo = showTodoBadge && Boolean(info?.hasUnfinishedTodo);

          return (
            <button
              key={cell.date}
              type="button"
              aria-label={`${cell.date}${hasDiary ? ' 已有日记' : ''}`}
              onClick={() => onClickDate(cell.date)}
              className="relative h-8 rounded-lg border-0 flex flex-col items-center justify-center text-xs cursor-pointer transition-colors"
              style={{
                backgroundColor: isToday
                  ? 'var(--sph-accent)'
                  : hasDiary
                    ? 'var(--sph-accent-soft)'
                    : 'transparent',
                color: isToday ? 'var(--sph-accent-fg)' : 'var(--sph-text)',
                fontWeight: isToday || hasDiary ? 600 : 400,
              }}
            >
              <span>{cell.day}</span>
              {isToday && (
                <span
                  className="w-1 h-1 rounded-full mt-0.5"
                  style={{ backgroundColor: 'var(--sph-accent-fg)' }}
                />
              )}
              {hasTodo && (
                <span
                  data-testid={`cal-todo-badge-${cell.date}`}
                  title="日记含未完成待办"
                  className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: '#f59e0b' }}
                />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
};
