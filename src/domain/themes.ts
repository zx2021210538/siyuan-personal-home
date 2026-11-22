import type { HomeThemeColors, HomeThemePreset } from './types';

export const DEFAULT_THEME_ID = 'light-parchment';

export const BUILTIN_LIGHT_THEMES: HomeThemePreset[] = [
  {
    id: 'light-parchment',
    name: '宣纸素笺',
    mode: 'light',
    description: '温润纸感与黛青绿，久读不累',
    builtIn: true,
    colors: {
      canvas: '#FAF8F4',
      surface: '#FFFFFF',
      wash: '#F2EFE8',
      text: '#26231F',
      muted: '#736C62',
      accent: '#3E6B5C',
    },
  },
  {
    id: 'light-porcelain',
    name: '青瓷云白',
    mode: 'light',
    description: '清透画廊白与北欧晴空蓝',
    builtIn: true,
    colors: {
      canvas: '#F7F9FC',
      surface: '#FFFFFF',
      wash: '#EEF2F7',
      text: '#1D2430',
      muted: '#647084',
      accent: '#3B6FD8',
    },
  },
  {
    id: 'light-latte',
    name: '焦糖拿铁',
    mode: 'light',
    description: '暖奶油书房与赤陶琥珀色',
    builtIn: true,
    colors: {
      canvas: '#FBF6EE',
      surface: '#FFFDF9',
      wash: '#F3E9DD',
      text: '#2E231C',
      muted: '#7D695B',
      accent: '#B85D36',
    },
  },
  {
    id: 'light-mist',
    name: '暮霭丁香',
    mode: 'light',
    description: '柔雾雪白与克制藕荷紫',
    builtIn: true,
    colors: {
      canvas: '#F8F7FC',
      surface: '#FFFFFF',
      wash: '#F0EEF7',
      text: '#242030',
      muted: '#6E6882',
      accent: '#6F56B8',
    },
  },
];

export const BUILTIN_DARK_THEMES: HomeThemePreset[] = [
  {
    id: 'dark-obsidian',
    name: '静夜墨石',
    mode: 'dark',
    description: '深邃石墨灰与静谧星海蓝',
    builtIn: true,
    colors: {
      canvas: '#15181E',
      surface: '#1C2029',
      wash: '#232834',
      text: '#E6EAF2',
      muted: '#8F98AC',
      accent: '#6B96F0',
    },
  },
  {
    id: 'dark-forest',
    name: '幽林松烟',
    mode: 'dark',
    description: '松烟暗青与温润青瓷玉',
    builtIn: true,
    colors: {
      canvas: '#131918',
      surface: '#1A2220',
      wash: '#212C29',
      text: '#E3EBE7',
      muted: '#8CA198',
      accent: '#5EB091',
    },
  },
  {
    id: 'dark-espresso',
    name: '深夜咖啡',
    mode: 'dark',
    description: '暖深烘焙棕与柔光蜜琥珀',
    builtIn: true,
    colors: {
      canvas: '#1A1614',
      surface: '#231E1B',
      wash: '#2C2622',
      text: '#EFE6DC',
      muted: '#A39486',
      accent: '#DA8F55',
    },
  },
  {
    id: 'dark-twilight',
    name: '暮色紫檀',
    mode: 'dark',
    description: '丝绒夜幕紫与柔和紫藤光',
    builtIn: true,
    colors: {
      canvas: '#171520',
      surface: '#201D2C',
      wash: '#292538',
      text: '#EBE7F5',
      muted: '#9991B0',
      accent: '#9E82EF',
    },
  },
];

export const BUILTIN_THEMES: HomeThemePreset[] = [
  ...BUILTIN_LIGHT_THEMES,
  ...BUILTIN_DARK_THEMES,
];

