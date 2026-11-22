import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RecentReadTracker,
  fetchRecentModifiedDocs,
  fetchRecentReadDocs,
} from '../../src/services/recentDocsService';
import type { SiYuanClient, SiYuanNotebook } from '../../src/services/siyuanApi';

function createMockApi(sqlImpl: (stmt: string) => Promise<unknown[]>): SiYuanClient {
  return {
    sql: vi.fn().mockImplementation(sqlImpl) as SiYuanClient['sql'],
    lsNotebooks: vi.fn().mockResolvedValue([]),
    getNotebookConf: vi.fn().mockResolvedValue({ dailyNoteSavePath: '', dailyNoteTemplatePath: '' }),
    createDailyNote: vi.fn().mockResolvedValue({ id: '' }),
    renderSprig: vi.fn().mockResolvedValue(''),
    createDocWithMd: vi.fn().mockResolvedValue(''),
    renderTemplate: vi.fn().mockResolvedValue({ content: '' }),
    prependBlock: vi.fn().mockResolvedValue(undefined),
    setBlockAttrs: vi.fn().mockResolvedValue(undefined),
    getLocalStorage: vi.fn().mockResolvedValue({}),
    setLocalStorageVal: vi.fn().mockResolvedValue(undefined),
    searchDocs: vi.fn().mockResolvedValue([]),
  };
}

const NOTEBOOKS: SiYuanNotebook[] = [
  { id: 'nb-1', name: '技术笔记', icon: '', closed: false },
  { id: 'nb-2', name: '日记', icon: '', closed: false },
];

describe('RecentReadTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('records only the document stayed on for >= 1500ms and clears timers on dispose', () => {
    const recorded: string[] = [];
    const tracker = new RecentReadTracker((id) => {
      recorded.push(id);
    }, 1500);

    tracker.onSwitchDoc('doc-1');
    vi.advanceTimersByTime(500);
    tracker.onSwitchDoc('doc-2');
    vi.advanceTimersByTime(500);
    tracker.onSwitchDoc('doc-3');
    vi.advanceTimersByTime(1500);
    expect(recorded).toEqual(['doc-3']);

    // Switch and dispose before dwell threshold -> should not record
    tracker.onSwitchDoc('doc-4');
    tracker.dispose();
    vi.advanceTimersByTime(2000);
    expect(recorded).toEqual(['doc-3']);
  });
});

