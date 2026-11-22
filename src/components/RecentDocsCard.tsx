import React, { useState } from 'react';
import { Clock, Eye, FileText, Folder, Search } from 'lucide-react';
import { formatRelativeTime } from '../domain/docPreview';
import type { DocPreviewItem, RecentTabKey } from '../domain/types';
import type { SiYuanNotebook } from '../services/siyuanApi';

export interface RecentDocsCardProps {
  activeTab: RecentTabKey;
  onChangeTab: (tab: RecentTabKey) => void;
  items: DocPreviewItem[];
  hasMore: boolean;
  loading: boolean;
  hideDailyNotes: boolean;
  onToggleHideDailyNotes: () => void;
  notebookId: string;
  notebooks: SiYuanNotebook[];
  onChangeNotebook: (nbId: string) => void;
  keyword: string;
  onChangeKeyword: (kw: string) => void;
  onLoadMore: () => void;
  onOpenDoc: (docId: string) => void;
}

export const RecentDocsCard: React.FC<RecentDocsCardProps> = ({
  activeTab,
  onChangeTab,
  items,
  hasMore,
  loading,
  hideDailyNotes,
  onToggleHideDailyNotes,
  notebookId,
  notebooks,
  onChangeNotebook,
  keyword,
  onChangeKeyword,
  onLoadMore,
  onOpenDoc,
}) => {
  const openNotebooks = notebooks.filter((nb) => !nb.closed);
  const nowMs = Date.now();
  const [failedThumbIds, setFailedThumbIds] = useState<Set<string>>(() => new Set());
  const [failedIconIds, setFailedIconIds] = useState<Set<string>>(() => new Set());

  return (
    <section className="sph-card p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div
          role="tablist"
          className="inline-flex rounded-xl p-1 gap-0.5"
          style={{ backgroundColor: 'var(--sph-tile)' }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'modified'}
            onClick={() => onChangeTab('modified')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-all"
            style={{
              backgroundColor: activeTab === 'modified' ? 'var(--sph-card)' : 'transparent',
              color: activeTab === 'modified' ? 'var(--sph-text)' : 'var(--sph-muted)',
              boxShadow:
                activeTab === 'modified' ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
            }}
          >
            <Clock size={13} />
            <span>最近改过</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'read'}
            onClick={() => onChangeTab('read')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-all"
            style={{
              backgroundColor: activeTab === 'read' ? 'var(--sph-card)' : 'transparent',
              color: activeTab === 'read' ? 'var(--sph-text)' : 'var(--sph-muted)',
              boxShadow:
                activeTab === 'read' ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
            }}
          >
            <Eye size={13} />
            <span>最近读过</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer select-none transition-colors"
            style={{
              backgroundColor: hideDailyNotes ? 'var(--sph-accent-soft)' : 'var(--sph-tile)',
              color: hideDailyNotes ? 'var(--sph-accent)' : 'var(--sph-muted)',
            }}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={hideDailyNotes}
              onChange={onToggleHideDailyNotes}
            />
            <span
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: hideDailyNotes ? 'var(--sph-accent)' : 'var(--sph-subtle)',
              }}
            />
            <span>隐藏日记</span>
          </label>

          <select
            aria-label="筛选笔记本"
            className="sph-select max-w-[130px]"
            value={notebookId}
            onChange={(e) => onChangeNotebook(e.target.value)}
          >
            <option value="all">全部笔记本</option>
            {openNotebooks.map((nb) => (
              <option key={nb.id} value={nb.id}>
                {nb.name}
              </option>
            ))}
          </select>

          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--sph-subtle)' }}
            />
            <input
              type="text"
              aria-label="搜索最近笔记"
              placeholder="筛选标题或标签..."
              value={keyword}
              onChange={(e) => onChangeKeyword(e.target.value)}
              className="sph-input py-1.5 pl-7 pr-2.5 text-xs w-36 sm:w-44"
            />
          </div>
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div
          className="rounded-xl py-10 text-center text-xs"
          style={{ backgroundColor: 'var(--sph-tile)', color: 'var(--sph-muted)' }}
        >
          正在加载笔记预览…
        </div>
      ) : items.length === 0 ? (
        <div
          className="rounded-xl py-10 px-4 text-center text-xs"
          style={{
            backgroundColor: 'var(--sph-tile)',
            color: 'var(--sph-muted)',
          }}
        >
          {activeTab === 'read'
            ? '从现在开始，你打开浏览过的笔记会自动出现在这里。'
            : '暂无符合筛选条件的笔记。'}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((doc) => {
            const displayTs =
              activeTab === 'read' ? (doc.readAtMs ?? doc.updatedAtMs) : doc.updatedAtMs;
            return (
              <article
                key={doc.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenDoc(doc.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenDoc(doc.id);
                  }
                }}
                className="sph-doc-row p-3.5 flex gap-3.5 cursor-pointer"
              >
                <div className="min-w-0 flex-1 flex flex-col justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-[14px] font-semibold leading-snug">
                      {doc.icon?.type === 'emoji' ? (
                        <span className="shrink-0 text-sm">{doc.icon.value}</span>
                      ) : doc.icon?.type === 'image' && !failedIconIds.has(doc.id) ? (
                        <img
                          src={doc.icon.value}
                          alt=""
                          className="w-4 h-4 rounded-sm object-contain shrink-0"
                          onError={() =>
                            setFailedIconIds((prev) => new Set(prev).add(doc.id))
                          }
                        />
                      ) : (
                        <FileText
                          size={14}
                          className="shrink-0"
                          style={{ color: 'var(--sph-subtle)' }}
                        />
                      )}
                      <span className="truncate">{doc.title}</span>
                    </div>
                    {doc.snippet && (
                      <p
                        className="text-[12.5px] mt-1.5 leading-relaxed sph-line-clamp-2"
                        style={{ color: 'var(--sph-muted)' }}
                      >
                        {doc.snippet}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center flex-wrap gap-1.5 text-[11px] pt-0.5">
                    {doc.notebookName && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md"
                        style={{
                          backgroundColor: 'var(--sph-card)',
                          color: 'var(--sph-muted)',
                        }}
                      >
                        <Folder size={10} />
                        <span>{doc.notebookName}</span>
                      </span>
                    )}
                    {doc.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 rounded-md text-[10.5px] font-medium"
                        style={{
                          backgroundColor: 'var(--sph-accent-soft)',
                          color: 'var(--sph-accent)',
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                    {displayTs > 0 && (
                      <span
                        className="ml-auto sph-tabular text-[11px]"
                        style={{ color: 'var(--sph-subtle)' }}
                      >
                        {formatRelativeTime(displayTs, nowMs)}
                      </span>
                    )}
                  </div>
                </div>

                {doc.thumbnailUrl && !failedThumbIds.has(doc.id) && (
                  <div
                    className="w-[88px] h-[66px] rounded-[10px] overflow-hidden shrink-0 self-center"
                    style={{ border: '1px solid var(--sph-border)' }}
                  >
                    <img
                      src={doc.thumbnailUrl}
                      alt={doc.title}
                      loading="lazy"
                      onError={() =>
                        setFailedThumbIds((prev) => new Set(prev).add(doc.id))
                      }
                      className="sph-doc-thumb w-full h-full object-cover"
                    />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {hasMore && (
        <div className="pt-1 flex justify-center">
          <button type="button" className="sph-btn px-5 py-1.5" disabled={loading} onClick={onLoadMore}>
            {loading ? '加载中…' : '加载更多'}
          </button>
        </div>
      )}
    </section>
  );
};