export function normalizeHexColor(raw: string | undefined, fallback: string): string {
  if (!raw || typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return fallback;
}

export function getContrastForeground(hex: string): '#FFFFFF' | '#18181B' {
  const safe = normalizeHexColor(hex, '#3E6B5C');
  const r = parseInt(safe.slice(1, 3), 16) / 255;
  const g = parseInt(safe.slice(3, 5), 16) / 255;
  const b = parseInt(safe.slice(5, 7), 16) / 255;
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return lum > 0.56 ? '#18181B' : '#FFFFFF';
}

export function sanitizeThemeColors(
  colors: Partial<HomeThemeColors> | undefined,
  fallback: HomeThemeColors = BUILTIN_LIGHT_THEMES[0].colors,
): HomeThemeColors {
  return {
    canvas: normalizeHexColor(colors?.canvas, fallback.canvas),
    surface: normalizeHexColor(colors?.surface, fallback.surface),
    wash: normalizeHexColor(colors?.wash, fallback.wash),
    text: normalizeHexColor(colors?.text, fallback.text),
    muted: normalizeHexColor(colors?.muted, fallback.muted),
    accent: normalizeHexColor(colors?.accent, fallback.accent),
  };
}

export function resolveActiveTheme(
  activeThemeId?: string,
  customThemes?: HomeThemePreset[],
): HomeThemePreset {
  const customList = Array.isArray(customThemes) ? customThemes : [];
  const all = [...BUILTIN_THEMES, ...customList];
  const found = activeThemeId ? all.find((t) => t.id === activeThemeId) : undefined;
  if (found) {
    const fallback = found.mode === 'dark' ? BUILTIN_DARK_THEMES[0].colors : BUILTIN_LIGHT_THEMES[0].colors;
    return {
      ...found,
      colors: sanitizeThemeColors(found.colors, fallback),
    };
  }
  return BUILTIN_LIGHT_THEMES[0];
}

export function buildThemeCssVars(theme: HomeThemePreset): Record<string, string> {
  const c = theme.colors;
  const isDark = theme.mode === 'dark';
  const accentFg = getContrastForeground(c.accent);

  return {
    colorScheme: theme.mode,
    '--sph-bg': c.canvas,
    '--sph-canvas': c.canvas,
    '--sph-card': c.surface,
    '--sph-surface': c.wash,
    '--sph-wash': c.wash,
    '--sph-wash-hover': `color-mix(in srgb, ${c.text} ${isDark ? '7.5%' : '5.2%'}, ${c.wash})`,
    '--sph-tile': c.wash,
    '--sph-tile-hover': `color-mix(in srgb, ${c.text} ${isDark ? '8%' : '5.5%'}, ${c.wash})`,
    '--sph-text': c.text,
    '--sph-muted': c.muted,
    '--sph-subtle': `color-mix(in srgb, ${c.muted} 78%, ${c.canvas})`,
    '--sph-hairline': `color-mix(in srgb, ${c.text} ${isDark ? '11.5%' : '8.5%'}, transparent)`,
    '--sph-border': `color-mix(in srgb, ${c.text} ${isDark ? '11.5%' : '8.5%'}, transparent)`,
    '--sph-border-strong': `color-mix(in srgb, ${c.text} ${isDark ? '20%' : '16%'}, transparent)`,
    '--sph-hover': `color-mix(in srgb, ${c.text} ${isDark ? '6.5%' : '4.5%'}, transparent)`,
    '--sph-accent': c.accent,
    '--sph-accent-fg': accentFg,
    '--sph-accent-soft': `color-mix(in srgb, ${c.accent} ${isDark ? '16%' : '11%'}, transparent)`,
    '--sph-accent-medium': `color-mix(in srgb, ${c.accent} ${isDark ? '26%' : '19%'}, transparent)`,
    '--sph-accent-border': `color-mix(in srgb, ${c.accent} ${isDark ? '38%' : '28%'}, transparent)`,
    '--sph-heat-0': `color-mix(in srgb, ${c.text} ${isDark ? '7.5%' : '5.5%'}, transparent)`,
    '--sph-heat-1': `color-mix(in srgb, ${c.accent} 26%, transparent)`,
    '--sph-heat-2': `color-mix(in srgb, ${c.accent} 48%, transparent)`,
    '--sph-heat-3': `color-mix(in srgb, ${c.accent} 72%, transparent)`,
    '--sph-heat-4': c.accent,
    '--sph-backdrop': isDark ? 'rgba(0, 0, 0, 0.56)' : 'rgba(15, 23, 42, 0.34)',
  };
}
