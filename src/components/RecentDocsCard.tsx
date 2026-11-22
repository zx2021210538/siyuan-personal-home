import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Clock,
  Eye,
  EyeOff,
  FileText,
  Folder,
  LayoutGrid,
  LayoutList,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { formatRelativeTime, groupDocsByDateBucket } from '../domain/docPreview';
import {
  DEFAULT_NOTE_CARD_PREFS,
  type DocPreviewItem,
  type NoteCardDisplayPrefs,
  type RecentTabKey,
} from '../domain/types';
import type { SiYuanNotebook } from '../services/siyuanApi';

export interface RecentDocsCardProps {
  activeTab: RecentTabKey;
  onChangeTab: (tab: RecentTabKey) => void;
  items: DocPreviewItem[];
  hasMore: boolean;
  loading: boolean;
  hideDailyNotes?: boolean;
  onToggleHideDailyNotes?: () => void;
  hiddenNotebookIds?: string[];
  hiddenIdsCount?: number;
  onToggleHiddenNotebook?: (nbId: string) => void;
  onOpenHiddenIdsSettings?: () => void;
  diaryNotebookId?: string;
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
  displayPrefs?: NoteCardDisplayPrefs;
  onChangeDisplayPrefs?: (patch: Partial<NoteCardDisplayPrefs>) => void;
}

const PREVIEW_LINE_OPTIONS = [0, 1, 2, 3, 4, 5] as const;

function getLineClampClass(lines: number): string {
  const clamped = Math.max(1, Math.min(5, Math.round(lines)));
  return `sph-line-clamp-${clamped}`;
}

