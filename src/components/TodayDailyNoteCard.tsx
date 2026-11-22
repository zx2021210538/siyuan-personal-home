import React, { useEffect, useState } from 'react';
import { ArrowUpRight, PenLine } from 'lucide-react';
import { formatRelativeTime } from '../domain/docPreview';
import type { DiaryMoment, DocPreviewItem } from '../domain/types';

export interface TodayDailyNoteCardProps {
  todayStr: string;
  dailyNote: DocPreviewItem | null;
  loading: boolean;
  heading?: string;
  createLabel?: string;
  expanded?: boolean;
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

const FallbackStickerImg: React.FC<{
  candidates: string[];
  alt: string;
  compact?: boolean;
}> = ({ candidates, alt, compact = false }) => {
  const [idx, setIdx] = useState(0);
  if (idx >= candidates.length) return null;
  return (
    <img
      src={candidates[idx]}
      alt={alt}
      loading="lazy"
      onError={() => setIdx((prev) => prev + 1)}
      className={
        compact
          ? 'h-12 w-12 rounded-lg object-contain shrink-0'
          : 'max-h-28 max-w-[130px] rounded-xl object-contain shrink-0'
      }
    />
  );
};

export const TodayDailyNoteCard: React.FC<TodayDailyNoteCardProps> = ({
  todayStr,
  dailyNote,
  loading,
  heading = '今日日记',
  createLabel = '写今天的日记',
  expanded = false,
  onOpenDoc,
  onCreateToday,
}) => {
  const weekday = formatWeekday(todayStr);
  const monthIdx = Math.max(0, Math.min(11, Number(todayStr.slice(5, 7)) - 1));
  const dayNum = Number(todayStr.slice(8, 10));
  const [thumbFailed, setThumbFailed] = useState(false);
  const [iconFailed, setIconFailed] = useState(false);
  const [failedMomentImgKeys, setFailedMomentImgKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setThumbFailed(false);
    setIconFailed(false);
    setFailedMomentImgKeys(new Set());
  }, [dailyNote?.id, dailyNote?.thumbnailUrl]);

