import React from 'react';
import { ArrowUpRight, BookMarked, PenLine } from 'lucide-react';
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

  return (
    <section className="sph-card p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ backgroundColor: 'var(--sph-accent-soft)', color: 'var(--sph-accent)' }}
          >
            <BookMarked size={14} />
          </span>
          <h2 className="text-sm font-semibold m-0">今日日记</h2>
          <span className="text-xs" style={{ color: 'var(--sph-muted)' }}>
            {todayStr} · {weekday}
          </span>
        </div>

        {dailyNote && (
          <button
            type="button"
            className="sph-btn"
            onClick={() => onOpenDoc(dailyNote.id)}
          >
            <span>打开编辑</span>
            <ArrowUpRight size={13} />
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-xs py-4" style={{ color: 'var(--sph-muted)' }}>
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
          className="rounded-xl p-3.5 flex gap-3.5 cursor-pointer transition-colors"
          style={{
            backgroundColor: 'var(--sph-surface)',
            border: '1px solid var(--sph-border)',
          }}
        >
          <div className="min-w-0 flex-1 flex flex-col justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 font-medium text-sm">
                {dailyNote.icon?.type === 'emoji' && <span>{dailyNote.icon.value}</span>}
                <span className="truncate">{dailyNote.title}</span>
              </div>
              <p
                className="text-xs mt-1.5 mb-0 leading-relaxed sph-line-clamp-3"
                style={{ color: 'var(--sph-muted)' }}
              >
                {dailyNote.snippet || '日记已创建，点击开始记录今天的想法…'}
              </p>
            </div>
            <div
              className="flex items-center flex-wrap gap-2 text-[11px]"
              style={{ color: 'var(--sph-muted)' }}
            >
              {dailyNote.notebookName && <span>{dailyNote.notebookName}</span>}
              {typeof dailyNote.wordCount === 'number' && <span>· {dailyNote.wordCount} 字</span>}
              {dailyNote.updatedAtMs > 0 && (
                <span>· {formatRelativeTime(dailyNote.updatedAtMs, Date.now())}更新</span>
              )}
            </div>
          </div>

          {dailyNote.thumbnailUrl && (
            <img
              src={dailyNote.thumbnailUrl}
              alt={dailyNote.title}
              className="w-24 h-20 rounded-lg object-cover shrink-0"
              style={{ border: '1px solid var(--sph-border)' }}
            />
          )}
        </div>
      ) : (
        <div
          className="rounded-xl px-4 py-5 flex items-center justify-between gap-3"
          style={{
            backgroundColor: 'var(--sph-surface)',
            border: '1px dashed var(--sph-border)',
          }}
        >
          <div>
            <div className="text-sm font-medium">今天还没有开始记录</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--sph-muted)' }}>
              点击按钮即可按你的日记模板创建今日日记并直接进入编辑。
            </div>
          </div>
          <button
            type="button"
            className="sph-btn sph-btn-primary shrink-0"
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
