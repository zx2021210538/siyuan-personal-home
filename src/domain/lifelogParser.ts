import type { DiaryMoment, DocIconInfo } from './types';

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

  if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) {
    return { type: 'image', value: raw };
  }
  if (/^assets\//i.test(raw)) {
    return { type: 'image', value: `/${raw}` };
  }
  return { type: 'image', value: `/emojis/${raw}` };
}

function normalizeAssetUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function cleanMomentText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/^\s*\{:[\s\S]*?\}\s*$/gm, '')
    .replace(/:[^:\s/]+\/[^:\s]+:/g, '')
    .replace(/\(\([a-zA-Z0-9-]+\s+["']([^"']+)["']\)\)/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/==([^=]+)==/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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
    const text = cleanMomentText(rawText);
    const time = (timeVal?.text?.content ?? '').trim() || undefined;
    const period = (periodVal?.mSelect?.[0]?.content ?? '').trim() || undefined;
    const images: string[] = [];
    if (Array.isArray(imageVal?.mAsset)) {
      for (const asset of imageVal.mAsset) {
        if (asset?.type === 'image' && asset.content) {
          const url = normalizeAssetUrl(asset.content);
          if (url) images.push(url);
        }
      }
    }

    if (!title && !text && images.length === 0) continue;
    moments.push({
      id: rowId,
      title: title || '无题',
      icon,
      period,
      time,
      text,
      images,
    });
  }

  return moments;
}
