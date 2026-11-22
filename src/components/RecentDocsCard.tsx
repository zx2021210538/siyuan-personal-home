import React, { useState } from 'react';
import {
  Clock,
  Eye,
  FileText,
  Folder,
  LayoutGrid,
  LayoutList,
  Search,
} from 'lucide-react';
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
  navigatorMode?: boolean;
  viewMode?: 'list' | 'grid';
  onChangeViewMode?: (mode: 'list' | 'grid') => void;
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
  navigatorMode = false,
  viewMode,
  onChangeViewMode,
}) => {
  const openNotebooks = notebooks.filter((nb) => !nb.closed);
  const nowMs = Date.now();
  const [localViewStyle, setLocalViewStyle] = useState<'list' | 'grid'>('list');
  const viewStyle = viewMode ?? localViewStyle;
  const setViewStyle = (next: 'list' | 'grid') => {
    setLocalViewStyle(next);
    onChangeViewMode?.(next);
  };
  const [failedThumbIds, setFailedThumbIds] = useState<Set<string>>(() => new Set());
  const [failedIconIds, setFailedIconIds] = useState<Set<string>>(() => new Set());

  const renderDocItem = (doc: DocPreviewItem) => {
    const displayTs =
      activeTab === 'read' ? (doc.readAtMs ?? doc.updatedAtMs) : doc.updatedAtMs;

    if (viewStyle === 'grid' && navigatorMode) {
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
          className="sph-doc-card overflow-hidden flex flex-col cursor-pointer"
        >
          {doc.thumbnailUrl && !failedThumbIds.has(doc.id) && (
            <div
              className="w-full h-36 overflow-hidden"
              style={{ borderBottom: '1px solid var(--sph-hairline)' }}
            >
              <img
                src={doc.thumbnailUrl}
                alt={doc.title}
                loading="lazy"
                onError={() => setFailedThumbIds((prev) => new Set(prev).add(doc.id))}
                className="sph-doc-thumb w-full h-full object-cover"
              />
            </div>
          )}
          <div className="p-4 flex-1 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[15px] font-semibold leading-snug">
                {doc.icon?.type === 'emoji' ? (
                  <span className="shrink-0 text-sm">{doc.icon.value}</span>
                ) : doc.icon?.type === 'image' && !failedIconIds.has(doc.id) ? (
                  <img
                    src={doc.icon.value}
                    alt=""
                    className="w-4 h-4 rounded-sm object-contain shrink-0"
                    onError={() => setFailedIconIds((prev) => new Set(prev).add(doc.id))}
                  />
                ) : null}
                <span className="truncate">{doc.title}</span>
              </div>
              {doc.snippet && (
                <p
                  className="text-[13px] mt-2 leading-relaxed sph-line-clamp-3"
                  style={{ color: 'var(--sph-muted)' }}
                >
                  {doc.snippet}
                </p>
              )}
            </div>

            <div className="flex items-center flex-wrap gap-1.5 text-[11px] pt-1">
              {doc.notebookName && (
                <span style={{ color: 'var(--sph-subtle)' }}>{doc.notebookName}</span>
              )}
              {doc.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 rounded text-[10.5px]"
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
                  className="ml-auto sph-num-font"
                  style={{ color: 'var(--sph-subtle)' }}
                >
                  {formatRelativeTime(displayTs, nowMs)}
                </span>
              )}
            </div>
          </div>
        </article>
      );
    }

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
        className="sph-doc-row px-4 py-4 flex gap-4 cursor-pointer"
        style={{ borderBottom: '1px solid var(--sph-hairline)', borderRadius: '10px' }}
      >
        <div className="min-w-0 flex-1 flex flex-col justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-[15px] font-semibold leading-snug">
              {doc.icon?.type === 'emoji' ? (
                <span className="shrink-0 text-sm">{doc.icon.value}</span>
              ) : doc.icon?.type === 'image' && !failedIconIds.has(doc.id) ? (
                <img
                  src={doc.icon.value}
                  alt=""
                  className="w-4 h-4 rounded-sm object-contain shrink-0"
                  onError={() => setFailedIconIds((prev) => new Set(prev).add(doc.id))}
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
                className="text-[13.5px] mt-1.5 leading-[1.7] sph-line-clamp-2"
                style={{ color: 'var(--sph-muted)' }}
              >
                {doc.snippet}
              </p>
            )}
          </div>

          <div className="flex items-center flex-wrap gap-2 text-[11.5px] pt-0.5">
            {doc.notebookName && (
              <span
                className="inline-flex items-center gap-1"
                style={{ color: 'var(--sph-subtle)' }}
              >
                <Folder size={11} />
                <span>{doc.notebookName}</span>
              </span>
            )}
            {doc.tags.map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 rounded text-[11px]"
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
                className="ml-auto sph-num-font"
                style={{ color: 'var(--sph-subtle)' }}
              >
                {formatRelativeTime(displayTs, nowMs)}
              </span>
            )}
          </div>
        </div>

        {doc.thumbnailUrl && !failedThumbIds.has(doc.id) && (
          <div
            className="w-28 h-[78px] rounded-xl overflow-hidden shrink-0 self-center"
            style={{ border: '1px solid var(--sph-hairline)' }}
          >
            <img
              src={doc.thumbnailUrl}
              alt={doc.title}
              loading="lazy"
              onError={() => setFailedThumbIds((prev) => new Set(prev).add(doc.id))}
              className="sph-doc-thumb w-full h-full object-cover"
            />
          </div>
        )}
      </article>
    );
  };

  if (navigatorMode) {
    return (
      <section className="sph-notes-split">
        {/* Left Notebook Navigator Sidebar */}
        <aside
          className="flex flex-col gap-5 pr-2"
          style={{ borderRight: '1px solid var(--sph-hairline)' }}
        >
          <div className="flex flex-col gap-1" role="tablist">
            <div className="text-[11px] font-medium px-2.5 pb-1" style={{ color: 'var(--sph-subtle)' }}>
              视图
            </div>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'modified'}
              onClick={() => onChangeTab('modified')}
              className="w-full px-3 py-2 rounded-lg text-[13.5px] font-medium flex items-center gap-2 text-left transition-colors"
              style={{
                backgroundColor: activeTab === 'modified' ? 'var(--sph-accent-soft)' : 'transparent',
                color: activeTab === 'modified' ? 'var(--sph-accent)' : 'var(--sph-text)',
              }}
            >
              <Clock size={14} />
              <span>最近改过</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'read'}
              onClick={() => onChangeTab('read')}
              className="w-full px-3 py-2 rounded-lg text-[13.5px] font-medium flex items-center gap-2 text-left transition-colors"
              style={{
                backgroundColor: activeTab === 'read' ? 'var(--sph-accent-soft)' : 'transparent',
                color: activeTab === 'read' ? 'var(--sph-accent)' : 'var(--sph-text)',
              }}
            >
              <Eye size={14} />
              <span>最近读过</span>
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <div className="text-[11px] font-medium px-2.5 pb-1" style={{ color: 'var(--sph-subtle)' }}>
              笔记本
            </div>
            <button
              type="button"
              onClick={() => onChangeNotebook('all')}
              className="w-full px-3 py-1.5 rounded-lg text-[13px] flex items-center gap-2 text-left transition-colors"
              style={{
                backgroundColor: notebookId === 'all' ? 'var(--sph-wash-hover)' : 'transparent',
                color: notebookId === 'all' ? 'var(--sph-text)' : 'var(--sph-muted)',
                fontWeight: notebookId === 'all' ? 600 : 400,
              }}
            >
              <Folder size={13} />
              <span className="truncate">全部笔记本</span>
            </button>
            {openNotebooks.map((nb) => (
              <button
                key={nb.id}
                type="button"
                onClick={() => onChangeNotebook(nb.id)}
                className="w-full px-3 py-1.5 rounded-lg text-[13px] flex items-center gap-2 text-left transition-colors"
                style={{
                  backgroundColor: notebookId === nb.id ? 'var(--sph-wash-hover)' : 'transparent',
                  color: notebookId === nb.id ? 'var(--sph-text)' : 'var(--sph-muted)',
                  fontWeight: notebookId === nb.id ? 600 : 400,
                }}
              >
                <Folder size={13} />
                <span className="truncate">{nb.name}</span>
              </button>
            ))}
          </div>

          <div className="pt-3 px-2.5" style={{ borderTop: '1px solid var(--sph-hairline)' }}>
            <label
              className="flex items-center justify-between gap-2 text-xs cursor-pointer select-none"
              style={{ color: 'var(--sph-muted)' }}
            >
              <span>隐藏日记</span>
              <span className="sph-switch">
                <input
                  type="checkbox"
                  checked={hideDailyNotes}
                  onChange={onToggleHideDailyNotes}
                />
                <span className="sph-switch-track">
                  <span className="sph-switch-thumb" />
                </span>
              </span>
            </label>
          </div>
        </aside>

        {/* Right Document Canvas */}
        <div className="min-w-0 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--sph-subtle)' }}
              />
              <input
                type="text"
                aria-label="搜索最近笔记"
                placeholder="筛选标题、路径或标签..."
                value={keyword}
                onChange={(e) => onChangeKeyword(e.target.value)}
                className="sph-input w-full py-2 pl-9 pr-3 text-[13px]"
              />
            </div>

            <div
              className="inline-flex rounded-lg p-0.5 gap-0.5"
              style={{ backgroundColor: 'var(--sph-wash)' }}
            >
              <button
                type="button"
                aria-label="列表视图"
                onClick={() => setViewStyle('list')}
                className="p-1.5 rounded-md transition-colors"
                style={{
                  backgroundColor: viewStyle === 'list' ? 'var(--sph-card)' : 'transparent',
                  color: viewStyle === 'list' ? 'var(--sph-text)' : 'var(--sph-muted)',
                }}
              >
                <LayoutList size={14} />
              </button>
              <button
                type="button"
                aria-label="卡片网格视图"
                onClick={() => setViewStyle('grid')}
                className="p-1.5 rounded-md transition-colors"
                style={{
                  backgroundColor: viewStyle === 'grid' ? 'var(--sph-card)' : 'transparent',
                  color: viewStyle === 'grid' ? 'var(--sph-text)' : 'var(--sph-muted)',
                }}
              >
                <LayoutGrid size={14} />
              </button>
            </div>
          </div>

          {loading && items.length === 0 ? (
            <div className="sph-panel py-12 text-center text-xs" style={{ color: 'var(--sph-muted)' }}>
              正在加载笔记预览…
            </div>
          ) : items.length === 0 ? (
            <div className="sph-panel py-14 px-6 text-center text-[13px]" style={{ color: 'var(--sph-muted)' }}>
              {activeTab === 'read'
                ? '从现在开始，你打开浏览过的笔记会自动出现在这里。'
                : '暂无符合筛选条件的笔记。'}
            </div>
          ) : viewStyle === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map(renderDocItem)}
            </div>
          ) : (
            <div className="flex flex-col">{items.map(renderDocItem)}</div>
          )}

          {hasMore && (
            <div className="pt-2 flex justify-center">
              <button type="button" className="sph-btn px-6 py-2" disabled={loading} onClick={onLoadMore}>
                {loading ? '加载中…' : '加载更多'}
              </button>
            </div>
          )}
        </div>
      </section>
    );
  }

  // Compact mode (for standalone usage / tests)
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div
          role="tablist"
          className="inline-flex rounded-xl p-1 gap-0.5"
          style={{ backgroundColor: 'var(--sph-wash)' }}
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
            }}
          >
            <Eye size={13} />
            <span>最近读过</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer select-none"
            style={{
              backgroundColor: hideDailyNotes ? 'var(--sph-accent-soft)' : 'var(--sph-wash)',
              color: hideDailyNotes ? 'var(--sph-accent)' : 'var(--sph-muted)',
            }}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={hideDailyNotes}
              onChange={onToggleHideDailyNotes}
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
        <div className="sph-panel py-10 text-center text-xs" style={{ color: 'var(--sph-muted)' }}>
          正在加载笔记预览…
        </div>
      ) : items.length === 0 ? (
        <div className="sph-panel py-10 px-4 text-center text-xs" style={{ color: 'var(--sph-muted)' }}>
          {activeTab === 'read'
            ? '从现在开始，你打开浏览过的笔记会自动出现在这里。'
            : '暂无符合筛选条件的笔记。'}
        </div>
      ) : (
        <div className="flex flex-col">{items.map(renderDocItem)}</div>
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
