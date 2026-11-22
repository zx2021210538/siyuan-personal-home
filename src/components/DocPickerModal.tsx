import React, { useEffect, useState } from 'react';
import { FileText, Search, X } from 'lucide-react';
import type { SearchDocHit } from '../services/siyuanApi';

export interface DocPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSearch: (keyword: string) => Promise<SearchDocHit[]>;
  onSelect: (doc: { id: string; title: string }) => void;
}

export const DocPickerModal: React.FC<DocPickerModalProps> = ({
  open,
  onClose,
  onSearch,
  onSelect,
}) => {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<SearchDocHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const hits = await onSearch(keyword);
        if (!cancelled) setResults(hits);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, keyword, onSearch]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="sph-backdrop fixed inset-0 z-[1000] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="sph-modal w-full max-w-md p-5 flex flex-col gap-3.5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold m-0">关联思源笔记</h3>
          <button type="button" className="sph-btn !p-1" aria-label="关闭" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--sph-muted)' }}
          />
          <input
            type="text"
            aria-label="搜索关联文档"
            placeholder="输入文档标题关键词..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="sph-input w-full !pl-8"
            autoFocus
          />
        </div>

        <div className="max-h-64 overflow-y-auto flex flex-col gap-1">
          {loading ? (
            <div className="text-xs py-4 text-center" style={{ color: 'var(--sph-muted)' }}>
              搜索中…
            </div>
          ) : results.length === 0 ? (
            <div className="text-xs py-4 text-center" style={{ color: 'var(--sph-muted)' }}>
              未找到匹配的文档
            </div>
          ) : (
            results.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => {
                  onSelect({ id: doc.id, title: doc.content || doc.hpath });
                  onClose();
                }}
                className="w-full text-left px-3 py-2 rounded-lg border-0 bg-transparent cursor-pointer flex items-start gap-2 hover:opacity-80"
                style={{ backgroundColor: 'var(--sph-surface)', color: 'var(--sph-text)' }}
              >
                <FileText size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--sph-muted)' }} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate">{doc.content || '未命名文档'}</div>
                  <div className="text-[11px] truncate" style={{ color: 'var(--sph-muted)' }}>
                    {doc.hpath}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
