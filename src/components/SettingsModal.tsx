import React, { useEffect, useRef, useState } from 'react';
import { Download, EyeOff, FolderSearch, Palette, Plus, Upload, X } from 'lucide-react';
import { parseHiddenIdInput } from '../domain/docPreview';
import { validateBackupBundle } from '../domain/storeMerge';
import type { HomeThemePreset, PluginSettings, TopBarPosition, WeekStartDay } from '../domain/types';
import type { SiYuanNotebook } from '../services/siyuanApi';

export interface SettingsModalProps {
  open: boolean;
  settings: PluginSettings;
  activeTheme?: HomeThemePreset;
  notebooks?: SiYuanNotebook[];
  diaryNotebookId?: string;
  hiddenIdLabels?: Record<string, string>;
  disableEscape?: boolean;
  onClose: () => void;
  onOpenThemeStudio?: () => void;
  onChangeSettings: (patch: Partial<PluginSettings>) => void;
  onToggleHiddenNotebook?: (nbId: string) => void;
  onAddHiddenIds?: (ids: string[]) => void;
  onRemoveHiddenId?: (id: string) => void;
  onPickHiddenDoc?: () => void;
  onExportJson: () => Promise<void>;
  onImportJson: (raw: unknown) => Promise<void>;
}

const PREVIEW_OPTIONS = [0, 1, 2, 3, 4, 5] as const;

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  settings,
  activeTheme,
  notebooks = [],
  diaryNotebookId = '',
  hiddenIdLabels = {},
  disableEscape = false,
  onClose,
  onOpenThemeStudio,
  onChangeSettings,
  onToggleHiddenNotebook,
  onAddHiddenIds,
  onRemoveHiddenId,
  onPickHiddenDoc,
  onExportJson,
  onImportJson,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [hiddenIdDraft, setHiddenIdDraft] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open || disableEscape) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, disableEscape, onClose]);

  const handleSubmitHiddenIds = () => {
    const parsed = parseHiddenIdInput(hiddenIdDraft);
    if (parsed.length === 0) return;
    onAddHiddenIds?.(parsed);
    setHiddenIdDraft('');
  };

  if (!open) return null;

  const handleExport = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await onExportJson();
      setStatusMsg('已导出全部个人主页数据（JSON）');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '导出失败');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      // Validate backup schema BEFORE prompting overwrite confirmation
      const validated = validateBackupBundle(parsed);
      const confirmed =
        typeof window.confirm === 'function'
          ? window.confirm('导入将覆盖当前的个人主页设置、轻量任务、习惯打卡与最近阅读记录，确定继续吗？')
          : true;
      if (!confirmed) return;
      await onImportJson(validated);
      setStatusMsg('备份恢复成功，数据已刷新');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '备份文件解析失败');
    }
  };

  return (
    <div
      className="sph-backdrop fixed inset-0 z-[1000] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="sph-modal w-full max-w-md max-h-[86vh] overflow-y-auto p-6 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">个人主页设置</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--sph-muted)' }}>
              定制入口、日历习惯与主题偏好
            </p>
          </div>
          <button type="button" className="sph-btn-ghost !p-1.5" aria-label="关闭设置" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <div className="flex flex-col gap-3.5 text-[13px]">
          <div className="flex items-center justify-between gap-3">
            <span>启动思源时自动打开个人主页</span>
            <label className="sph-switch">
              <input
                type="checkbox"
                checked={settings.autoOpenOnStart}
                onChange={(e) => onChangeSettings({ autoOpenOnStart: e.target.checked })}
              />
              <span className="sph-switch-track">
                <span className="sph-switch-thumb" />
              </span>
            </label>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <div>顶栏图标位置</div>
              <div className="text-[11px]" style={{ color: 'var(--sph-subtle)' }}>
                下次重载插件后生效
              </div>
            </div>
            <select
              className="sph-select"
              value={settings.topBarPosition}
              onChange={(e) =>
                onChangeSettings({ topBarPosition: e.target.value as TopBarPosition })
              }
            >
              <option value="left">顶栏左侧</option>
              <option value="right">顶栏右侧</option>
            </select>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span>每周起始日</span>
            <select
              className="sph-select"
              value={String(settings.weekStartDay)}
              onChange={(e) =>
                onChangeSettings({ weekStartDay: Number(e.target.value) as WeekStartDay })
              }
            >
              <option value="1">星期一</option>
              <option value="0">星期日</option>
            </select>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span>日历显示未完成待办角标</span>
            <label className="sph-switch">
              <input
                type="checkbox"
                checked={settings.showDiaryTodoBadge}
                onChange={(e) => onChangeSettings({ showDiaryTodoBadge: e.target.checked })}
              />
              <span className="sph-switch-track">
                <span className="sph-switch-thumb" />
              </span>
            </label>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <div>独立主题配色</div>
              <div className="text-[11px] flex items-center gap-1.5 mt-0.5" style={{ color: 'var(--sph-subtle)' }}>
                {activeTheme && (
                  <>
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block"
                      style={{
                        backgroundColor: activeTheme.colors.canvas,
                        border: '1px solid var(--sph-border-strong)',
                      }}
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block"
                      style={{ backgroundColor: activeTheme.colors.accent }}
                    />
                    <span>
                      当前：{activeTheme.name}（{activeTheme.mode === 'dark' ? '暗色' : '亮色'}）
                    </span>
                  </>
                )}
              </div>
            </div>
            {onOpenThemeStudio && (
              <button
                type="button"
                className="sph-btn px-3 py-1.5 text-xs shrink-0"
                onClick={onOpenThemeStudio}
              >
                <Palette size={13} />
                <span>切换 / 自定义</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <div>跟随思源编辑器字体</div>
              <div className="text-[11px]" style={{ color: 'var(--sph-subtle)' }}>
                自动使用你在思源编辑器设置的字体（如霞鹜文楷）
              </div>
            </div>
            <label className="sph-switch">
              <input
                type="checkbox"
                checked={settings.followEditorFont}
                onChange={(e) => onChangeSettings({ followEditorFont: e.target.checked })}
              />
              <span className="sph-switch-track">
                <span className="sph-switch-thumb" />
              </span>
            </label>
          </div>

          <div
            className="pt-3.5 flex flex-col gap-2.5"
            style={{ borderTop: '1px solid var(--sph-border)' }}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">笔记卡片预览行数</span>
              <span className="text-xs" style={{ color: 'var(--sph-subtle)' }}>
                {(settings.previewLines ?? 2) === 0
                  ? '紧凑模式'
                  : `${settings.previewLines ?? 2} 行`}
              </span>
            </div>
            <div
              className="grid grid-cols-6 gap-1 p-1 rounded-lg"
              style={{ backgroundColor: 'var(--sph-wash)' }}
            >
              {PREVIEW_OPTIONS.map((n) => {
                const active = (settings.previewLines ?? 2) === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onChangeSettings({ previewLines: n })}
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

          {(notebooks.filter((nb) => !nb.closed).length > 0 || onAddHiddenIds) && (
            <div
              className="pt-3.5 flex flex-col gap-2.5"
              style={{ borderTop: '1px solid var(--sph-border)' }}
            >
              <div>
                <div className="font-medium">屏蔽指定笔记本 / 父文档 ID</div>
                <div className="text-[11px] mt-0.5 leading-relaxed" style={{ color: 'var(--sph-subtle)' }}>
                  可一键隐藏顶层大笔记本，或输入/选择任意父文档 ID（同时隐藏该文档及其所有子文档，支持一次粘贴多个 ID）
                </div>
              </div>

              {notebooks.filter((nb) => !nb.closed).length > 0 && onToggleHiddenNotebook && (
                <div className="flex flex-wrap gap-1.5">
                  {notebooks
                    .filter((nb) => !nb.closed)
                    .map((nb) => {
                      const isHidden = (settings.hiddenRecentNotebookIds ?? []).includes(nb.id);
                      const isDiary = nb.id === diaryNotebookId;
                      return (
                        <button
                          key={nb.id}
                          type="button"
                          aria-pressed={isHidden}
                          onClick={() => onToggleHiddenNotebook(nb.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors"
                          style={{
                            backgroundColor: isHidden ? 'var(--sph-accent-soft)' : 'var(--sph-wash)',
                            color: isHidden ? 'var(--sph-accent)' : 'var(--sph-muted)',
                            border: `1px solid ${isHidden ? 'var(--sph-accent-border)' : 'var(--sph-hairline)'}`,
                          }}
                        >
                          {isHidden && <EyeOff size={11} />}
                          <span>{nb.name}</span>
                          {isDiary && (
                            <span
                              className="text-[10px] px-1 rounded"
                              style={{
                                backgroundColor: 'var(--sph-card)',
                                color: 'var(--sph-subtle)',
                              }}
                            >
                              日记本
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>
              )}

              {onAddHiddenIds && (
                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      aria-label="输入要隐藏的笔记本或文档 ID"
                      placeholder="粘贴 1 个或多个 ID（逗号/空格分隔）"
                      value={hiddenIdDraft}
                      onChange={(e) => setHiddenIdDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSubmitHiddenIds();
                        }
                      }}
                      className="sph-input flex-1 min-w-0 py-1.5 px-2.5 text-xs"
                    />
                    <button
                      type="button"
                      className="sph-btn px-2.5 py-1.5 text-xs shrink-0"
                      disabled={!hiddenIdDraft.trim()}
                      onClick={handleSubmitHiddenIds}
                    >
                      <Plus size={12} />
                      <span>添加</span>
                    </button>
                    {onPickHiddenDoc && (
                      <button
                        type="button"
                        className="sph-btn px-2.5 py-1.5 text-xs shrink-0"
                        title="搜索并选择要隐藏的父文档（连同子文档一起屏蔽）"
                        onClick={onPickHiddenDoc}
                      >
                        <FolderSearch size={12} />
                        <span>选文档</span>
                      </button>
                    )}
                  </div>

                  {(settings.hiddenRecentIds ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(settings.hiddenRecentIds ?? []).map((hid) => {
                        const resolved = hiddenIdLabels[hid];
                        return (
                          <span
                            key={hid}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] max-w-full"
                            style={{
                              backgroundColor: 'var(--sph-wash)',
                              border: '1px solid var(--sph-hairline)',
                              color: 'var(--sph-text)',
                            }}
                          >
                            <EyeOff size={11} style={{ color: 'var(--sph-accent)' }} className="shrink-0" />
                            <span className="truncate">
                              {resolved ? `${resolved} · ` : ''}
                              <span className="sph-num-font" style={{ color: 'var(--sph-muted)' }}>
                                {hid}
                              </span>
                            </span>
                            {onRemoveHiddenId && (
                              <button
                                type="button"
                                aria-label={`移除隐藏 ID ${hid}`}
                                onClick={() => onRemoveHiddenId(hid)}
                                className="p-0.5 rounded shrink-0"
                                style={{ color: 'var(--sph-subtle)' }}
                              >
                                <X size={11} />
                              </button>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div
          className="pt-4 flex flex-col gap-2.5"
          style={{ borderTop: '1px solid var(--sph-border)' }}
        >
          <div className="text-[13px] font-semibold">数据备份与恢复</div>
          <div className="text-xs leading-relaxed" style={{ color: 'var(--sph-muted)' }}>
            所有任务、习惯与打卡记录存放在思源同步目录，可随时导出 JSON 备份或导入恢复。
          </div>
          <div className="flex items-center gap-2.5 pt-1">
            <button type="button" className="sph-btn flex-1 py-2" onClick={handleExport}>
              <Download size={13} />
              <span>导出 JSON 备份</span>
            </button>
            <button
              type="button"
              className="sph-btn flex-1 py-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={13} />
              <span>导入 JSON 恢复</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {statusMsg && (
            <div className="text-xs font-medium" style={{ color: '#10b981' }}>
              {statusMsg}
            </div>
          )}
          {errorMsg && (
            <div className="text-xs font-medium" style={{ color: '#e11d48' }}>
              {errorMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
