import { describe, expect, it, vi } from 'vitest';
import {
  escapeSqlLike,
  escapeSqlString,
  type SiYuanClient,
  type SiYuanNotebook,
} from '../../src/services/siyuanApi';
import { fetchOverviewStats, fetchYearHeatmap } from '../../src/services/statsService';
import {
  fetchMonthCalendarDays,
  fetchTodayDailyNote,
  openOrCreateDailyNote,
  resolveActiveDiaryNotebook,
} from '../../src/services/dailyNoteService';

function createMockApi(overrides: Partial<SiYuanClient> = {}): SiYuanClient {
  return {
    sql: vi.fn().mockResolvedValue([]),
    lsNotebooks: vi.fn().mockResolvedValue([]),
    getNotebookConf: vi.fn().mockResolvedValue({
      dailyNoteSavePath: '/daily note/{{now | date "2006/01"}}/{{now | date "2006-01-02"}}',
      dailyNoteTemplatePath: '',
    }),
    createDailyNote: vi.fn().mockResolvedValue({ id: 'today-new-id' }),
    renderSprig: vi.fn().mockResolvedValue('/daily note/2026/11/2026-11-18'),
    createDocWithMd: vi.fn().mockResolvedValue('past-new-id'),
    renderTemplate: vi.fn().mockResolvedValue({ content: '<p>template</p>' }),
    prependBlock: vi.fn().mockResolvedValue(undefined),
    setBlockAttrs: vi.fn().mockResolvedValue(undefined),
    getLocalStorage: vi.fn().mockResolvedValue({}),
    setLocalStorageVal: vi.fn().mockResolvedValue(undefined),
    searchDocs: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('siyuanApi + statsService + dailyNoteService', () => {
  it('escapes SQL single quotes and LIKE wildcards safely', () => {
    expect(escapeSqlString("O'Reilly's Note")).toBe("O''Reilly''s Note");
    expect(escapeSqlLike("100%_a\\b'c")).toBe("100\\%\\_a\\\\b''c");
  });

  it('resolves active diary notebook with priority local-dailynoteid > saved > first open > empty', () => {
    const notebooks: SiYuanNotebook[] = [
      { id: 'nb-closed', name: '已关闭', icon: '', closed: true },
      { id: 'nb-a', name: '日记本', icon: '', closed: false },
      { id: 'nb-b', name: '工作本', icon: '', closed: false },
    ];
    expect(resolveActiveDiaryNotebook(notebooks, 'nb-b', 'nb-a')).toBe('nb-b');
    expect(resolveActiveDiaryNotebook(notebooks, 'nb-closed', 'nb-a')).toBe('nb-a');
    expect(resolveActiveDiaryNotebook(notebooks, 'nb-closed', 'nb-missing')).toBe('nb-a');
    expect(resolveActiveDiaryNotebook([notebooks[0]], 'nb-closed', 'nb-closed')).toBe('');
  });

  it('fetches overview stats globally while scoping year diary days to active notebook', async () => {
    const sqlMock = vi.fn().mockImplementation(async (stmt: string) => {
      if (stmt.includes("type = 'd'") && stmt.includes('updated >=')) return [{ cnt: 12 }];
      if (stmt.includes("type = 'd'")) return [{ cnt: 180 }];
      if (stmt.includes('SUM(length)')) return [{ totalWords: 54321, totalBlocks: 2100 }];
      if (stmt.includes('custom-dailynote-2026%')) return [{ cnt: 45 }];
      return [];
    });
    const api = createMockApi({ sql: sqlMock });

    const stats = await fetchOverviewStats(api, "nb-'diary", '2026-11-22');
    expect(stats).toEqual({
      totalDocs: 180,
      totalWords: 54321,
      totalBlocks: 2100,
      recent7DaysDocs: 12,
      yearDiaryDays: 45,
    });
    // Ensure escaped single quote was passed in SQL
    expect(sqlMock.mock.calls.some(([s]) => String(s).includes("nb-''diary"))).toBe(true);

    // When activeDiaryNotebookId is empty, yearDiaryDays falls back to 0 without bad SQL
    const emptyDiaryStats = await fetchOverviewStats(api, '', '2026-11-22');
    expect(emptyDiaryStats.yearDiaryDays).toBe(0);
  });

  it('aggregates year heatmap attributing diary blocks to diary date and regular blocks to created date', async () => {
    const sqlMock = vi.fn().mockImplementation(async (stmt: string) => {
      if (stmt.includes('GROUP BY')) {
        return [
          { root_id: 'doc-d1', day: '20261112', cnt: 6 }, // created Nov 12, but belongs to Nov 10 diary -> Nov 10
          { root_id: 'doc-regular', day: '20261112', cnt: 3 },
        ];
      }
      if (stmt.includes('FROM attributes') && stmt.includes('custom-dailynote-2026%')) {
        return [{ root_id: 'doc-d1', name: 'custom-dailynote-20261110', box: 'nb-a' }];
      }
      return [];
    });
    const api = createMockApi({ sql: sqlMock });

    const res = await fetchYearHeatmap(api, 2026, 'nb-a');
    const nov10 = res.days.find((d) => d.date === '2026-11-10');
    const nov12 = res.days.find((d) => d.date === '2026-11-12');
    expect(nov10?.count).toBe(6);
    expect(nov10?.hasDiary).toBe(true);
    expect(nov10?.level).toBeGreaterThan(0);
    expect(nov12?.count).toBe(3);
    expect(nov12?.hasDiary).toBe(false);
    expect(res.totalBlocks).toBe(9);
    expect(res.activeDays).toBe(2);
  });

  it('fetches month calendar days with diary flags and unfinished todo badges', async () => {
    const sqlMock = vi.fn().mockImplementation(async (stmt: string) => {
      if (stmt.includes('FROM attributes')) {
        return [
          { root_id: 'd-1', name: 'custom-dailynote-20261105' },
          { root_id: 'd-2', name: 'custom-dailynote-20261122' },
        ];
      }
      if (stmt.includes("subtype = 't'")) {
        return [{ root_id: 'd-2' }];
      }
      return [];
    });
    const api = createMockApi({ sql: sqlMock });

    const map = await fetchMonthCalendarDays(api, 'nb-a', 2026, 11, true);
    expect(map['2026-11-05']).toEqual({
      date: '2026-11-05',
      hasDiary: true,
      diaryDocId: 'd-1',
      hasUnfinishedTodo: false,
    });
    expect(map['2026-11-22']).toEqual({
      date: '2026-11-22',
      hasDiary: true,
      diaryDocId: 'd-2',
      hasUnfinishedTodo: true,
    });
  });

  it('opens existing daily note, creates today via createDailyNote, and creates past date via sprig + attrs', async () => {
    const apiExisting = createMockApi({
      sql: vi.fn().mockResolvedValue([{ root_id: 'existing-doc' }]),
    });
    expect(await openOrCreateDailyNote(apiExisting, 'nb-a', '2026-11-22', '2026-11-22')).toBe(
      'existing-doc',
    );
    expect(apiExisting.createDailyNote).not.toHaveBeenCalled();

    const apiToday = createMockApi({ sql: vi.fn().mockResolvedValue([]) });
    expect(await openOrCreateDailyNote(apiToday, 'nb-a', '2026-11-22', '2026-11-22')).toBe(
      'today-new-id',
    );
    expect(apiToday.createDailyNote).toHaveBeenCalledWith('nb-a');

    const apiPast = createMockApi({
      sql: vi.fn().mockResolvedValue([]),
      getNotebookConf: vi.fn().mockResolvedValue({
        dailyNoteSavePath: '/daily/{{now | date "2006-01-02"}}',
        dailyNoteTemplatePath: '/templates/daily.md',
      }),
    });
    const pastId = await openOrCreateDailyNote(apiPast, 'nb-a', '2026-11-18', '2026-11-22');
    expect(pastId).toBe('past-new-id');
    expect(apiPast.renderSprig).toHaveBeenCalledWith(
      expect.stringContaining('2026-11-18'),
    );
    expect(apiPast.setBlockAttrs).toHaveBeenCalledWith('past-new-id', {
      'custom-dailynote-20261118': '20261118',
    });
    expect(apiPast.renderTemplate).toHaveBeenCalledWith('past-new-id', '/templates/daily.md');
    expect(apiPast.prependBlock).toHaveBeenCalled();
  });

  it('fetches today daily note preview or returns null when absent', async () => {
    const apiEmpty = createMockApi({ sql: vi.fn().mockResolvedValue([]) });
    expect(await fetchTodayDailyNote(apiEmpty, 'nb-a', '2026-11-22', '日记')).toBeNull();

    const sqlMock = vi.fn().mockImplementation(async (stmt: string) => {
      if (stmt.includes('custom-dailynote-20261122')) {
        return [{ root_id: 'doc-today' }];
      }
      if (stmt.includes("type = 'd'")) {
        return [
          {
            id: 'doc-today',
            box: 'nb-a',
            hpath: '/daily/2026-11-22',
            content: '2026-11-22',
            tag: '#日记#',
            ial: '{: icon="1f4dd"}',
            updated: '20261122133000',
          },
        ];
      }
      if (stmt.includes('SUM(length)')) {
        return [{ totalWords: 512 }];
      }
      if (stmt.includes('FROM assets')) {
        return [{ path: 'assets/photo.jpg' }];
      }
      return [
        { content: '今天完成了个人主页的设计。', markdown: '今天完成了个人主页的设计。' },
      ];
    });
    const api = createMockApi({ sql: sqlMock });
    const preview = await fetchTodayDailyNote(api, 'nb-a', '2026-11-22', '日记');
    expect(preview?.id).toBe('doc-today');
    expect(preview?.snippet).toContain('今天完成了个人主页的设计');
    expect(preview?.thumbnailUrl).toBe('assets/photo.jpg');
    expect(preview?.wordCount).toBe(512);
  });
});