describe('recentDocsService', () => {
  it('fetches recent modified docs with batch snippets, title-img / asset thumbnails, and hideDailyNotes filter', async () => {
    const sqlQueries: string[] = [];
    const api = createMockApi(async (stmt) => {
      sqlQueries.push(stmt);
      if (stmt.includes("type = 'd'")) {
        return [
          {
            id: 'd-1',
            box: 'nb-1',
            hpath: '/React/Notes',
            content: 'React 笔记',
            tag: '#前端# #React#',
            ial: '{: icon="269b" title-img="background-image:url(assets/hero.png)"}',
            updated: '20261122140000',
          },
          {
            id: 'd-2',
            box: 'nb-1',
            hpath: '/Empty',
            content: '带正文图文档',
            tag: '',
            ial: '{: title-img="background-image:linear-gradient(90deg,#000,#fff)"}',
            updated: '20261122130000',
          },
        ];
      }
      if (stmt.includes('FROM assets')) {
        return [{ root_id: 'd-2', path: 'assets/fallback.webp' }];
      }
      return [
        { root_id: 'd-1', content: 'Hooks 总结', markdown: '## Hooks 总结' },
      ];
    });

    const res = await fetchRecentModifiedDocs(api, NOTEBOOKS, {
      notebookId: 'all',
      hideDailyNotes: true,
      limit: 12,
      offset: 0,
    });

    expect(sqlQueries[0]).toContain("custom-dailynote-%");
    expect(res.items).toHaveLength(2);
    expect(res.hasMore).toBe(false);
    expect(res.items[0].thumbnailUrl).toBe('assets/hero.png');
    expect(res.items[0].snippet).toBe('Hooks 总结');
    expect(res.items[0].notebookName).toBe('技术笔记');
    expect(res.items[1].thumbnailUrl).toBe('assets/fallback.webp');
    expect(res.items[1].snippet).toBe('');
  });

  it('preserves read order, filters deleted docs, and notifies onDeadIds for pruning', async () => {
    const api = createMockApi(async (stmt) => {
      if (stmt.includes("type = 'd'")) {
        return [
          {
            id: 'd-alive',
            box: 'nb-1',
            hpath: '/Alive',
            content: '存活文档',
            tag: '',
            ial: '',
            updated: '20261121100000',
          },
        ];
      }
      return [];
    });

    const pruneCb = vi.fn();
    const res = await fetchRecentReadDocs(
      api,
      NOTEBOOKS,
      [
        { docId: 'd-deleted', lastReadAt: 2000, readCount: 1 },
        { docId: 'd-alive', lastReadAt: 1000, readCount: 3 },
      ],
      { notebookId: 'all', hideDailyNotes: false, limit: 12, offset: 0 },
      pruneCb,
    );

    expect(res.items.map((i) => i.id)).toEqual(['d-alive']);
    expect(res.items[0].readAtMs).toBe(1000);
    expect(pruneCb).toHaveBeenCalledWith(new Set(['d-deleted']));
  });

  it('skips dead-id pruning when any notebook is closed and uses ROW_NUMBER leaf-block SQL for snippets', async () => {
    const queries: string[] = [];
    const api = createMockApi(async (stmt) => {
      queries.push(stmt);
      if (stmt.includes("type = 'd'")) {
        return [
          {
            id: 'd-open',
            box: 'nb-1',
            hpath: '/Open',
            content: '打开本笔记',
            tag: '',
            ial: '',
            updated: '20261122100000',
          },
        ];
      }
      return [];
    });

    const pruneCb = vi.fn();
    await fetchRecentReadDocs(
      api,
      [
        { id: 'nb-1', name: '技术笔记', icon: '', closed: false },
        { id: 'nb-closed', name: '归档本', icon: '', closed: true },
      ],
      [
        { docId: 'd-in-closed-nb', lastReadAt: 2000, readCount: 1 },
        { docId: 'd-open', lastReadAt: 1000, readCount: 1 },
      ],
      { notebookId: 'all', hideDailyNotes: false, limit: 12, offset: 0 },
      pruneCb,
    );

    expect(pruneCb).not.toHaveBeenCalled();
    const snippetSql = queries.find((q) => q.includes('ROW_NUMBER() OVER (PARTITION BY root_id'));
    expect(snippetSql).toBeDefined();
    expect(snippetSql).not.toContain("'l'");
    expect(snippetSql).not.toContain("'b'");
  });

  it('excludes hiddenNotebookIds when notebookId is all, while still allowing direct inspection of a hidden notebook', async () => {
    const sqls: string[] = [];
    const api = createMockApi(async (stmt) => {
      sqls.push(stmt);
      if (stmt.includes("type = 'd'") && stmt.includes('id IN (')) {
        return [
          { id: 'd-tech', box: 'nb-1', hpath: '/Tech', content: '技术', tag: '', ial: '', updated: '20261122120000' },
          { id: 'd-diary-month', box: 'nb-2', hpath: '/2026/11', content: '2026/11', tag: '', ial: '', updated: '20261122110000' },
        ];
      }
      return [];
    });

    await fetchRecentModifiedDocs(api, NOTEBOOKS, {
      notebookId: 'all',
      hideDailyNotes: false,
      hiddenNotebookIds: ['nb-2'],
      limit: 12,
      offset: 0,
    });
    expect(sqls[0]).toContain("box NOT IN ('nb-2')");

    await fetchRecentModifiedDocs(api, NOTEBOOKS, {
      notebookId: 'nb-2',
      hideDailyNotes: false,
      hiddenNotebookIds: ['nb-2'],
      limit: 12,
      offset: 0,
    });
    expect(sqls[1]).toContain("box = 'nb-2'");
    expect(sqls[1]).not.toContain('NOT IN');

    const readAll = await fetchRecentReadDocs(
      api,
      NOTEBOOKS,
      [
        { docId: 'd-tech', lastReadAt: 2000, readCount: 1 },
        { docId: 'd-diary-month', lastReadAt: 1500, readCount: 1 },
      ],
      { notebookId: 'all', hideDailyNotes: false, hiddenNotebookIds: ['nb-2'], limit: 12, offset: 0 },
    );
    expect(readAll.items.map((i) => i.id)).toEqual(['d-tech']);
  });

  it('hides arbitrary parent document IDs and their entire descendant subtrees across modified and read queries', async () => {
    const sqls: string[] = [];
    const api = createMockApi(async (stmt) => {
      sqls.push(stmt);
      if (stmt.includes("type = 'd'") && stmt.includes('id IN (')) {
        return [
          {
            id: 'd-normal',
            box: 'nb-1',
            path: '/d-normal.sy',
            hpath: '/Normal',
            content: '普通笔记',
            tag: '',
            ial: '',
            updated: '20261122120000',
          },
          {
            id: 'd-sub-root',
            box: 'nb-1',
            path: '/d-sub-root.sy',
            hpath: '/日记根目录',
            content: '日记根目录',
            tag: '',
            ial: '',
            updated: '20261122115000',
          },
          {
            id: 'd-sub-child',
            box: 'nb-1',
            path: '/d-sub-root/202611/d-sub-child.sy',
            hpath: '/日记根目录/2026-11/2026-11-22',
            content: '2026-11-22',
            tag: '',
            ial: '',
            updated: '20261122114000',
          },
        ];
      }
      return [];
    });

    await fetchRecentModifiedDocs(api, NOTEBOOKS, {
      notebookId: 'nb-1',
      hideDailyNotes: false,
      hiddenIds: ['d-sub-root', 'nb-2'],
      limit: 12,
      offset: 0,
    });
    expect(sqls[0]).toContain("box = 'nb-1'");
    expect(sqls[0]).toContain("id NOT IN ('d-sub-root','nb-2')");
    expect(sqls[0]).toContain("path NOT LIKE '%/d-sub-root/%'");

    const readRes = await fetchRecentReadDocs(
      api,
      NOTEBOOKS,
      [
        { docId: 'd-normal', lastReadAt: 3000, readCount: 1 },
        { docId: 'd-sub-root', lastReadAt: 2000, readCount: 1 },
        { docId: 'd-sub-child', lastReadAt: 1000, readCount: 1 },
      ],
      {
        notebookId: 'nb-1',
        hideDailyNotes: false,
        hiddenIds: ['d-sub-root'],
        limit: 12,
        offset: 0,
      },
    );
    expect(readRes.items.map((i) => i.id)).toEqual(['d-normal']);
  });
});
