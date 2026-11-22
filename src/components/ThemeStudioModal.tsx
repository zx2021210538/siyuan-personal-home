import React, { useEffect, useState } from 'react';
import { Check, Moon, Palette, Pencil, Plus, Sun, Trash2, X } from 'lucide-react';
import {
  BUILTIN_DARK_THEMES,
  BUILTIN_LIGHT_THEMES,
  getContrastForeground,
  normalizeHexColor,
} from '../domain/themes';
import type { HomeThemeColors, HomeThemeMode, HomeThemePreset } from '../domain/types';

export interface ThemeStudioModalProps {
  open: boolean;
  activeTheme: HomeThemePreset;
  customThemes: HomeThemePreset[];
  onClose: () => void;
  onSelectTheme: (themeId: string) => void;
  onSaveCustomTheme: (theme: HomeThemePreset, activate: boolean) => void;
  onDeleteCustomTheme: (themeId: string) => void;
  onPreviewTheme: (theme: HomeThemePreset | null) => void;
}

const COLOR_FIELDS: Array<{ key: keyof HomeThemeColors; label: string; hint: string }> = [
  { key: 'canvas', label: '画布背景', hint: '整页底层背景' },
  { key: 'surface', label: '卡片背景', hint: '卡片与弹窗底色' },
  { key: 'wash', label: '柔和铺底', hint: '次级区块与输入框' },
  { key: 'text', label: '主文字色', hint: '标题与正文颜色' },
  { key: 'muted', label: '次级文字', hint: '摘要与辅助说明' },
  { key: 'accent', label: '主题强调色', hint: '按钮、选中态与热力图' },
];

