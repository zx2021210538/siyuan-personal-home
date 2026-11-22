import { addDays, formatUtcMsToDate } from '../domain/habitStats';
import type { HeatmapDay, OverviewStats } from '../domain/types';
import { escapeSqlString, type SiYuanClient } from './siyuanApi';

function toCompactDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

function toDashedDate(compact: string): string {
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

function computeHeatLevel(count: number, maxCount: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (maxCount <= 4) {
    return Math.min(4, count) as 1 | 2 | 3 | 4;
  }
  const ratio = count / maxCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

export async function fetchOverviewStats(
  api: SiYuanClient,
  activeDiaryNotebookId: string,
  todayStr: string,
): Promise<OverviewStats> {
  const year = todayStr.slice(0, 4);
  const sevenDaysAgo = `${toCompactDate(addDays(todayStr, -6))}000000`;

  const [docRows, wordRows, recentRows, diaryRows] = await Promise.all([
    api.sql<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM blocks WHERE type = 'd'`),
    api.sql<{ totalWords: number | null; totalBlocks: number }>(
      `SELECT COALESCE(SUM(length), 0) AS totalWords, COUNT(*) AS totalBlocks FROM blocks WHERE type IN ('p','h','c','m','t','callout')`,
    ),
    api.sql<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM blocks WHERE type = 'd' AND updated >= '${sevenDaysAgo}'`,
    ),
    activeDiaryNotebookId
      ? api.sql<{ cnt: number }>(
          `SELECT COUNT(DISTINCT name) AS cnt FROM attributes WHERE type = 'b' AND box = '${escapeSqlString(activeDiaryNotebookId)}' AND name LIKE 'custom-dailynote-${year}%'`,
        )
      : Promise.resolve([{ cnt: 0 }]),
  ]);

  return {
    totalDocs: Number(docRows[0]?.cnt ?? 0),
    totalWords: Number(wordRows[0]?.totalWords ?? 0),
    totalBlocks: Number(wordRows[0]?.totalBlocks ?? 0),
    recent7DaysDocs: Number(recentRows[0]?.cnt ?? 0),
    yearDiaryDays: Number(diaryRows[0]?.cnt ?? 0),
  };
}

export async function fetchYearHeatmap(
  api: SiYuanClient,
  year: number,
  activeDiaryNotebookId: string,
): Promise<{ days: HeatmapDay[]; totalBlocks: number; activeDays: number }> {
  const yearStr = String(year);
  const [diaryAttrs, blockCounts] = await Promise.all([
    api.sql<{ root_id: string; name: string; box: string }>(
      `SELECT root_id, name, box FROM attributes WHERE type = 'b' AND name LIKE 'custom-dailynote-${yearStr}%' LIMIT 5000`,
    ),
    api.sql<{ root_id: string; day: string; cnt: number }>(
      `SELECT root_id, SUBSTR(created, 1, 8) AS day, COUNT(*) AS cnt FROM blocks WHERE type IN ('p','h','c','m','t','html','callout') AND (created LIKE '${yearStr}%' OR root_id IN (SELECT root_id FROM attributes WHERE type = 'b' AND name LIKE 'custom-dailynote-${yearStr}%')) GROUP BY root_id, SUBSTR(created, 1, 8) LIMIT 50000`,
    ),
  ]);

  const diaryDateByRoot = new Map<string, string>();
  const activeNotebookDiaryDates = new Set<string>();

  for (const attr of diaryAttrs) {
    const match = attr.name.match(/^custom-dailynote-(\d{8})$/);
    if (!match) continue;
    const dashed = toDashedDate(match[1]);
    diaryDateByRoot.set(attr.root_id, dashed);
    if (!activeDiaryNotebookId || attr.box === activeDiaryNotebookId) {
      activeNotebookDiaryDates.add(dashed);
    }
  }

  const countByDate = new Map<string, number>();
  for (const row of blockCounts) {
    const diaryDate = diaryDateByRoot.get(row.root_id);
    const targetDate = diaryDate ?? (row.day?.length === 8 ? toDashedDate(row.day) : '');
    if (!targetDate.startsWith(`${yearStr}-`)) continue;
    countByDate.set(targetDate, (countByDate.get(targetDate) ?? 0) + Number(row.cnt ?? 0));
  }

  let maxCount = 0;
  for (const c of countByDate.values()) {
    if (c > maxCount) maxCount = c;
  }

  const days: HeatmapDay[] = [];
  let totalBlocks = 0;
  let activeDays = 0;
  let cursorMs = Date.UTC(year, 0, 1);
  const endMs = Date.UTC(year, 11, 31);

  while (cursorMs <= endMs) {
    const date = formatUtcMsToDate(cursorMs);
    const count = countByDate.get(date) ?? 0;
    if (count > 0) {
      totalBlocks += count;
      activeDays += 1;
    }
    days.push({
      date,
      count,
      level: computeHeatLevel(count, maxCount),
      hasDiary: activeNotebookDiaryDates.has(date),
    });
    cursorMs += 86_400_000;
  }

  return { days, totalBlocks, activeDays };
}
