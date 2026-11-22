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
    <section className="sph-card p-5 flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'var(--sph-accent-soft)', color: 'var(--sph-accent)' }}
          >
            <Calendar size={14} />
          </span>
          <h2 className="text-[15px] font-semibold">日记月历</h2>
        </div>

        <div
          className="inline-flex items-center rounded-lg p-0.5"
          style={{ backgroundColor: 'var(--sph-tile)' }}
        >
          <button
            type="button"
            className="sph-btn-ghost !p-1"
            aria-label="上个月"
            onClick={() => shiftMonth(-1)}
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-medium px-2 min-w-[76px] text-center sph-tabular">
            {year}年{month}月
          </span>
          <button
            type="button"
            className="sph-btn-ghost !p-1"
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
          className="sph-select flex-1 min-w-0"
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

        <button
          type="button"
          className="sph-btn px-3 py-1.5 shrink-0"
          onClick={onJumpToday}
        >
          今天
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center pt-0.5">
        {weekHeaders.map((w) => (
          <div
            key={w}
            className="text-[11px] font-medium py-1 select-none"
            style={{ color: 'var(--sph-subtle)' }}
          >
            {w}
          </div>
        ))}

        {cells.map((cell, idx) => {
          if (!cell) {
            return <div key={`empty-${idx}`} className="h-9" />;
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
              className={`sph-cal-day sph-tabular relative h-9 flex flex-col items-center justify-center text-[12.5px] ${isToday ? 'sph-cal-today' : ''}`}
              style={{
                backgroundColor: isToday
                  ? 'var(--sph-accent)'
                  : hasDiary
                    ? 'var(--sph-accent-soft)'
                    : 'transparent',
                color: isToday
                  ? 'var(--sph-accent-fg)'
                  : hasDiary
                    ? 'var(--sph-accent)'
                    : 'var(--sph-text)',
                fontWeight: isToday || hasDiary ? 600 : 400,
                boxShadow: isToday
                  ? '0 2px 8px -2px color-mix(in srgb, var(--sph-accent) 55%, transparent)'
                  : 'none',
              }}
            >
              <span className="leading-none">{cell.day}</span>
              {isToday && (
                <span
                  className="w-1 h-1 rounded-full mt-1"
                  style={{ backgroundColor: 'var(--sph-accent-fg)', opacity: 0.9 }}
                />
              )}
              {hasTodo && (
                <span
                  data-testid={`cal-todo-badge-${cell.date}`}
                  title="日记含未完成待办"
                  className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: '#f59e0b' }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div
        className="flex items-center justify-between text-[11px] pt-1"
        style={{ color: 'var(--sph-subtle)', borderTop: '1px solid var(--sph-border)' }}
      >
        <span className="inline-flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full inline-block"
            style={{ backgroundColor: 'var(--sph-accent-soft)' }}
          />
          <span>已有日记</span>
        </span>
        {showTodoBadge && (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: '#f59e0b' }} />
            <span>含未完成待办</span>
          </span>
        )}
      </div>
    </section>
  );
};
