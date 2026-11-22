import {
  cleanSnippetMarkdown,
  extractDocIcon,
  extractTitleImageUrl,
  parseSiYuanTimestamp,
  parseTags,
} from '../domain/docPreview';
import type { DocPreviewItem, RecentReadRecord } from '../domain/types';
import { escapeSqlString, type SiYuanClient, type SiYuanNotebook } from './siyuanApi';

const IMAGE_ASSET_REGEX = /\.(png|jpe?g|webp|gif|avif|svg)$/i;

interface DocRow {
  id: string;
  box: string;
  hpath: string;
  content: string;
  tag: string;
  ial: string;
  updated: string;
}

export interface RecentDocsQuery {
  notebookId?: string | 'all';
  hideDailyNotes: boolean;
  keyword?: string;
  limit: number;
  offset: number;
}

export class RecentReadTracker {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(
    private readonly onRecord: (docId: string) => void | Promise<void>,
    private readonly dwellMs = 1500,
  ) {}

  onSwitchDoc(docId: string | null | undefined): void {
    if (this.disposed) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const cleanId = docId?.trim();
    if (!cleanId) return;

    this.timer = setTimeout(() => {
      this.timer = null;
      if (!this.disposed) {
        void this.onRecord(cleanId);
      }
    }, this.dwellMs);
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

async function enrichDocPreviews(
  api: SiYuanClient,
  notebooks: SiYuanNotebook[],
  rows: DocRow[],
  readAtMap?: Map<string, number>,
): Promise<DocPreviewItem[]> {
  if (rows.length === 0) return [];

  const notebookMap = new Map(notebooks.map((nb) => [nb.id, nb.name]));
  const docIds = rows.map((r) => r.id);
  const inClause = docIds.map((id) => `'${escapeSqlString(id)}'`).join(',');

  const [snippetRows, assetRows] = await Promise.all([
    api.sql<{ root_id: string; content: string; markdown: string }>(
      `SELECT root_id, content, markdown FROM blocks WHERE root_id IN (${inClause}) AND type IN ('p','h','l','b','callout') AND content != '' ORDER BY root_id, sort ASC LIMIT ${docIds.length * 6}`,
    ),
    api.sql<{ root_id: string; path: string }>(
      `SELECT root_id, path FROM assets WHERE root_id IN (${inClause}) LIMIT ${docIds.length * 4}`,
    ),
  ]);

  const snippetsByDoc = new Map<string, string[]>();
  for (const row of snippetRows) {
    const arr = snippetsByDoc.get(row.root_id) ?? [];
    if (arr.length < 4) {
      arr.push(row.markdown || row.content || '');
      snippetsByDoc.set(row.root_id, arr);
    }
  }

  const assetImgByDoc = new Map<string, string>();
  for (const row of assetRows) {
    if (!assetImgByDoc.has(row.root_id) && IMAGE_ASSET_REGEX.test(row.path)) {
      assetImgByDoc.set(row.root_id, row.path);
    }
  }

  return rows.map((row) => {
    const titleImg = extractTitleImageUrl(row.ial);
    return {
      id: row.id,
      box: row.box,
      notebookName: notebookMap.get(row.box) ?? '',
      hpath: row.hpath,
      title: row.content || '未命名文档',
      icon: extractDocIcon(row.ial),
      snippet: cleanSnippetMarkdown(snippetsByDoc.get(row.id) ?? [], 160),
      thumbnailUrl: titleImg || assetImgByDoc.get(row.id) || null,
      tags: parseTags(row.tag, 3),
      updatedAtMs: parseSiYuanTimestamp(row.updated),
      readAtMs: readAtMap?.get(row.id),
    };
  });
}

export async function fetchRecentModifiedDocs(
  api: SiYuanClient,
  notebooks: SiYuanNotebook[],
  query: RecentDocsQuery,
): Promise<{ items: DocPreviewItem[]; hasMore: boolean }> {
  const predicates: string[] = [`type = 'd'`];
  if (query.notebookId && query.notebookId !== 'all') {
    predicates.push(`box = '${escapeSqlString(query.notebookId)}'`);
  }
  if (query.hideDailyNotes) {
    predicates.push(
      `id NOT IN (SELECT root_id FROM attributes WHERE type = 'b' AND name LIKE 'custom-dailynote-%')`,
    );
  }
  const kw = query.keyword?.trim();
  if (kw) {
    const safeKw = escapeSqlString(kw);
    predicates.push(`(content LIKE '%${safeKw}%' OR hpath LIKE '%${safeKw}%' OR tag LIKE '%${safeKw}%')`);
  }

  const fetchLimit = query.limit + 1;
  const rows = await api.sql<DocRow>(
    `SELECT id, box, hpath, content, tag, ial, updated FROM blocks WHERE ${predicates.join(' AND ')} ORDER BY updated DESC LIMIT ${fetchLimit} OFFSET ${Math.max(0, query.offset)}`,
  );

  const hasMore = rows.length > query.limit;
  const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
  const items = await enrichDocPreviews(api, notebooks, pageRows);
  return { items, hasMore };
}

export async function fetchRecentReadDocs(
  api: SiYuanClient,
  notebooks: SiYuanNotebook[],
  records: RecentReadRecord[],
  query: RecentDocsQuery,
  onDeadIds?: (validIds: Set<string>) => void,
): Promise<{ items: DocPreviewItem[]; hasMore: boolean }> {
  if (records.length === 0) {
    return { items: [], hasMore: false };
  }

  const allIds = records.map((r) => r.docId);
  const inClause = allIds.map((id) => `'${escapeSqlString(id)}'`).join(',');
  const [docRows, dailyAttrs] = await Promise.all([
    api.sql<DocRow>(
      `SELECT id, box, hpath, content, tag, ial, updated FROM blocks WHERE id IN (${inClause}) AND type = 'd' LIMIT ${allIds.length}`,
    ),
    query.hideDailyNotes
      ? api.sql<{ root_id: string }>(
          `SELECT DISTINCT root_id FROM attributes WHERE type = 'b' AND root_id IN (${inClause}) AND name LIKE 'custom-dailynote-%' LIMIT ${allIds.length}`,
        )
      : Promise.resolve([]),
  ]);

  const rowMap = new Map(docRows.map((r) => [r.id, r]));
  const validIds = new Set(docRows.map((r) => r.id));
  if (validIds.size < records.length && onDeadIds) {
    onDeadIds(validIds);
  }

  const dailySet = new Set(dailyAttrs.map((a) => a.root_id));
  const kw = query.keyword?.trim().toLowerCase() ?? '';
  const readAtMap = new Map(records.map((r) => [r.docId, r.lastReadAt]));

  const filteredRows: DocRow[] = [];
  for (const rec of records) {
    const row = rowMap.get(rec.docId);
    if (!row) continue;
    if (query.notebookId && query.notebookId !== 'all' && row.box !== query.notebookId) continue;
    if (query.hideDailyNotes && dailySet.has(row.id)) continue;
    if (
      kw &&
      !row.content.toLowerCase().includes(kw) &&
      !row.hpath.toLowerCase().includes(kw) &&
      !(row.tag ?? '').toLowerCase().includes(kw)
    ) {
      continue;
    }
    filteredRows.push(row);
  }

  const start = Math.max(0, query.offset);
  const pageRows = filteredRows.slice(start, start + query.limit);
  const hasMore = start + query.limit < filteredRows.length;
  const items = await enrichDocPreviews(api, notebooks, pageRows, readAtMap);
  return { items, hasMore };
}
