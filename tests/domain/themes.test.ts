import { describe, expect, it } from 'vitest';
import {
  BUILTIN_DARK_THEMES,
  BUILTIN_LIGHT_THEMES,
  buildThemeCssVars,
  getContrastForeground,
  normalizeHexColor,
  resolveActiveTheme,
} from '../../src/domain/themes';
import type { HomeThemePreset } from '../../src/domain/types';

describe('Independent Home Theme System', () => {
  it('ships 4 built-in light themes and 4 built-in dark themes with valid hex colors', () => {
    expect(BUILTIN_LIGHT_THEMES.length).toBe(4);
    expect(BUILTIN_DARK_THEMES.length).toBe(4);
    for (const theme of [...BUILTIN_LIGHT_THEMES, ...BUILTIN_DARK_THEMES]) {
      for (const hex of Object.values(theme.colors)) {
        expect(hex).toMatch(/^#[0-9A-F]{6}$/);
      }
    }
  });

  it('normalizes 3-digit and 6-digit hex colors and calculates readable accent foreground contrast', () => {
    expect(normalizeHexColor('#abc', '#000000')).toBe('#AABBCC');
    expect(normalizeHexColor('invalid', '#123456')).toBe('#123456');
    expect(getContrastForeground('#3E6B5C')).toBe('#FFFFFF');
    expect(getContrastForeground('#FACC15')).toBe('#18181B');
  });

  it('resolves built-in and custom themes and emits SiYuan-independent CSS vars', () => {
    const custom: HomeThemePreset = {
      id: 'custom-sage',
      name: '豆沙护眼',
      mode: 'light',
      colors: {
        canvas: '#EDF3EE',
        surface: '#F7FAF7',
        wash: '#E2ECE4',
        text: '#1F2A22',
        muted: '#5D6E62',
        accent: '#2E7D5B',
      },
    };
    const resolved = resolveActiveTheme('custom-sage', [custom]);
    expect(resolved.name).toBe('豆沙护眼');

    const vars = buildThemeCssVars(resolved);
    expect(vars['--sph-canvas']).toBe('#EDF3EE');
    expect(vars['--sph-card']).toBe('#F7FAF7');
    expect(vars['--sph-accent']).toBe('#2E7D5B');
    expect(Object.values(vars).join(' ')).not.toContain('--b3-theme-');

    const fallback = resolveActiveTheme('non-existent-id', []);
    expect(fallback.id).toBe('light-parchment');
  });
});
