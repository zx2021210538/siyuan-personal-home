import type { DiaryMoment, DiarySticker, DocIconInfo } from './types';

export interface LifeLogWidgetConfig {
  avId: string;
  dbBlockId?: string;
  viewId?: string;
  titleKeyId: string;
  recordKeyId: string;
  dateKeyId: string;
  timeKeyId?: string;
  periodKeyId?: string;
  imageKeyId?: string;
}

function matchJsStringVar(source: string, varName: string): string {
  const regex = new RegExp(`\\b(?:var|let|const)\\s+${varName}\\s*=\\s*["']([^"']+)["']`);
  const m = source.match(regex);
  return m?.[1]?.trim() ?? '';
}

/**
 * Dynamically detects a LifeLog-style embedded HTML widget inside a daily note
 * and extracts its AttributeView (database) ID and column key IDs without
 * hardcoding any user-specific IDs in plugin source code.
 */
export function extractLifeLogConfig(htmlSource: string | null | undefined): LifeLogWidgetConfig | null {
  if (!htmlSource || typeof htmlSource !== 'string') return null;
  if (!htmlSource.includes('lifelog') && !htmlSource.includes('AV_ID')) return null;

  const avId = matchJsStringVar(htmlSource, 'AV_ID');
  const titleKeyId = matchJsStringVar(htmlSource, 'K_TITLE');
  const recordKeyId = matchJsStringVar(htmlSource, 'K_RECORD');
  const dateKeyId = matchJsStringVar(htmlSource, 'K_DATE');
  if (!avId || !dateKeyId || (!titleKeyId && !recordKeyId)) return null;

  return {
    avId,
    dbBlockId: matchJsStringVar(htmlSource, 'DB_BLOCK_ID') || undefined,
    viewId: matchJsStringVar(htmlSource, 'VIEW_ID') || undefined,
    titleKeyId,
    recordKeyId,
    dateKeyId,
    timeKeyId: matchJsStringVar(htmlSource, 'K_TIME') || undefined,
    periodKeyId: matchJsStringVar(htmlSource, 'K_PERIOD') || undefined,
    imageKeyId: matchJsStringVar(htmlSource, 'K_IMAGE') || undefined,
  };
}

function parseMomentIcon(rawIcon: string | undefined): DocIconInfo | null {
  const raw = rawIcon?.trim();
  if (!raw) return null;
  if (/^material-icon\//i.test(raw)) return null;

  if (/^[0-9a-fA-F-]+$/.test(raw)) {
    try {
      const codePoints = raw.split('-').map((hex) => parseInt(hex, 16));
      if (codePoints.every((cp) => Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff)) {
        return { type: 'emoji', value: String.fromCodePoint(...codePoints) };
      }
    } catch {
      return null;
    }
  }

  if (/^https?:\/\//i.test(raw)) {
    return { type: 'image', value: raw };
  }
  if (raw.startsWith('/')) {
    return { type: 'image', value: encodeURI(raw) };
  }
  if (/^assets\//i.test(raw)) {
    return { type: 'image', value: encodeURI(`/${raw}`) };
  }
  return { type: 'image', value: encodeURI(`/emojis/${raw}`) };
}

function normalizeAssetUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return encodeURI(path);
}

interface SiYuanRuntimeEmojiItem {
  unicode?: string;
  description?: string;
  description_zh_cn?: string;
}

interface SiYuanRuntimeEmojiGroup {
  items?: SiYuanRuntimeEmojiItem[];
}

export function resolveCustomEmojiCandidates(code: string): string[] {
  const clean = code.trim().replace(/^:|:$/g, '');
  if (!clean) return [];

  const urls: string[] = [];
  const pushUnique = (u: string) => {
    const encoded = /^https?:\/\//i.test(u) ? u : encodeURI(u);
    if (encoded && !urls.includes(encoded)) urls.push(encoded);
  };

  // 1. Exact lookup from SiYuan runtime `window.siyuan.emojis` if available
  try {
    const win = window as unknown as { siyuan?: { emojis?: SiYuanRuntimeEmojiGroup[] } };
    const groups = win?.siyuan?.emojis;
    if (Array.isArray(groups)) {
      for (const group of groups) {
        if (!Array.isArray(group?.items)) continue;
        for (const item of group.items) {
          const uni = item?.unicode?.trim();
          if (!uni) continue;
          const withoutExt = uni.replace(/\.[a-z0-9]+$/i, '');
          if (uni === clean || withoutExt === clean || item.description === clean) {
            pushUnique(uni.startsWith('/') ? uni : `/emojis/${uni}`);
          }
        }
      }
    }
  } catch {
    // ignore non-browser env
  }

  // 2. If shortcode already includes file extension, try it directly
  if (/\.(webp|png|gif|jpe?g|svg|avif)$/i.test(clean)) {
    pushUnique(`/emojis/${clean}`);
  } else {
    for (const ext of ['webp', 'gif', 'png', 'jpg', 'jpeg', 'svg']) {
      pushUnique(`/emojis/${clean}.${ext}`);
    }
  }

  return urls;
}