export const ThemeStudioModal: React.FC<ThemeStudioModalProps> = ({
  open,
  activeTheme,
  customThemes,
  onClose,
  onSelectTheme,
  onSaveCustomTheme,
  onDeleteCustomTheme,
  onPreviewTheme,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftMode, setDraftMode] = useState<HomeThemeMode>('light');
  const [draftColors, setDraftColors] = useState<HomeThemeColors>(activeTheme.colors);
  const [hexInputs, setHexInputs] = useState<HomeThemeColors>(activeTheme.colors);

  useEffect(() => {
    if (!open) {
      setEditorOpen(false);
      setEditingId(null);
      onPreviewTheme(null);
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onPreviewTheme(null);
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, onPreviewTheme]);

  if (!open) return null;

  const startCreateFromCurrent = () => {
    const base = activeTheme;
    setEditingId(null);
    setDraftName(`${base.name} · 自定义`);
    setDraftMode(base.mode);
    setDraftColors({ ...base.colors });
    setHexInputs({ ...base.colors });
    setEditorOpen(true);
    onPreviewTheme({
      id: '__preview__',
      name: `${base.name} · 自定义`,
      mode: base.mode,
      colors: { ...base.colors },
    });
  };

  const startEditCustom = (theme: HomeThemePreset) => {
    setEditingId(theme.id);
    setDraftName(theme.name);
    setDraftMode(theme.mode);
    setDraftColors({ ...theme.colors });
    setHexInputs({ ...theme.colors });
    setEditorOpen(true);
    onPreviewTheme({ ...theme });
  };

  const updateDraftColor = (key: keyof HomeThemeColors, raw: string) => {
    setHexInputs((prev) => ({ ...prev, [key]: raw }));
    const normalized = normalizeHexColor(raw, '');
    if (normalized) {
      const nextColors = { ...draftColors, [key]: normalized };
      setDraftColors(nextColors);
      onPreviewTheme({
        id: editingId ?? '__preview__',
        name: draftName.trim() || '自定义主题',
        mode: draftMode,
        colors: nextColors,
      });
    }
  };

  const updateDraftMode = (mode: HomeThemeMode) => {
    setDraftMode(mode);
    onPreviewTheme({
      id: editingId ?? '__preview__',
      name: draftName.trim() || '自定义主题',
      mode,
      colors: draftColors,
    });
  };

  const handleSave = () => {
    const cleanName = draftName.trim() || '我的自定义主题';
    const id = editingId ?? `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const saved: HomeThemePreset = {
      id,
      name: cleanName,
      mode: draftMode,
      description: draftMode === 'dark' ? '自定义暗色配色' : '自定义亮色配色',
      colors: { ...draftColors },
      builtIn: false,
    };
    onPreviewTheme(null);
    onSaveCustomTheme(saved, true);
    setEditorOpen(false);
    setEditingId(null);
  };

  const handleCancelEditor = () => {
    onPreviewTheme(null);
    setEditorOpen(false);
    setEditingId(null);
  };

  const renderSwatchCard = (theme: HomeThemePreset, allowManage = false) => {
    const isActive = !editorOpen && activeTheme.id === theme.id;
    const c = theme.colors;
    const accentFg = getContrastForeground(c.accent);

    return (
      <div
        key={theme.id}
        role="button"
        tabIndex={0}
        aria-pressed={isActive}
        onClick={() => {
          onPreviewTheme(null);
          setEditorOpen(false);
          setEditingId(null);
          onSelectTheme(theme.id);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onPreviewTheme(null);
            setEditorOpen(false);
            setEditingId(null);
            onSelectTheme(theme.id);
          }
        }}
        className="rounded-xl p-3 flex flex-col gap-2.5 cursor-pointer transition-all text-left"
        style={{
          backgroundColor: 'var(--sph-wash)',
          border: `1.5px solid ${isActive ? 'var(--sph-accent)' : 'var(--sph-hairline)'}`,
        }}
      >
        {/* Mini visual theme preview */}
        <div
          className="rounded-lg p-2.5 flex flex-col gap-2"
          style={{
            backgroundColor: c.canvas,
            border: `1px solid color-mix(in srgb, ${c.text} 12%, transparent)`,
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: c.accent }}
              />
              <span
                className="text-[11px] font-medium"
                style={{ color: c.text }}
              >
                静谧书房
              </span>
            </div>
            <span
              className="px-1.5 py-0.5 rounded text-[9px] font-medium"
              style={{ backgroundColor: c.accent, color: accentFg }}
            >
              总览
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div
              className="rounded-md p-1.5 flex flex-col gap-1"
              style={{ backgroundColor: c.surface }}
            >
              <span
                className="h-1.5 w-10 rounded-full"
                style={{ backgroundColor: c.text, opacity: 0.72 }}
              />
              <span
                className="h-1 w-14 rounded-full"
                style={{ backgroundColor: c.muted, opacity: 0.55 }}
              />
            </div>
            <div
              className="rounded-md p-1.5 flex items-center gap-1"
              style={{ backgroundColor: c.wash }}
            >
              {[0.25, 0.5, 0.75, 1].map((op) => (
                <span
                  key={op}
                  className="w-2.5 h-2.5 rounded-[3px]"
                  style={{ backgroundColor: c.accent, opacity: op }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Title & actions */}
        <div className="flex items-center justify-between gap-2 px-0.5">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[13px] font-medium truncate">
              <span className="truncate">{theme.name}</span>
              {isActive && (
                <span
                  className="w-4 h-4 rounded-full inline-flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'var(--sph-accent)', color: 'var(--sph-accent-fg)' }}
                >
                  <Check size={10} strokeWidth={3} />
                </span>
              )}
            </div>
            {theme.description && (
              <div className="text-[11px] truncate mt-0.5" style={{ color: 'var(--sph-subtle)' }}>
                {theme.description}
              </div>
            )}
          </div>

          {allowManage && (
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                aria-label={`编辑自定义主题 ${theme.name}`}
                className="sph-btn-ghost !p-1"
                onClick={(e) => {
                  e.stopPropagation();
                  startEditCustom(theme);
                }}
              >
                <Pencil size={12} />
              </button>
              <button
                type="button"
                aria-label={`删除自定义主题 ${theme.name}`}
                className="sph-btn-ghost !p-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteCustomTheme(theme.id);
                }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className="sph-backdrop fixed inset-0 z-[1050] flex items-center justify-center p-4"
      onClick={() => {
        onPreviewTheme(null);
        onClose();
      }}
    >
      <div
        role="dialog"
        aria-label="个人主页独立主题配色"
        className="sph-modal w-full max-w-2xl max-h-[88vh] overflow-y-auto p-6 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className="w-8 h-8 rounded-xl inline-flex items-center justify-center"
              style={{
                backgroundColor: 'var(--sph-accent-soft)',
                color: 'var(--sph-accent)',
              }}
            >
              <Palette size={16} />
            </span>
            <div>
              <h3 className="text-base font-medium">独立主题配色</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--sph-muted)' }}>
                完全独立于思源笔记主题，预置 8 套亮/暗方案并支持自由配置保存
              </p>
            </div>
          </div>
          <button
            type="button"
            className="sph-btn-ghost !p-1.5"
            aria-label="关闭主题工坊"
            onClick={() => {
              onPreviewTheme(null);
              onClose();
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Custom Theme Editor Panel */}
        {editorOpen ? (
          <div
            className="rounded-xl p-4 sm:p-5 flex flex-col gap-4"
            style={{
              backgroundColor: 'var(--sph-wash)',
              border: '1px solid var(--sph-border-strong)',
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[14px] font-medium">
                {editingId ? '编辑自定义主题' : '新建自定义主题'}
              </div>
              <span className="text-[11px]" style={{ color: 'var(--sph-subtle)' }}>
                调整颜色时背景主页会同步实时预览
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                aria-label="自定义主题名称"
                placeholder="给你的配色方案起个名字..."
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="sph-input flex-1 min-w-[180px] py-2 px-3 text-[13px]"
              />
              <div
                className="inline-flex rounded-lg p-0.5 gap-0.5"
                style={{ backgroundColor: 'var(--sph-card)', border: '1px solid var(--sph-hairline)' }}
              >
                <button
                  type="button"
                  onClick={() => updateDraftMode('light')}
                  className="px-2.5 py-1 rounded-md text-xs inline-flex items-center gap-1"
                  style={{
                    backgroundColor: draftMode === 'light' ? 'var(--sph-accent-soft)' : 'transparent',
                    color: draftMode === 'light' ? 'var(--sph-accent)' : 'var(--sph-muted)',
                  }}
                >
                  <Sun size={12} />
                  <span>亮色</span>
                </button>
                <button
                  type="button"
                  onClick={() => updateDraftMode('dark')}
                  className="px-2.5 py-1 rounded-md text-xs inline-flex items-center gap-1"
                  style={{
                    backgroundColor: draftMode === 'dark' ? 'var(--sph-accent-soft)' : 'transparent',
                    color: draftMode === 'dark' ? 'var(--sph-accent)' : 'var(--sph-muted)',
                  }}
                >
                  <Moon size={12} />
                  <span>暗色</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {COLOR_FIELDS.map((field) => (
                <div
                  key={field.key}
                  className="rounded-xl px-3 py-2.5 flex items-center justify-between gap-2.5"
                  style={{
                    backgroundColor: 'var(--sph-card)',
                    border: '1px solid var(--sph-hairline)',
                  }}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium">{field.label}</div>
                    <div className="text-[10.5px]" style={{ color: 'var(--sph-subtle)' }}>
                      {field.hint}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="color"
                      aria-label={`${field.label} 取色器`}
                      value={draftColors[field.key]}
                      onChange={(e) => updateDraftColor(field.key, e.target.value)}
                      className="sph-color-swatch"
                    />
                    <input
                      type="text"
                      aria-label={`${field.label} 色值`}
                      value={hexInputs[field.key]}
                      onChange={(e) => updateDraftColor(field.key, e.target.value)}
                      className="sph-input sph-num-font w-[82px] py-1 px-2 text-xs uppercase"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button type="button" className="sph-btn px-3.5 py-1.5" onClick={handleCancelEditor}>
                取消
              </button>
              <button
                type="button"
                className="sph-btn sph-btn-primary px-4 py-1.5"
                onClick={handleSave}
              >
                <Check size={13} />
                <span>{editingId ? '保存修改' : '保存并启用'}</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Light Presets */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--sph-muted)' }}>
                <Sun size={13} />
                <span>亮色预设</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {BUILTIN_LIGHT_THEMES.map((t) => renderSwatchCard(t))}
              </div>
            </div>

            {/* Dark Presets */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--sph-muted)' }}>
                <Moon size={13} />
                <span>暗色预设</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {BUILTIN_DARK_THEMES.map((t) => renderSwatchCard(t))}
              </div>
            </div>

            {/* User Custom Themes */}
            <div
              className="flex flex-col gap-3 pt-4"
              style={{ borderTop: '1px solid var(--sph-hairline)' }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-medium" style={{ color: 'var(--sph-muted)' }}>
                  我的自定义配色（{customThemes.length}）
                </div>
                <button
                  type="button"
                  className="sph-btn px-3 py-1.5 text-xs"
                  onClick={startCreateFromCurrent}
                >
                  <Plus size={13} />
                  <span>基于当前主题自定义</span>
                </button>
              </div>

              {customThemes.length === 0 ? (
                <div
                  className="rounded-xl px-4 py-5 text-center text-xs"
                  style={{
                    backgroundColor: 'var(--sph-wash)',
                    color: 'var(--sph-subtle)',
                  }}
                >
                  还没有保存过自定义配色，点击右上角「基于当前主题自定义」即可自由调色并保存。
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {customThemes.map((t) => renderSwatchCard(t, true))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
