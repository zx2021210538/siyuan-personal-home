import React, { useEffect, useState } from 'react';
import { ArrowUpRight, BookMarked, PenLine, Sparkles } from 'lucide-react';
import { formatRelativeTime } from '../domain/docPreview';
import type { DocPreviewItem } from '../domain/types';

export interface TodayDailyNoteCardProps {
  todayStr: string;
  dailyNote: DocPreviewItem | null;
  loading: boolean;
  onOpenDoc: (docId: string) => void;
  onCreateToday: () => void;
}

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

function formatWeekday(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return WEEKDAYS[dt.getDay()] ?? '';
}

export const TodayDailyNoteCard: React.FC<TodayDailyNoteCardProps> = ({
  todayStr,
  dailyNote,
  loading,
  onOpenDoc,
  onCreateToday,
}) => {
  const weekday = formatWeekday(todayStr);
  const monthNum = Number(todayStr.slice(5, 7));
  const dayNum = Number(todayStr.slice(8, 10));
  const [thumbFailed, setThumbFailed] = useState(false);
  const [iconFailed, setIconFailed] = useState(false);

  useEffect(() => {
    setThumbFailed(false);
    setIconFailed(false);
  }, [dailyNote?.id, dailyNote?.thumbnailUrl]);

  return (
    <section className="sph-card p-5 flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'var(--sph-accent-soft)', color: 'var(--sph-accent)' }}
          >
            <BookMarked size={14} />
          </span>
          <div className="flex items-baseline gap-2">
            <h2 className="text-[15px] font-semibold">今日日记</h2>
            <span className="text-xs sph-tabular" style={{ color: 'var(--sph-muted)' }}>
              {todayStr} · {weekday}
            </span>
          </div>
        </div>

        {dailyNote && (
          <button
            type="button"
            className="sph-btn-ghost px-2.5 py-1 text-xs"
            onClick={() => onOpenDoc(dailyNote.id)}
          >
            <span>打开编辑</span>
            <ArrowUpRight size={13} />
          </button>
        )}
      </div>

      {loading ? (
        <div
          className="rounded-xl p-4 text-xs"
          style={{ backgroundColor: 'var(--sph-tile)', color: 'var(--sph-muted)' }}
        >
          正在读取今日日记…
        </div>
      ) : dailyNote ? (
        <div
          data-testid="today-daily-note-card"
          role="button"
          tabIndex={0}
          onClick={() => onOpenDoc(dailyNote.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenDoc(dailyNote.id);
            }
          }}
          className="sph-doc-row p-4 flex gap-4 cursor-pointer"
        >
          {/* Mini date tear-off badge */}
          <div
            className="w-12 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 select-none"
            style={{
              backgroundColor: 'var(--sph-card)',
              border: '1px solid var(--sph-border)',
            }}
          >
            <span className="text-[10px] font-medium leading-none" style={{ color: 'var(--sph-accent)' }}>
              {monthNum}月
            </span>
            <span className="sph-tabular text-lg font-semibold leading-tight mt-0.5">
              {dayNum}
            </span>
          </div>

          <div className="min-w-0 flex-1 flex flex-col justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 font-semibold text-sm">
                {dailyNote.icon?.type === 'emoji' ? (
                  <span>{dailyNote.icon.value}</span>
                ) : dailyNote.icon?.type === 'image' && !iconFailed ? (
                  <img
                    src={dailyNote.icon.value}
                    alt=""
                    className="w-4 h-4 rounded-sm object-contain shrink-0"
                    onError={() => setIconFailed(true)}
                  />
                ) : null}
                <span className="truncate">{dailyNote.title}</span>
              </div>
              <p
                className="text-[13px] mt-1.5 leading-relaxed sph-line-clamp-3"
                style={{ color: 'var(--sph-muted)' }}
              >
                {dailyNote.snippet || '日记已就绪，点击进入记录今天的思考与收获…'}
              </p>
            </div>

            <div
              className="flex items-center flex-wrap gap-2 text-[11px] pt-1"
              style={{ color: 'var(--sph-subtle)' }}
            >
              {dailyNote.notebookName && (
                <span
                  className="px-2 py-0.5 rounded-md font-medium"
                  style={{ backgroundColor: 'var(--sph-card)', color: 'var(--sph-muted)' }}
                >
                  {dailyNote.notebookName}
                </span>
              )}
              {typeof dailyNote.wordCount === 'number' && (
                <span className="sph-tabular">{dailyNote.wordCount} 字</span>
              )}
              {dailyNote.updatedAtMs > 0 && (
                <span>· {formatRelativeTime(dailyNote.updatedAtMs, Date.now())}更新</span>
              )}
            </div>
          </div>

          {dailyNote.thumbnailUrl && !thumbFailed && (
            <div
              className="w-28 h-22 rounded-xl overflow-hidden shrink-0 self-center"
              style={{ border: '1px solid var(--sph-border)' }}
            >
              <img
                src={dailyNote.thumbnailUrl}
                alt={dailyNote.title}
                onError={() => setThumbFailed(true)}
                className="sph-doc-thumb w-full h-full object-cover"
              />
            </div>
          )}
        </div>
      ) : (
        <div
          className="rounded-xl px-5 py-5 flex flex-wrap items-center justify-between gap-4"
          style={{
            background:
              'linear-gradient(135deg, var(--sph-accent-soft) 0%, var(--sph-tile) 100%)',
            border: '1px solid var(--sph-accent-border)',
          }}
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className="w-11 h-12 rounded-xl flex flex-col items-center justify-center shrink-0"
              style={{
                backgroundColor: 'var(--sph-card)',
                border: '1px solid var(--sph-border)',
              }}
            >
              <span className="text-[10px] font-medium leading-none" style={{ color: 'var(--sph-accent)' }}>
                {monthNum}月
              </span>
              <span className="sph-tabular text-base font-semibold leading-tight mt-0.5">
                {dayNum}
              </span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold flex items-center gap-1.5">
                <Sparkles size={14} style={{ color: 'var(--sph-accent)' }} />
                <span>开启今天的记录</span>
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--sph-muted)' }}>
                一键按你的日记模板生成今日日记，随时记下灵感与进度。
              </div>
            </div>
          </div>

          <button
            type="button"
            className="sph-btn sph-btn-primary px-3.5 py-2 shrink-0"
            onClick={onCreateToday}
          >
            <PenLine size={13} />
            <span>写今天的日记</span>
          </button>
        </div>
      )}
    </section>
  );
};