function extractInlineMediaAndClean(raw: string): {
  text: string;
  inlineImages: string[];
  stickers: DiarySticker[];
} {
  if (!raw) return { text: '', inlineImages: [], stickers: [] };

  const inlineImages: string[] = [];
  const stickers: DiarySticker[] = [];
  const seenStickerCodes = new Set<string>();

  // Extract Markdown images: ![alt](url)
  let work = raw.replace(/\r\n?/g, '\n');
  work = work.replace(/!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g, (_m, url: string) => {
    const normalized = normalizeAssetUrl(url);
    if (normalized && !inlineImages.includes(normalized)) {
      inlineImages.push(normalized);
    }
    return '';
  });

  // Extract inline HTML <img> tags
  work = work.replace(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi, (_m, url: string) => {
    const normalized = normalizeAssetUrl(url);
    if (normalized && !inlineImages.includes(normalized)) {
      inlineImages.push(normalized);
    }
    return '';
  });

  // Extract SiYuan custom emoji / sticker shortcodes like :AI娘/委屈哭哭:
  work = work.replace(/:([^:\s/]+\/[^:\s]+):/g, (_m, code: string) => {
    if (!seenStickerCodes.has(code)) {
      seenStickerCodes.add(code);
      const candidates = resolveCustomEmojiCandidates(code);
      if (candidates.length > 0) {
        stickers.push({ code, candidates });
      }
    }
    return '';
  });

  const text = work
    .replace(/^\s*\{:[\s\S]*?\}\s*$/gm, '')
    .replace(/\(\([a-zA-Z0-9-]+\s+["']([^"']+)["']\)\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/==([^=]+)==/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { text, inlineImages, stickers };
}

interface RawAvCell {
  value?: {
    keyID?: string;
    block?: { icon?: string; content?: string };
    text?: { content?: string; rich?: { content?: string } };
    date?: { content?: number; isNotEmpty?: boolean; formattedContent?: string };
    mSelect?: Array<{ content?: string }>;
    mAsset?: Array<{ type?: string; content?: string }>;
  };
}

interface RawAvRow {
  id?: string;
  cells?: RawAvCell[];
  values?: RawAvCell[];
}

interface RawAvNode {
  view?: RawAvNode;
  groups?: RawAvNode[];
  rows?: RawAvRow[];
  cards?: RawAvRow[];
}

function collectAvRows(root: RawAvNode | undefined): RawAvRow[] {
  const rows: RawAvRow[] = [];
  const walk = (node: RawAvNode | undefined) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node.rows)) rows.push(...node.rows);
    if (Array.isArray(node.cards)) rows.push(...node.cards);
    if (Array.isArray(node.groups)) {
      for (const g of node.groups) walk(g);
    }
  };
  walk(root?.view ?? root);
  return rows;
}

function extractDateKeyFromCell(val: RawAvCell['value']): string {
  const dateObj = val?.date;
  if (!dateObj || !dateObj.isNotEmpty) return '';
  if (dateObj.formattedContent) {
    const digits = dateObj.formattedContent.replace(/\D/g, '').slice(0, 8);
    if (digits.length === 8) return digits;
  }
  if (typeof dateObj.content === 'number' && Number.isFinite(dateObj.content)) {
    const dt = new Date(dateObj.content);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }
  return '';
}

export function parseLifeLogMomentsForDate(
  avData: unknown,
  cfg: LifeLogWidgetConfig,
  dateStr: string,
): DiaryMoment[] {
  const targetKey = dateStr.replace(/-/g, '');
  if (targetKey.length !== 8 || !avData || typeof avData !== 'object') return [];

  const rows = collectAvRows(avData as RawAvNode);
  const seenIds = new Set<string>();
  const moments: DiaryMoment[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowId = row.id || `moment-${i}`;
    if (seenIds.has(rowId)) continue;

    const cells = Array.isArray(row.cells)
      ? row.cells
      : Array.isArray(row.values)
        ? row.values
        : [];
    const byKey = new Map<string, RawAvCell['value']>();
    for (const cell of cells) {
      if (cell?.value?.keyID) {
        byKey.set(cell.value.keyID, cell.value);
      }
    }

    const rowDateKey = extractDateKeyFromCell(byKey.get(cfg.dateKeyId));
    if (rowDateKey !== targetKey) continue;

    seenIds.add(rowId);
    const titleVal = cfg.titleKeyId ? byKey.get(cfg.titleKeyId) : undefined;
    const recordVal = cfg.recordKeyId ? byKey.get(cfg.recordKeyId) : undefined;
    const timeVal = cfg.timeKeyId ? byKey.get(cfg.timeKeyId) : undefined;
    const periodVal = cfg.periodKeyId ? byKey.get(cfg.periodKeyId) : undefined;
    const imageVal = cfg.imageKeyId ? byKey.get(cfg.imageKeyId) : undefined;

    const title = (titleVal?.block?.content ?? titleVal?.text?.content ?? '').trim();
    const icon = parseMomentIcon(titleVal?.block?.icon);
    const rawText = recordVal?.text?.rich?.content || recordVal?.text?.content || '';
    const { text, inlineImages, stickers } = extractInlineMediaAndClean(rawText);
    const time = (timeVal?.text?.content ?? '').trim() || undefined;
    const period = (periodVal?.mSelect?.[0]?.content ?? '').trim() || undefined;
    const images: string[] = [];
    if (Array.isArray(imageVal?.mAsset)) {
      for (const asset of imageVal.mAsset) {
        if (asset?.type === 'image' && asset.content) {
          const url = normalizeAssetUrl(asset.content);
          if (url && !images.includes(url)) images.push(url);
        }
      }
    }
    for (const url of inlineImages) {
      if (!images.includes(url)) images.push(url);
    }

    if (!title && !text && images.length === 0 && stickers.length === 0) continue;
    moments.push({
      id: rowId,
      title: title || '无题',
      icon,
      period,
      time,
      text,
      images,
      stickers: stickers.length > 0 ? stickers : undefined,
    });
  }

  return moments;
}
