import {
  cleanSnippetMarkdown,
  extractDocIcon,
  extractTitleImageUrl,
  parseSiYuanTimestamp,
  parseTags,
} from '../domain/docPreview';
import { extractLifeLogConfig, parseLifeLogMomentsForDate } from '../domain/lifelogParser';
import type { DiaryMoment, DocPreviewItem, MonthCalendarDay } from '../domain/types';
import { escapeSqlString, type SiYuanClient, type SiYuanNotebook } from './siyuanApi';

const IMAGE_ASSET_REGEX = /\.(png|jpe?g|webp|gif|avif|svg)$/i;

export function resolveActiveDiaryNotebook(
  notebooks: SiYuanNotebook[],
  localDailyNoteId: string | undefined,
  savedNotebookId: string | undefined,
): string {
  const openNotebooks = notebooks.filter((nb) => !nb.closed);
  if (openNotebooks.length === 0) return '';

  const openIds = new Set(openNotebooks.map((nb) => nb.id));
  if (localDailyNoteId && openIds.has(localDailyNoteId)) return localDailyNoteId;
  if (savedNotebookId && openIds.has(savedNotebookId)) return savedNotebookId;
  return openNotebooks[0].id;
}

export async function fetchMonthCalendarDays(
  api: SiYuanClient,
  notebookId: string,
  year: number,
  month: number, // 1..12
  includeTodoBadge: boolean,
): Promise<Record<string, MonthCalendarDay>> {
  if (!notebookId) return {};
  const ym = `${year}${String(month).padStart(2, '0')}`;
  const safeBox = escapeSqlString(notebookId);

  const attrs = await api.sql<{ root_id: string; name: string }>(
    `SELECT root_id, name FROM attributes WHERE type = 'b' AND box = '${safeBox}' AND name LIKE 'custom-dailynote-${ym}%' LIMIT 100`,
  );

  const map: Record<string, MonthCalendarDay> = {};
  const docIdToDate = new Map<string, string>();
  const docIds: string[] = [];

  for (const attr of attrs) {
    const match = attr.name.match(/^custom-dailynote-(\d{4})(\d{2})(\d{2})$/);
    if (!match) continue;
    const date = `${match[1]}-${match[2]}-${match[3]}`;
    map[date] = {
      date,
      hasDiary: true,
      diaryDocId: attr.root_id,
      hasUnfinishedTodo: false,
    };
    docIdToDate.set(attr.root_id, date);
    docIds.push(attr.root_id);
  }

  if (includeTodoBadge && docIds.length > 0) {
    const inClause = docIds.map((id) => `'${escapeSqlString(id)}'`).join(',');
    const todoRows = await api.sql<{ root_id: string }>(
      `SELECT DISTINCT root_id FROM blocks WHERE root_id IN (${inClause}) AND type = 'i' AND subtype = 't' AND markdown LIKE '%[ ]%' LIMIT 100`,
    );
    for (const row of todoRows) {
      const date = docIdToDate.get(row.root_id);
      if (date && map[date]) {
        map[date].hasUnfinishedTodo = true;
      }
    }
  }

  return map;
}

