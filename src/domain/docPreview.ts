import type { DocIconInfo } from './types';

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export function parseIalAttrs(ial: string | null | undefined): Record<string, string> {
  if (!ial || typeof ial !== 'string') return {};
  const trimmed = ial.trim();
  if (!trimmed.startsWith('{:') || !trimmed.endsWith('}')) return {};

  const attrs: Record<string, string> = {};
  const regex = /([a-zA-Z0-9_-]+)="((?:[^"\\]|\\.)*)"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(trimmed)) !== null) {
    attrs[match[1]] = decodeHtmlEntities(match[2]);
  }
  return attrs;
}

export function extractTitleImageUrl(ial: string | null | undefined): string | null {
  const attrs = parseIalAttrs(ial);
  const raw = attrs['title-img'];
  if (!raw) return null;

  const urlMatch = raw.match(/url\(\s*["']?([^"')]+)["']?\s*\)/i);
  if (!urlMatch) return null;

  const candidate = urlMatch[1].trim();
  if (!candidate || /^data:image\/svg\+xml/i.test(candidate)) {
    return null;
  }
  return candidate;
}

export function extractDocIcon(ial: string | null | undefined): DocIconInfo | null {
  const attrs = parseIalAttrs(ial);
  const raw = attrs.icon?.trim();
  if (!raw) return null;

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

  if (raw.startsWith('/') || raw.startsWith('http://') || raw.startsWith('https://')) {
    return { type: 'image', value: raw };
  }
  return { type: 'image', value: `/emojis/${raw}` };
}

function stripBlockMarkdown(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\(\([a-zA-Z0-9-]+\s+["']([^"']+)["']\)\)/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s*/gm, '')
    .replace(/^[-*+]\s+\[[ xX]\]\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/==([^=]+)==/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanSnippetMarkdown(rawBlocks: string[], maxChars = 160): string {
  if (!Array.isArray(rawBlocks) || rawBlocks.length === 0) return '';
  const parts: string[] = [];
  let total = 0;

  for (const block of rawBlocks) {
    if (!block) continue;
    const cleaned = stripBlockMarkdown(block);
    if (!cleaned) continue;
    parts.push(cleaned);
    total += cleaned.length + 1;
    if (total >= maxChars + 20) break;
  }

  const joined = parts.join(' ').trim();
  if (joined.length <= maxChars) return joined;
  return `${joined.slice(0, maxChars).trimEnd()}…`;
}

export function parseTags(tagField: string | null | undefined, maxCount = 3): string[] {
  if (!tagField || typeof tagField !== 'string') return [];
  const tags: string[] = [];
  const regex = /#([^#\s]+)#/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(tagField)) !== null) {
    if (!tags.includes(match[1])) {
      tags.push(match[1]);
    }
    if (tags.length >= maxCount) break;
  }
  return tags;
}

export function parseSiYuanTimestamp(ts: string | null | undefined): number {
  if (!ts || !/^\d{14}$/.test(ts)) return 0;
  const y = Number(ts.slice(0, 4));
  const m = Number(ts.slice(4, 6)) - 1;
  const d = Number(ts.slice(6, 8));
  const hh = Number(ts.slice(8, 10));
  const mm = Number(ts.slice(10, 12));
  const ss = Number(ts.slice(12, 14));
  return new Date(y, m, d, hh, mm, ss).getTime();
}

export function formatRelativeTime(timestampMs: number, nowMs: number): string {
  if (!timestampMs || timestampMs <= 0) return '';
  const diff = Math.max(0, nowMs - timestampMs);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;

  const target = new Date(timestampMs);
  const now = new Date(nowMs);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (
    target.getFullYear() === yesterday.getFullYear() &&
    target.getMonth() === yesterday.getMonth() &&
    target.getDate() === yesterday.getDate()
  ) {
    const hh = String(target.getHours()).padStart(2, '0');
    const mm = String(target.getMinutes()).padStart(2, '0');
    return `昨天 ${hh}:${mm}`;
  }

  const mon = String(target.getMonth() + 1).padStart(2, '0');
  const day = String(target.getDate()).padStart(2, '0');
  return `${mon}-${day}`;
}
