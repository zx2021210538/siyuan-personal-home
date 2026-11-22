import React, { useRef, useState } from 'react';
import { Download, Upload, X } from 'lucide-react';
import type { PluginSettings, TopBarPosition, WeekStartDay } from '../domain/types';

export interface SettingsModalProps {
  open: boolean;
  settings: PluginSettings;
  onClose: () => void;
  onChangeSettings: (patch: Partial<PluginSettings>) => void;
  onExportJson: () => Promise<void>;
  onImportJson: (raw: unknown) => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  settings,
  onClose,
  onChangeSettings,
  onExportJson,
  onImportJson,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
      const confirmed =
        typeof window.confirm === 'function'
          ? window.confirm('导入将覆盖当前的个人主页设置、轻量任务、习惯打卡与最近阅读记录，确定继续吗？')
          : true;
      if (!confirmed) return;
      await onImportJson(parsed);
      setStatusMsg('备份恢复成功，数据已刷新');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '备份文件解析失败');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="sph-card w-full max-w-md p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold m-0">个人主页设置</h3>
          <button type="button" className="sph-btn !p-1" aria-label="关闭设置" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-col gap-3 text-xs">
          <label className="flex items-center justify-between gap-2">
            <span>启动思源时自动打开个人主页</span>
            <input
              type="checkbox"
              checked={settings.autoOpenOnStart}
              onChange={(e) => onChangeSettings({ autoOpenOnStart: e.target.checked })}
            />
          </label>

          <label className="flex items-center justify-between gap-2">
            <span>顶栏图标位置（重载后生效）</span>
            <select
              className="sph-input !py-1 !text-xs"
              value={settings.topBarPosition}
              onChange={(e) =>
                onChangeSettings({ topBarPosition: e.target.value as TopBarPosition })
              }
            >
              <option value="left">顶栏左侧</option>
              <option value="right">顶栏右侧</option>
            </select>
          </label>

          <label className="flex items-center justify-between gap-2">
            <span>每周起始日</span>
            <select
              className="sph-input !py-1 !text-xs"
              value={String(settings.weekStartDay)}
              onChange={(e) =>
                onChangeSettings({ weekStartDay: Number(e.target.value) as WeekStartDay })
              }
            >
              <option value="1">星期一</option>
              <option value="0">星期日</option>
            </select>
          </label>

          <label className="flex items-center justify-between gap-2">
            <span>日历显示未完成待办角标</span>
            <input
              type="checkbox"
              checked={settings.showDiaryTodoBadge}
              onChange={(e) => onChangeSettings({ showDiaryTodoBadge: e.target.checked })}
            />
          </label>

          <label className="flex items-center justify-between gap-2">
            <span>跟随思源主题强调色</span>
            <input
              type="checkbox"
              checked={settings.useThemeAccent}
              onChange={(e) => onChangeSettings({ useThemeAccent: e.target.checked })}
            />
          </label>
        </div>

        <div
          className="pt-3 flex flex-col gap-2"
          style={{ borderTop: '1px solid var(--sph-border)' }}
        >
          <div className="text-xs font-medium">数据备份与恢复</div>
          <div className="text-[11px]" style={{ color: 'var(--sph-muted)' }}>
            所有任务、习惯与打卡记录存放在思源同步目录，可随时导出 JSON 备份或恢复。
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button type="button" className="sph-btn flex-1" onClick={handleExport}>
              <Download size={13} />
              <span>导出 JSON 备份</span>
            </button>
            <button
              type="button"
              className="sph-btn flex-1"
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
            <div className="text-[11px]" style={{ color: '#10b981' }}>
              {statusMsg}
            </div>
          )}
          {errorMsg && (
            <div className="text-[11px]" style={{ color: '#ef4444' }}>
              {errorMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
