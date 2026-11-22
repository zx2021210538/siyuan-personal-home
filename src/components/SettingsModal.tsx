import React, { useEffect, useRef, useState } from 'react';
import { Download, EyeOff, Upload, X } from 'lucide-react';
import { validateBackupBundle } from '../domain/storeMerge';
import type { PluginSettings, TopBarPosition, WeekStartDay } from '../domain/types';
import type { SiYuanNotebook } from '../services/siyuanApi';

export interface SettingsModalProps {
  open: boolean;
  settings: PluginSettings;
  notebooks?: SiYuanNotebook[];
  diaryNotebookId?: string;
  onClose: () => void;
  onChangeSettings: (patch: Partial<PluginSettings>) => void;
  onToggleHiddenNotebook?: (nbId: string) => void;
  onExportJson: () => Promise<void>;
  onImportJson: (raw: unknown) => Promise<void>;
}

const PREVIEW_OPTIONS = [0, 1, 2, 3, 4, 5] as const;

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  settings,
  notebooks = [],
  diaryNotebookId = '',
  onClose,
  onChangeSettings,
  onToggleHiddenNotebook,
  onExportJson,
  onImportJson,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

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
            <span>跟随思源主题强调色</span>
            <label className="sph-switch">
              <input
                type="checkbox"
                checked={settings.useThemeAccent}
                onChange={(e) => onChangeSettings({ useThemeAccent: e.target.checked })}
              />
              <span className="sph-switch-track">
                <span className="sph-switch-thumb" />
              </span>
            </label>
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

          {notebooks.filter((nb) => !nb.closed).length > 0 && onToggleHiddenNotebook && (
            <div
              className="pt-3.5 flex flex-col gap-2"
              style={{ borderTop: '1px solid var(--sph-border)' }}
            >
              <div>
                <div className="font-medium">在近期笔记中隐藏指定笔记本</div>
                <div className="text-[11px] mt-0.5" style={{ color: 'var(--sph-subtle)' }}>
                  勾选后，该笔记本内的全部文档（含日记及年/月父文档）不会出现在「总览」与「全部笔记本」中
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
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