export async function fetchDailyNoteByDate(
  api: SiYuanClient,
  notebookId: string,
  dateStr: string,
  notebookName: string,
): Promise<DocPreviewItem | null> {
  if (!notebookId) return null;
  const compact = dateStr.replace(/-/g, '');
  const safeBox = escapeSqlString(notebookId);

  const attrRows = await api.sql<{ root_id: string }>(
    `SELECT root_id FROM attributes WHERE type = 'b' AND box = '${safeBox}' AND name = 'custom-dailynote-${compact}' LIMIT 1`,
  );
  const docId = attrRows[0]?.root_id;
  if (!docId) return null;

  const safeDocId = escapeSqlString(docId);
  const [docRows, bodyRows, wordRows, assetRows, htmlRows] = await Promise.all([
    api.sql<{
      id: string;
      box: string;
      hpath: string;
      content: string;
      tag: string;
      ial: string;
      updated: string;
    }>(`SELECT id, box, hpath, content, tag, ial, updated FROM blocks WHERE id = '${safeDocId}' AND type = 'd' LIMIT 1`),
    api.sql<{ content: string; markdown: string }>(
      `SELECT content, markdown FROM blocks WHERE root_id = '${safeDocId}' AND type IN ('p','h','c','m','t') AND content != '' ORDER BY sort ASC LIMIT 16`,
    ),
    api.sql<{ totalWords: number | null }>(
      `SELECT COALESCE(SUM(length), 0) AS totalWords FROM blocks WHERE root_id = '${safeDocId}' AND type IN ('p','h','c','m','t','callout')`,
    ),
    api.sql<{ path: string }>(
      `SELECT path FROM assets WHERE root_id = '${safeDocId}' LIMIT 10`,
    ),
    api.sql<{ markdown: string; content: string }>(
      `SELECT markdown, content FROM blocks WHERE root_id = '${safeDocId}' AND type = 'html' LIMIT 4`,
    ),
  ]);

  const doc = docRows[0];
  if (!doc) return null;

  const titleImg = extractTitleImageUrl(doc.ial);
  const assetImg = assetRows.find((a) => IMAGE_ASSET_REGEX.test(a.path))?.path ?? null;
  let wordCount = Number(wordRows[0]?.totalWords ?? 0);
  let snippet = cleanSnippetMarkdown(
    bodyRows.map((b) => b.markdown || b.content || ''),
    320,
  );
  let moments: DiaryMoment[] | undefined;
  let momentThumb: string | null = null;

  // Detect embedded LifeLog-style HTML database widgets and render their day's real entries
  const lifeLogCfg = htmlRows
    .map((h) => extractLifeLogConfig(h.markdown || h.content))
    .find((cfg) => cfg !== null);

  if (lifeLogCfg && api.renderAttributeView) {
    try {
      const avData = await api.renderAttributeView({
        id: lifeLogCfg.avId,
        blockID: lifeLogCfg.dbBlockId,
        viewID: lifeLogCfg.viewId,
        page: 1,
        pageSize: 200,
      });
      moments = parseLifeLogMomentsForDate(avData, lifeLogCfg, dateStr);
      const momentsWordCount = moments.reduce(
        (sum, m) => sum + m.title.length + m.text.replace(/\s+/g, '').length,
        0,
      );
      if (moments.length > 0) {
        wordCount = momentsWordCount;
        snippet = moments
          .map((m) => [m.title, m.text].filter(Boolean).join('：'))
          .join(' · ')
          .slice(0, 320);
        momentThumb = moments.find((m) => m.images.length > 0)?.images[0] ?? null;
      } else {
        snippet = '';
      }
    } catch {
      // Fallback gracefully to regular paragraph snippet if AV query fails
    }
  }

  return {
    id: doc.id,
    box: doc.box,
    notebookName,
    hpath: doc.hpath,
    title: doc.content || dateStr,
    icon: extractDocIcon(doc.ial),
    snippet,
    thumbnailUrl: titleImg || assetImg || momentThumb,
    tags: parseTags(doc.tag),
    updatedAtMs: parseSiYuanTimestamp(doc.updated),
    wordCount,
    moments,
  };
}

export async function fetchTodayDailyNote(
  api: SiYuanClient,
  notebookId: string,
  todayStr: string,
  notebookName: string,
): Promise<DocPreviewItem | null> {
  return fetchDailyNoteByDate(api, notebookId, todayStr, notebookName);
}

function replaceNowWithDate(template: string, dateStr: string): string {
  const dateExpr = `(toDate "2006-01-02" "${dateStr}")`;
  return template.replace(/\bnow\b/g, dateExpr);
}

export async function openOrCreateDailyNote(
  api: SiYuanClient,
  notebookId: string,
  dateStr: string,
  todayStr: string,
): Promise<string> {
  if (!notebookId) {
    throw new Error('请先在思源中打开或选择一个日记本');
  }
  const compact = dateStr.replace(/-/g, '');
  const safeBox = escapeSqlString(notebookId);
  const existing = await api.sql<{ root_id: string }>(
    `SELECT root_id FROM attributes WHERE type = 'b' AND box = '${safeBox}' AND name = 'custom-dailynote-${compact}' LIMIT 1`,
  );
  if (existing[0]?.root_id) {
    return existing[0].root_id;
  }

  if (dateStr === todayStr) {
    const created = await api.createDailyNote(notebookId);
    return created.id;
  }

  const conf = await api.getNotebookConf(notebookId);
  const sprigTemplate = replaceNowWithDate(conf.dailyNoteSavePath, dateStr);
  const renderedPath = await api.renderSprig(sprigTemplate);
  const docPath = renderedPath.startsWith('/') ? renderedPath : `/${renderedPath}`;
  const docId = await api.createDocWithMd(notebookId, docPath, '');
  await api.setBlockAttrs(docId, {
    [`custom-dailynote-${compact}`]: compact,
  });

  if (conf.dailyNoteTemplatePath) {
    try {
      const rendered = await api.renderTemplate(docId, conf.dailyNoteTemplatePath);
      if (rendered?.content) {
        await api.prependBlock(docId, rendered.content);
      }
    } catch {
      // Template failure should not prevent opening the created daily note
    }
  }

  return docId;
}
