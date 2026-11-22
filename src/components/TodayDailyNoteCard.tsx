import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Eye, PenLine } from 'lucide-react';
import { formatRelativeTime } from '../domain/docPreview';
import type { DocPreviewItem } from '../domain/types';
import { ReadOnlyProtyleView, type ProtyleMountFn } from './ReadOnlyProtyleView';

export interface TodayDailyNoteCardProps {
  todayStr: string;
  dailyNote: DocPreviewItem | null;
  loading: boolean;
  heading?: string;
  createLabel?: string;
  expanded?: boolean;
  mountProtyle?: ProtyleMountFn;
  refreshNonce?: number;
  onOpenDoc: (docId: string) => void;
  onCreateToday: () => void;
}

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const CN_MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

function formatWeekday(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return WEEKDAYS[dt.getDay()] ?? '';
}

export const TodayDailyNoteCard: React.FC<TodayDailyNoteCardProps> = ({
  todayStr,
  dailyNote,
  loading,
  heading = '今日日记',
  createLabel = '写今天的日记',
  expanded = false,
  mountProtyle,
  refreshNonce = 0,
  onOpenDoc,
  onCreateToday,
}) => {
  const weekday = formatWeekday(todayStr);
  const monthIdx = Math.max(0, Math.min(11, Number(todayStr.slice(5, 7)) - 1));
  const dayNum = Number(todayStr.slice(8, 10));
  const [iconFailed, setIconFailed] = useState(false);

  useEffect(() => {
    setIconFailed(false);
  }, [dailyNote?.id]);

  return (
    <section className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-[16px] font-medium tracking-wide">{heading}</h2>
          <span className="text-xs sph-num-font" style={{ color: 'var(--sph-muted)' }}>
            {todayStr} · {weekday}
          </span>
        </div>

        {dailyNote && (
          <button
            type="button"
            className="sph-btn-ghost px-2 py-1 text-xs"
            onClick={() => onOpenDoc(dailyNote.id)}
          >
            <span>进入编辑</span>
            <ArrowUpRight size={13} />
          </button>
        )}
      </div>

      {loading ? (
        <div
          className="sph-panel px-5 py-7 text-xs flex-1 flex items-center"
          style={{ color: 'var(--sph-muted)' }}
        >
          正在翻开日记…
        </div>
      ) : dailyNote ? (
        <div
          data-testid="today-daily-note-card"
          className="sph-panel p-4 sm:p-5 flex flex-col gap-3.5 flex-1 min-w-0"
        >
          {/* Compact header bar: date badge + clickable title + read-only indicator */}
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="sph-card px-2.5 py-1.5 flex items-baseline gap-1 shrink-0 select-none"
                style={{ borderRadius: '10px' }}
              >
                <span className="text-[11px] font-medium" style={{ color: 'var(--sph-accent)' }}>
                  {CN_MONTHS[monthIdx]}
                </span>
                <span className="sph-num-font text-[18px] font-semibold leading-none">
                  {dayNum}
                </span>
              </div>

              <button
                type="button"
                onClick={() => onOpenDoc(dailyNote.id)}
                className="flex items-center gap-2 font-medium text-[16px] leading-snug min-w-0 text-left hover:opacity-80 transition-opacity"
                title="点击打开原日记进行编辑"
              >
                {dailyNote.icon?.type === 'emoji' ? (
                  <span className="shrink-0">{dailyNote.icon.value}</span>
                ) : dailyNote.icon?.type === 'image' && !iconFailed ? (
                  <img
                    src={dailyNote.icon.value}
                    alt=""
                    className="w-4 h-4 rounded-sm object-contain shrink-0"
                    onError={() => setIconFailed(true)}
                  />
                ) : null}
                <span className="truncate">{dailyNote.title}</span>
              </button>
            </div>

            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] shrink-0 select-none"
              style={{
                backgroundColor: 'var(--sph-card)',
                border: '1px solid var(--sph-hairline)',
                color: 'var(--sph-subtle)',
              }}
            >
              <Eye size={11} />
              <span>只读预览</span>
            </span>
          </div>

          {/* Native SiYuan Protyle read-only preview */}
          <ReadOnlyProtyleView
            docId={dailyNote.id}
            mountProtyle={mountProtyle}
            fallbackSnippet={dailyNote.snippet}
            refreshNonce={refreshNonce}
            heightClass={expanded ? 'h-[560px]' : 'h-[350px]'}
          />

          {/* Footer metadata */}
          <div
            className="flex items-center flex-wrap gap-2 text-xs pt-2.5"
            style={{
              color: 'var(--sph-subtle)',
              borderTop: '1px solid var(--sph-hairline)',
            }}
          >
            {dailyNote.notebookName && <span>{dailyNote.notebookName}</span>}
            {typeof dailyNote.wordCount === 'number' && dailyNote.wordCount > 0 && (
              <span className="sph-num-font">· {dailyNote.wordCount} 字</span>
            )}
            {dailyNote.updatedAtMs > 0 && (
              <span>· {formatRelativeTime(dailyNote.updatedAtMs, Date.now())}更新</span>
            )}
            {expanded &&
              dailyNote.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-full text-[11px]"
                  style={{
                    backgroundColor: 'var(--sph-accent-soft)',
                    color: 'var(--sph-accent)',
                  }}
                >
                  #{tag}
                </span>
              ))}
          </div>
        </div>
      ) : (
        <div className="sph-panel px-6 py-7 flex flex-wrap items-center justify-between gap-5 flex-1">
          <div className="flex items-center gap-5 min-w-0">
            <div className="sph-date-rail w-[68px] shrink-0 py-3 px-2 flex flex-col items-center justify-center select-none">
              <span className="text-[11px] font-medium" style={{ color: 'var(--sph-accent)' }}>
                {CN_MONTHS[monthIdx]}
              </span>
              <span className="sph-num-font text-[26px] font-semibold leading-none mt-1">
                {dayNum}
              </span>
            </div>
            <div className="min-w-0">
              <div className="text-[15.5px] font-medium">这一页还留着白</div>
              <div className="text-[13.5px] mt-1 leading-relaxed" style={{ color: 'var(--sph-muted)' }}>
                按你的日记模板一键铺纸，记下今日的思绪、进展与片刻灵感。
              </div>
            </div>
          </div>

          <button
            type="button"
            className="sph-btn sph-btn-primary px-4 py-2 shrink-0"
            onClick={onCreateToday}
          >
            <PenLine size={13} />
            <span>{createLabel}</span>
          </button>
        </div>
      )}
    </section>
  );
};
