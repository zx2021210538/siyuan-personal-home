import React from 'react';
import { Clock, Eye, FileText, Search } from 'lucide-react';
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

  return (
    <section className="sph-card p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="tablist"
          className="inline-flex rounded-lg p-0.5"
          style={{
            backgroundColor: 'var(--sph-surface)',
            border: '1px solid var(--sph-border)',
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'modified'}
            onClick={() => onChangeTab('modified')}
            className="px-3 py-1 rounded-md text-xs font-medium border-0 cursor-pointer inline-flex items-center gap-1.5 transition-colors"
            style={{
              backgroundColor: activeTab === 'modified' ? 'var(--sph-card)' : 'transparent',
              color: activeTab === 'modified' ? 'var(--sph-text)' : 'var(--sph-muted)',
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
            className="px-3 py-1 rounded-md text-xs font-medium border-0 cursor-pointer inline-flex items-center gap-1.5 transition-colors"
            style={{
              backgroundColor: activeTab === 'read' ? 'var(--sph-card)' : 'transparent',
              color: activeTab === 'read' ? 'var(--sph-text)' : 'var(--sph-muted)',
            }}
          >
            <Eye size={13} />
            <span>最近读过</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label
            className="inline-flex items-center gap-1.5 text-xs cursor-pointer select-none"
            style={{ color: 'var(--sph-muted)' }}
          >
            <input
              type="checkbox"
              checked={hideDailyNotes}
              onChange={onToggleHideDailyNotes}
            />
            <span>隐藏日记</span>
          </label>

          <select
            aria-label="筛选笔记本"
            className="sph-input !py-1 !px-2 !text-xs"
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
              style={{ color: 'var(--sph-muted)' }}
            />
            <input
              type="text"
              aria-label="搜索最近笔记"
              placeholder="筛选标题或标签..."
              value={keyword}
              onChange={(e) => onChangeKeyword(e.target.value)}
              className="sph-input !py-1 !pl-7 !pr-2.5 !text-xs w-36 sm:w-44"
            />
          </div>
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="text-xs py-8 text-center" style={{ color: 'var(--sph-muted)' }}>
          正在加载笔记预览…
        </div>
      ) : items.length === 0 ? (
        <div
          className="rounded-xl py-8 px-4 text-center text-xs"
          style={{
            backgroundColor: 'var(--sph-surface)',
            color: 'var(--sph-muted)',
            border: '1px dashed var(--sph-border)',
          }}
        >
          {activeTab === 'read'
            ? '从现在开始，你打开浏览过的笔记会自动出现在这里。'
            : '暂无符合筛选条件的笔记。'}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((doc) => {
            const displayTs = activeTab === 'read' ? (doc.readAtMs ?? doc.updatedAtMs) : doc.updatedAtMs;
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
                className="rounded-xl p-3 flex gap-3 cursor-pointer transition-all hover:opacity-95"
                style={{
                  backgroundColor: 'var(--sph-surface)',
                  border: '1px solid var(--sph-border)',
                }}
              >
                <div className="min-w-0 flex-1 flex flex-col justify-between gap-1.5">
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      {doc.icon?.type === 'emoji' ? (
                        <span className="shrink-0">{doc.icon.value}</span>
                      ) : (
                        <FileText
                          size={14}
                          className="shrink-0"
                          style={{ color: 'var(--sph-muted)' }}
                        />
                      )}
                      <span className="truncate">{doc.title}</span>
                    </div>
                    {doc.snippet && (
                      <p
                        className="text-xs mt-1 mb-0 leading-relaxed sph-line-clamp-2"
                        style={{ color: 'var(--sph-muted)' }}
                      >
                        {doc.snippet}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center flex-wrap gap-1.5 text-[11px] pt-0.5">
                    {doc.notebookName && (
                      <span style={{ color: 'var(--sph-muted)' }}>{doc.notebookName}</span>
                    )}
                    {doc.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 rounded-md text-[10px]"
                        style={{
                          backgroundColor: 'var(--sph-accent-soft)',
                          color: 'var(--sph-accent)',
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                    {displayTs > 0 && (
                      <span className="ml-auto" style={{ color: 'var(--sph-muted)' }}>
                        {formatRelativeTime(displayTs, nowMs)}
                      </span>
                    )}
                  </div>
                </div>

                {doc.thumbnailUrl && (
                  <img
                    src={doc.thumbnailUrl}
                    alt={doc.title}
                    loading="lazy"
                    className="w-20 h-[68px] rounded-lg object-cover shrink-0 self-center"
                    style={{ border: '1px solid var(--sph-border)' }}
                  />
                )}
              </article>
            );
          })}
        </div>
      )}

      {hasMore && (
        <div className="pt-1 flex justify-center">
          <button type="button" className="sph-btn" disabled={loading} onClick={onLoadMore}>
            {loading ? '加载中…' : '加载更多'}
          </button>
        </div>
      )}
    </section>
  );
};