export const RecentDocsCard: React.FC<RecentDocsCardProps> = ({
  activeTab,
  onChangeTab,
  items,
  hasMore,
  loading,
  hideDailyNotes = false,
  onToggleHideDailyNotes,
  hiddenNotebookIds = [],
  hiddenIdsCount = 0,
  onToggleHiddenNotebook,
  onOpenHiddenIdsSettings,
  diaryNotebookId = '',
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
  displayPrefs,
  onChangeDisplayPrefs,
}) => {
  const openNotebooks = notebooks.filter((nb) => !nb.closed);
  const nowMs = Date.now();
  const [localViewStyle, setLocalViewStyle] = useState<'list' | 'grid'>('list');
  const [localPrefs, setLocalPrefs] = useState<NoteCardDisplayPrefs>(DEFAULT_NOTE_CARD_PREFS);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [failedThumbIds, setFailedThumbIds] = useState<Set<string>>(() => new Set());
  const [failedIconIds, setFailedIconIds] = useState<Set<string>>(() => new Set());
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const viewStyle = viewMode ?? localViewStyle;
  const setViewStyle = (next: 'list' | 'grid') => {
    setLocalViewStyle(next);
    onChangeViewMode?.(next);
  };

  const prefs: NoteCardDisplayPrefs = useMemo(
    () => ({ ...DEFAULT_NOTE_CARD_PREFS, ...(displayPrefs ?? localPrefs) }),
    [displayPrefs, localPrefs],
  );

  const patchPrefs = (patch: Partial<NoteCardDisplayPrefs>) => {
    setLocalPrefs((curr) => ({ ...curr, ...patch }));
    onChangeDisplayPrefs?.(patch);
  };

  useEffect(() => {
    if (!popoverOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopoverOpen(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [popoverOpen]);

  const hiddenSet = useMemo(() => new Set(hiddenNotebookIds), [hiddenNotebookIds]);

  const activeTagFilter = useMemo(() => {
    const trimmed = keyword.trim();
    if (trimmed.startsWith('#') && trimmed.length > 1) {
      return trimmed.slice(1).replace(/#$/, '');
    }
    return '';
  }, [keyword]);

  const handleClickTag = (e: React.MouseEvent, tag: string) => {
    e.stopPropagation();
    if (activeTagFilter === tag) {
      onChangeKeyword('');
    } else {
      onChangeKeyword(`#${tag}`);
    }
  };

  const snippetExtraClass = [
    prefs.previewLines > 0 ? getLineClampClass(prefs.previewLines) : '',
    prefs.snippetJustify ? 'sph-snippet-justify' : '',
    prefs.snippetIndent ? 'sph-snippet-indent' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const renderDocIcon = (doc: DocPreviewItem) => {
    if (doc.icon?.type === 'emoji') {
      return <span className="text-[14px] shrink-0">{doc.icon.value}</span>;
    }
    if (doc.icon?.type === 'image' && !failedIconIds.has(doc.id)) {
      return (
        <img
          src={doc.icon.value}
          alt=""
          className="w-4 h-4 rounded-sm object-contain shrink-0"
          onError={() => setFailedIconIds((prev) => new Set(prev).add(doc.id))}
        />
      );
    }
    return (
      <FileText
        size={14}
        className="shrink-0"
        style={{ color: 'var(--sph-subtle)' }}
      />
    );
  };

  const renderTags = (doc: DocPreviewItem) => {
    if (!prefs.showTags || doc.tags.length === 0) return null;
    return doc.tags.map((tag) => {
      const isActive = activeTagFilter === tag;
      return (
        <button
          key={tag}
          type="button"
          onClick={(e) => handleClickTag(e, tag)}
          className={`sph-tag-pill ${isActive ? 'sph-tag-pill-active' : ''}`}
          title={isActive ? '点击取消标签筛选' : `按 #${tag} 筛选`}
        >
          #{tag}
        </button>
      );
    });
  };

  const renderDocItem = (doc: DocPreviewItem) => {
    const displayTs =
      activeTab === 'read' ? (doc.readAtMs ?? doc.updatedAtMs) : doc.updatedAtMs;
    const showThumb = prefs.showThumbnail && Boolean(doc.thumbnailUrl) && !failedThumbIds.has(doc.id);
    const isCompact = prefs.previewLines === 0;

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
          {showThumb && doc.thumbnailUrl && (
            <div
              className="w-full h-44 overflow-hidden"
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
          <div className="p-5 flex-1 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 font-medium text-[15.5px] leading-snug">
                {renderDocIcon(doc)}
                <span className="truncate">{doc.title}</span>
              </div>
              {!isCompact && doc.snippet && (
                <p
                  className={`text-[13.5px] mt-2 leading-[1.75] ${snippetExtraClass}`}
                  style={{ color: 'var(--sph-muted)' }}
                >
                  {doc.snippet}
                </p>
              )}
            </div>

            <div
              className="flex items-center flex-wrap gap-1.5 text-[11px] pt-2"
              style={{
                color: 'var(--sph-subtle)',
                borderTop: '1px solid var(--sph-hairline)',
              }}
            >
              {doc.notebookName && <span>{doc.notebookName}</span>}
              {renderTags(doc)}
              <span className="ml-auto sph-num-font shrink-0">
                {formatRelativeTime(displayTs, nowMs)}
              </span>
            </div>
          </div>
        </article>
      );
    }

    // Compact list row (previewLines === 0, inspired by Notebook Navigator Compact Mode)
    if (isCompact) {
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
          className="sph-doc-row px-2.5 py-2.5 flex items-center gap-3 cursor-pointer"
        >
          {renderDocIcon(doc)}
          <span className="font-medium text-[14.5px] truncate flex-1 min-w-0">
            {doc.title}
          </span>
          <div className="flex items-center gap-1.5 shrink-0 text-[11px]" style={{ color: 'var(--sph-subtle)' }}>
            {renderTags(doc)}
            {doc.notebookName && (
              <span className="hidden sm:inline px-1.5">{doc.notebookName}</span>
            )}
            <span className="sph-num-font min-w-[44px] text-right">
              {formatRelativeTime(displayTs, nowMs)}
            </span>
          </div>
        </article>
      );
    }

    // Editorial / Notebook Navigator list row
    const thumbSizeClass =
      prefs.previewLines === 1 ? 'w-16 h-12' : 'w-[76px] h-[76px]';

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
        className="sph-doc-row px-2.5 py-3.5 flex gap-4 cursor-pointer"
      >
        <div className="min-w-0 flex-1 flex flex-col justify-between gap-1.5">
          <div>
            <div className="flex items-center gap-2 font-medium text-[15.5px] leading-snug">
              {renderDocIcon(doc)}
              <span className="truncate">{doc.title}</span>
            </div>

            {doc.snippet && (
              <p
                className={`text-[13.5px] mt-1.5 leading-[1.7] ${snippetExtraClass}`}
                style={{ color: 'var(--sph-muted)' }}
              >
                {doc.snippet}
              </p>
            )}
          </div>

          <div
            className="flex items-center flex-wrap gap-2 text-[11.5px] mt-1"
            style={{ color: 'var(--sph-subtle)' }}
          >
            {doc.notebookName && (
              <span className="inline-flex items-center gap-1">
                <Folder size={11} />
                {doc.notebookName}
              </span>
            )}
            {renderTags(doc)}
            <span className="ml-auto sph-num-font shrink-0">
              {formatRelativeTime(displayTs, nowMs)}
            </span>
          </div>
        </div>

        {showThumb && doc.thumbnailUrl && (
          <div
            className={`${thumbSizeClass} rounded-xl overflow-hidden shrink-0 self-center`}
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

  const renderDocsCollection = () => {
    const getTs = (d: DocPreviewItem) =>
      activeTab === 'read' ? (d.readAtMs ?? d.updatedAtMs) : d.updatedAtMs;

    if (navigatorMode && prefs.groupByDate) {
      const groups = groupDocsByDateBucket(items, getTs, nowMs);
      return (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <div key={group.key} className="flex flex-col gap-2">
              <div className="sph-date-group-header">
                <span>{group.label}</span>
                <span className="sph-num-font text-[11px] opacity-75">
                  {group.items.length}
                </span>
              </div>
              <div
                className={
                  viewStyle === 'grid'
                    ? 'grid grid-cols-1 sm:grid-cols-2 gap-5'
                    : 'flex flex-col'
                }
              >
                {group.items.map(renderDocItem)}
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div
        className={
          viewStyle === 'grid' && navigatorMode
            ? 'grid grid-cols-1 sm:grid-cols-2 gap-5'
            : 'flex flex-col'
        }
      >
        {items.map(renderDocItem)}
      </div>
    );
  };

  if (navigatorMode) {
    const diaryNb = openNotebooks.find((nb) => nb.id === diaryNotebookId);
    const diaryIsHidden = Boolean(diaryNb && hiddenSet.has(diaryNb.id));

    return (
      <section className="sph-notes-split">
        {/* Left Notebook Navigator Sidebar */}
        <aside
          className="flex flex-col gap-5 pr-3"
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
            <div className="flex items-center justify-between px-2.5 pb-1">
              <span className="text-[11px] font-medium" style={{ color: 'var(--sph-subtle)' }}>
                笔记本
              </span>
              {(hiddenSet.size + hiddenIdsCount) > 0 && (
                <span className="text-[10.5px] sph-num-font" style={{ color: 'var(--sph-subtle)' }}>
                  已屏蔽 {hiddenSet.size + hiddenIdsCount}
                </span>
              )}
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
            {openNotebooks.map((nb) => {
              const isHidden = hiddenSet.has(nb.id);
              const isSelected = notebookId === nb.id;
              return (
                <div
                  key={nb.id}
                  className="flex items-center gap-1 rounded-lg transition-colors"
                  style={{
                    backgroundColor: isSelected ? 'var(--sph-wash-hover)' : 'transparent',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onChangeNotebook(nb.id)}
                    className="flex-1 min-w-0 px-3 py-1.5 text-[13px] flex items-center gap-2 text-left"
                    style={{
                      color: isSelected
                        ? 'var(--sph-text)'
                        : isHidden
                          ? 'var(--sph-subtle)'
                          : 'var(--sph-muted)',
                      fontWeight: isSelected ? 600 : 400,
                    }}
                  >
                    <Folder size={13} className="shrink-0" />
                    <span className="truncate">{nb.name}</span>
                  </button>
                  {onToggleHiddenNotebook && (
                    <button
                      type="button"
                      aria-label={
                        isHidden
                          ? `取消隐藏笔记本 ${nb.name}`
                          : `在全部近期笔记中隐藏笔记本 ${nb.name}`
                      }
                      title={
                        isHidden
                          ? '已从「全部笔记本」与「总览」中隐藏，点击恢复显示'
                          : '从「全部笔记本」与「总览」中隐藏此笔记本'
                      }
                      onClick={() => onToggleHiddenNotebook(nb.id)}
                      className="p-1.5 mr-1 rounded-md shrink-0 transition-opacity"
                      style={{
                        color: isHidden ? 'var(--sph-accent)' : 'var(--sph-subtle)',
                        opacity: isHidden ? 1 : 0.45,
                      }}
                    >
                      {isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {(onToggleHiddenNotebook || onOpenHiddenIdsSettings) && (
            <div className="pt-3 px-2.5 flex flex-col gap-2.5" style={{ borderTop: '1px solid var(--sph-hairline)' }}>
              {onToggleHiddenNotebook && diaryNb && (
                <label
                  className="flex items-center justify-between gap-2 text-xs cursor-pointer select-none"
                  style={{ color: 'var(--sph-muted)' }}
                  title={`将当前日记本「${diaryNb.name}」从全部近期笔记与总览中整体隐藏（含年/月父文档）`}
                >
                  <span className="truncate">隐藏日记本</span>
                  <span className="sph-switch">
                    <input
                      type="checkbox"
                      aria-label="隐藏日记本"
                      checked={diaryIsHidden}
                      onChange={() => onToggleHiddenNotebook(diaryNb.id)}
                    />
                    <span className="sph-switch-track">
                      <span className="sph-switch-thumb" />
                    </span>
                  </span>
                </label>
              )}
              {onOpenHiddenIdsSettings && (
                <button
                  type="button"
                  onClick={onOpenHiddenIdsSettings}
                  className="sph-btn w-full py-1.5 text-xs justify-between px-2.5"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <EyeOff size={12} />
                    <span>按 ID 屏蔽管理</span>
                  </span>
                  {hiddenIdsCount > 0 && (
                    <span className="sph-num-font text-[11px]" style={{ color: 'var(--sph-accent)' }}>
                      {hiddenIdsCount}
                    </span>
                  )}
                </button>
              )}
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--sph-subtle)' }}>
                支持按笔记本或父文档 ID 屏蔽其下全部子文档。
              </p>
            </div>
          )}
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
                className="sph-input w-full py-2 pl-9 pr-8 text-[13px]"
              />
              {keyword && (
                <button
                  type="button"
                  aria-label="清除搜索"
                  onClick={() => onChangeKeyword('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded"
                  style={{ color: 'var(--sph-subtle)' }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Notebook Navigator style Display Appearance Popover */}
              <div className="relative" ref={popoverRef}>
                <button
                  type="button"
                  aria-label="卡片显示外观"
                  aria-expanded={popoverOpen}
                  onClick={() => setPopoverOpen((v) => !v)}
                  className="sph-btn px-2.5 py-1.5 text-xs"
                  style={
                    popoverOpen
                      ? {
                          borderColor: 'var(--sph-accent)',
                          color: 'var(--sph-accent)',
                          backgroundColor: 'var(--sph-accent-soft)',
                        }
                      : undefined
                  }
                >
                  <SlidersHorizontal size={13} />
                  <span>外观</span>
                </button>

                {popoverOpen && (
                  <div
                    role="dialog"
                    aria-label="笔记卡片外观设置"
                    className="sph-popover absolute right-0 top-full mt-2 w-72 p-4 z-[3] flex flex-col gap-3.5"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">预览行数</span>
                        <span style={{ color: 'var(--sph-subtle)' }}>
                          {prefs.previewLines === 0 ? '紧凑模式' : `${prefs.previewLines} 行`}
                        </span>
                      </div>
                      <div
                        className="grid grid-cols-6 gap-1 p-1 rounded-lg"
                        style={{ backgroundColor: 'var(--sph-wash)' }}
                      >
                        {PREVIEW_LINE_OPTIONS.map((n) => {
                          const active = prefs.previewLines === n;
                          return (
                            <button
                              key={n}
                              type="button"
                              aria-label={n === 0 ? '紧凑模式（0行）' : `预览 ${n} 行`}
                              aria-pressed={active}
                              onClick={() => patchPrefs({ previewLines: n })}
                              className="py-1 rounded-md text-xs sph-num-font font-medium transition-colors"
                              style={{
                                backgroundColor: active ? 'var(--sph-card)' : 'transparent',
                                color: active ? 'var(--sph-accent)' : 'var(--sph-muted)',
                                boxShadow: active ? 'var(--sph-shadow-soft)' : 'none',
                              }}
                            >
                              {n}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div
                      className="flex flex-col gap-2.5 pt-3"
                      style={{ borderTop: '1px solid var(--sph-hairline)' }}
                    >
                      <label className="flex items-center justify-between text-xs cursor-pointer select-none">
                        <span>按时间分组</span>
                        <span className="sph-switch">
                          <input
                            type="checkbox"
                            checked={prefs.groupByDate}
                            onChange={(e) => patchPrefs({ groupByDate: e.target.checked })}
                          />
                          <span className="sph-switch-track">
                            <span className="sph-switch-thumb" />
                          </span>
                        </span>
                      </label>

                      <label className="flex items-center justify-between text-xs cursor-pointer select-none">
                        <span>显示缩略图</span>
                        <span className="sph-switch">
                          <input
                            type="checkbox"
                            checked={prefs.showThumbnail}
                            onChange={(e) => patchPrefs({ showThumbnail: e.target.checked })}
                          />
                          <span className="sph-switch-track">
                            <span className="sph-switch-thumb" />
                          </span>
                        </span>
                      </label>

                      <label className="flex items-center justify-between text-xs cursor-pointer select-none">
                        <span>显示标签</span>
                        <span className="sph-switch">
                          <input
                            type="checkbox"
                            checked={prefs.showTags}
                            onChange={(e) => patchPrefs({ showTags: e.target.checked })}
                          />
                          <span className="sph-switch-track">
                            <span className="sph-switch-thumb" />
                          </span>
                        </span>
                      </label>
                    </div>

                    <div
                      className="flex flex-col gap-2.5 pt-3"
                      style={{ borderTop: '1px solid var(--sph-hairline)' }}
                    >
                      <div className="text-[11px]" style={{ color: 'var(--sph-subtle)' }}>
                        摘要排版
                      </div>
                      <label className="flex items-center justify-between text-xs cursor-pointer select-none">
                        <span>两端对齐</span>
                        <span className="sph-switch">
                          <input
                            type="checkbox"
                            checked={prefs.snippetJustify}
                            onChange={(e) => patchPrefs({ snippetJustify: e.target.checked })}
                          />
                          <span className="sph-switch-track">
                            <span className="sph-switch-thumb" />
                          </span>
                        </span>
                      </label>

                      <label className="flex items-center justify-between text-xs cursor-pointer select-none">
                        <span>首行缩进 2 字</span>
                        <span className="sph-switch">
                          <input
                            type="checkbox"
                            checked={prefs.snippetIndent}
                            onChange={(e) => patchPrefs({ snippetIndent: e.target.checked })}
                          />
                          <span className="sph-switch-track">
                            <span className="sph-switch-thumb" />
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* List / Grid View Switcher */}
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
          </div>

          {loading && items.length === 0 ? (
            <div className="sph-panel py-12 text-center text-xs" style={{ color: 'var(--sph-muted)' }}>
              正在加载笔记预览…
            </div>
          ) : items.length === 0 ? (
            <div className="sph-panel py-14 px-6 text-center text-[13px]" style={{ color: 'var(--sph-muted)' }}>
              {activeTab === 'read'
                ? '从现在开始，你打开浏览过的笔记会自动出现在这里。'
                : '没有符合条件的笔记。'}
            </div>
          ) : (
            renderDocsCollection()
          )}

          {hasMore && (
            <button
              type="button"
              className="sph-btn w-full py-2.5 text-xs"
              disabled={loading}
              onClick={onLoadMore}
            >
              {loading ? '正在加载…' : '加载更多'}
            </button>
          )}
        </div>
      </section>
    );
  }

  // Compact standalone mode (also preserves backwards compatibility for direct unit tests)
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className="inline-flex rounded-lg p-0.5 gap-0.5"
          style={{ backgroundColor: 'var(--sph-wash)' }}
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'modified'}
            onClick={() => onChangeTab('modified')}
            className="px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5"
            style={{
              backgroundColor: activeTab === 'modified' ? 'var(--sph-card)' : 'transparent',
              color: activeTab === 'modified' ? 'var(--sph-text)' : 'var(--sph-muted)',
            }}
          >
            <Clock size={12} />
            <span>最近改过</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'read'}
            onClick={() => onChangeTab('read')}
            className="px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5"
            style={{
              backgroundColor: activeTab === 'read' ? 'var(--sph-card)' : 'transparent',
              color: activeTab === 'read' ? 'var(--sph-text)' : 'var(--sph-muted)',
            }}
          >
            <Eye size={12} />
            <span>最近读过</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <select
            aria-label="按笔记本筛选"
            className="sph-select text-xs py-1 pl-2.5 pr-7 max-w-[130px]"
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

          {onToggleHideDailyNotes && (
            <label
              className="flex items-center gap-1.5 text-xs cursor-pointer select-none"
              style={{ color: 'var(--sph-muted)' }}
            >
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
              <span>隐藏日记</span>
            </label>
          )}
        </div>
      </div>

      <div className="relative">
        <Search
          size={13}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--sph-subtle)' }}
        />
        <input
          type="text"
          aria-label="搜索最近笔记"
          placeholder="筛选标题、路径或标签..."
          value={keyword}
          onChange={(e) => onChangeKeyword(e.target.value)}
          className="sph-input w-full py-1.5 pl-8 pr-3 text-xs"
        />
      </div>

      {loading && items.length === 0 ? (
        <div className="py-10 text-center text-xs" style={{ color: 'var(--sph-muted)' }}>
          正在加载笔记预览…
        </div>
      ) : items.length === 0 ? (
        <div className="sph-panel py-10 px-4 text-center text-xs" style={{ color: 'var(--sph-muted)' }}>
          {activeTab === 'read'
            ? '从现在开始，你打开浏览过的笔记会自动出现在这里。'
            : '没有符合条件的笔记。'}
        </div>
      ) : (
        <div className="flex flex-col">{items.map(renderDocItem)}</div>
      )}

      {hasMore && (
        <button
          type="button"
          className="sph-btn w-full py-2 text-xs"
          disabled={loading}
          onClick={onLoadMore}
        >
          {loading ? '正在加载…' : '加载更多'}
        </button>
      )}
    </section>
  );
};