  const moments = dailyNote?.moments;
  const hasMomentsMode = Array.isArray(moments);
  const visibleMoments: DiaryMoment[] = hasMomentsMode
    ? expanded
      ? moments
      : moments.slice(0, 2)
    : [];
  const hiddenMomentsCount = hasMomentsMode ? Math.max(0, moments.length - visibleMoments.length) : 0;

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
          role="button"
          tabIndex={0}
          onClick={() => onOpenDoc(dailyNote.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenDoc(dailyNote.id);
            }
          }}
          className="sph-doc-card p-5 sm:p-6 flex gap-5 cursor-pointer flex-1"
        >
          <div className="sph-date-rail w-[74px] shrink-0 py-3 px-2 flex flex-col items-center justify-center self-start select-none">
            <span className="text-[11px] font-medium" style={{ color: 'var(--sph-accent)' }}>
              {CN_MONTHS[monthIdx]}
            </span>
            <span className="sph-num-font text-[30px] font-semibold leading-none mt-1.5">
              {dayNum}
            </span>
            <span className="text-[10.5px] mt-1.5" style={{ color: 'var(--sph-subtle)' }}>
              {weekday}
            </span>
          </div>

          <div className="min-w-0 flex-1 flex flex-col justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-medium text-[17px] leading-snug">
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

              {hasMomentsMode ? (
                visibleMoments.length > 0 ? (
                  <div
                    className={`mt-3 flex flex-col gap-3 ${
                      expanded ? 'max-h-[380px] overflow-y-auto pr-1.5' : ''
                    }`}
                  >
                    {visibleMoments.map((m) => {
                      const iconKey = `icon:${m.id}`;
                      const validImgs = m.images.filter(
                        (_, idx) => !failedMomentImgKeys.has(`img:${m.id}:${idx}`),
                      );
                      return (
                        <div
                          key={m.id}
                          className="rounded-xl px-3.5 py-2.5 flex flex-col gap-1.5"
                          style={{
                            backgroundColor: 'var(--sph-card)',
                            border: '1px solid var(--sph-hairline)',
                          }}
                        >
                          <div className="flex items-center flex-wrap gap-2 text-xs">
                            {m.period && (
                              <span
                                className="px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0"
                                style={{
                                  backgroundColor: 'var(--sph-accent-soft)',
                                  color: 'var(--sph-accent)',
                                }}
                              >
                                {m.period}
                              </span>
                            )}
                            {m.time && (
                              <span
                                className="sph-num-font text-[11px] shrink-0"
                                style={{ color: 'var(--sph-subtle)' }}
                              >
                                {m.time}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1.5 font-medium text-[13.5px] min-w-0">
                              {m.icon?.type === 'emoji' ? (
                                <span className="shrink-0">{m.icon.value}</span>
                              ) : m.icon?.type === 'image' && !failedMomentImgKeys.has(iconKey) ? (
                                <img
                                  src={m.icon.value}
                                  alt=""
                                  className="w-3.5 h-3.5 rounded-sm object-contain shrink-0"
                                  onError={() =>
                                    setFailedMomentImgKeys((prev) => new Set(prev).add(iconKey))
                                  }
                                />
                              ) : null}
                              <span className="truncate">{m.title}</span>
                            </span>
                          </div>

                          {m.text && (
                            <p
                              className={`text-[13.5px] leading-[1.75] ${
                                expanded ? 'whitespace-pre-line' : 'sph-line-clamp-2'
                              }`}
                              style={{ color: 'var(--sph-muted)' }}
                            >
                              {m.text}
                            </p>
                          )}

                          {((expanded && (validImgs.length > 0 || (m.stickers && m.stickers.length > 0))) ||
                            (!expanded && (validImgs.length > 0 || (m.stickers && m.stickers.length > 0)))) && (
                            <div className="flex flex-wrap items-end gap-2.5 pt-1">
                              {m.images.slice(0, expanded ? 6 : 2).map((src, idx) => {
                                const imgKey = `img:${m.id}:${idx}`;
                                if (failedMomentImgKeys.has(imgKey)) return null;
                                return (
                                  <div
                                    key={imgKey}
                                    className={
                                      expanded
                                        ? 'w-28 h-24 rounded-xl overflow-hidden shrink-0'
                                        : 'w-16 h-12 rounded-lg overflow-hidden shrink-0'
                                    }
                                    style={{ border: '1px solid var(--sph-hairline)' }}
                                  >
                                    <img
                                      src={src}
                                      alt={m.title}
                                      loading="lazy"
                                      onError={() =>
                                        setFailedMomentImgKeys((prev) => new Set(prev).add(imgKey))
                                      }
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                );
                              })}
                              {(m.stickers ?? []).slice(0, expanded ? 4 : 1).map((st) => (
                                <FallbackStickerImg
                                  key={`${m.id}:${st.code}`}
                                  candidates={st.candidates}
                                  alt={st.code}
                                  compact={!expanded}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {hiddenMomentsCount > 0 && (
                      <div className="text-xs pl-1" style={{ color: 'var(--sph-subtle)' }}>
                        + 还有 {hiddenMomentsCount} 条记录片段，点击查看完整日记…
                      </div>
                    )}
                  </div>
                ) : (
                  <p
                    className="text-[14px] mt-3 leading-[1.8]"
                    style={{ color: 'var(--sph-muted)' }}
                  >
                    这一天的日记还没有记录片段，点击这里进入编辑记录此刻…
                  </p>
                )
              ) : (
                <p
                  className={`text-[14.5px] mt-2.5 leading-[1.85] ${
                    expanded ? 'sph-line-clamp-5' : 'sph-line-clamp-3'
                  }`}
                  style={{ color: 'var(--sph-muted)' }}
                >
                  {dailyNote.snippet || '日记已建好，点击这里提笔记录此刻的想法与见闻…'}
                </p>
              )}
            </div>

            <div
              className="flex items-center flex-wrap gap-2 text-xs pt-3"
              style={{
                color: 'var(--sph-subtle)',
                borderTop: '1px solid var(--sph-hairline)',
              }}
            >
              {dailyNote.notebookName && <span>{dailyNote.notebookName}</span>}
              {hasMomentsMode && moments.length > 0 && (
                <span className="sph-num-font">· {moments.length} 条片段</span>
              )}
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

          {!hasMomentsMode && dailyNote.thumbnailUrl && !thumbFailed && (
            <div
              className="w-32 h-24 rounded-xl overflow-hidden shrink-0 self-center"
              style={{ border: '1px solid var(--sph-hairline)' }}
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
