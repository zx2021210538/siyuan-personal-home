import { describe, expect, it, vi } from 'vitest';
import {
  extractLifeLogConfig,
  parseLifeLogMomentsForDate,
} from '../../src/domain/lifelogParser';
import { fetchDailyNoteByDate } from '../../src/services/dailyNoteService';
import type { SiYuanClient } from '../../src/services/siyuanApi';

const SAMPLE_HTML = `
<div id="lifelog-root-v2" class="lifelog"></div>
<script>
  var AV_ID="20261025132958-73hr5xe";
  var DB_BLOCK_ID="20261025132958-u22bl21";
  var VIEW_ID="20261025133022-sa0uzub";
  var K_TITLE="20261025132958-iixx2xj";
  var K_RECORD="20261025134457-kw7h6jg";
  var K_DATE="20261025132958-x4hp44h";
  var K_TIME="20261025132958-vadamjy";
  var K_PERIOD="20261025132958-g3fmkdy";
  var K_IMAGE="20261025132958-tvszf0p";
</script>
`;

const SAMPLE_AV_DATA = {
  view: {
    groups: [
      {
        name: '2026-11-10',
        rows: [
          {
            id: 'row-1',
            cells: [
              { value: { keyID: '20261025132958-iixx2xj', block: { icon: '1f4ac', content: '上午例会' } } },
              { value: { keyID: '20261025132958-x4hp44h', date: { isNotEmpty: true, formattedContent: '2026/11/10' } } },
              { value: { keyID: '20261025132958-vadamjy', text: { content: '09:00–11:30' } } },
              { value: { keyID: '20261025132958-g3fmkdy', mSelect: [{ content: '上午' }] } },
              { value: { keyID: '20261025134457-kw7h6jg', text: { content: '汇报顺利完成。:custom/smile:' } } },
              { value: { keyID: '20261025132958-tvszf0p', mAsset: [{ type: 'image', content: 'assets/meal.jpg' }] } },
            ],
          },
          {
            id: 'row-other-day',
            cells: [
              { value: { keyID: '20261025132958-iixx2xj', block: { content: '其他日期' } } },
              { value: { keyID: '20261025132958-x4hp44h', date: { isNotEmpty: true, formattedContent: '2026/11/09' } } },
              { value: { keyID: '20261025134457-kw7h6jg', text: { content: '不应该出现' } } },
            ],
          },
        ],
      },
    ],
  },
};

describe('LifeLog HTML widget diary parser & service integration', () => {
  it('extracts AttributeView config dynamically from HTML widget source', () => {
    const cfg = extractLifeLogConfig(SAMPLE_HTML);
    expect(cfg).toEqual({
      avId: '20261025132958-73hr5xe',
      dbBlockId: '20261025132958-u22bl21',
      viewId: '20261025133022-sa0uzub',
      titleKeyId: '20261025132958-iixx2xj',
      recordKeyId: '20261025134457-kw7h6jg',
      dateKeyId: '20261025132958-x4hp44h',
      timeKeyId: '20261025132958-vadamjy',
      periodKeyId: '20261025132958-g3fmkdy',
      imageKeyId: '20261025132958-tvszf0p',
    });
    expect(extractLifeLogConfig('<div>plain html</div>')).toBeNull();
  });

  it('parses only matching date moments with cleaned text, icons, periods, times, photos, and custom stickers', () => {
    const cfg = extractLifeLogConfig(SAMPLE_HTML)!;
    const moments = parseLifeLogMomentsForDate(SAMPLE_AV_DATA, cfg, '2026-11-10');
    expect(moments).toHaveLength(1);
    expect(moments[0]).toEqual({
      id: 'row-1',
      title: '上午例会',
      icon: { type: 'emoji', value: '💬' },
      period: '上午',
      time: '09:00–11:30',
      text: '汇报顺利完成。',
      images: ['/assets/meal.jpg'],
      stickers: [
        {
          code: 'custom/smile',
          candidates: [
            '/emojis/custom/smile.webp',
            '/emojis/custom/smile.gif',
            '/emojis/custom/smile.png',
            '/emojis/custom/smile.jpg',
            '/emojis/custom/smile.jpeg',
            '/emojis/custom/smile.svg',
          ],
        },
      ],
    });
  });

  it('extracts inline markdown images and resolves custom emoji stickers from window.siyuan.emojis', () => {
    const win = window as unknown as {
      siyuan?: { emojis?: Array<{ items?: Array<{ unicode?: string; description?: string }> }> };
    };
    const prev = win.siyuan;
    win.siyuan = {
      emojis: [
        {
          items: [{ unicode: 'AI娘/委屈哭哭.webp', description: 'AI娘/委屈哭哭' }],
        },
      ],
    };
    try {
      const cfg = extractLifeLogConfig(SAMPLE_HTML)!;
      const moments = parseLifeLogMomentsForDate(
        {
          view: {
            groups: [
              {
                rows: [
                  {
                    id: 'row-inline',
                    cells: [
                      { value: { keyID: '20261025132958-iixx2xj', block: { content: '下午上班' } } },
                      { value: { keyID: '20261025132958-x4hp44h', date: { isNotEmpty: true, formattedContent: '2026/10/29' } } },
                      {
                        value: {
                          keyID: '20261025134457-kw7h6jg',
                          text: { content: '基础模型算力不够:AI娘/委屈哭哭:\n![shot](assets/inline-shot.png)' },
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
        cfg,
        '2026-10-29',
      );
      expect(moments).toHaveLength(1);
      expect(moments[0].text).toBe('基础模型算力不够');
      expect(moments[0].images).toEqual(['/assets/inline-shot.png']);
      expect(moments[0].stickers?.[0].code).toBe('AI娘/委屈哭哭');
      expect(moments[0].stickers?.[0].candidates[0]).toBe(encodeURI('/emojis/AI娘/委屈哭哭.webp'));
    } finally {
      win.siyuan = prev;
    }
  });

  it('fetchDailyNoteByDate populates real LifeLog moments and excludes raw HTML source from wordCount', async () => {
    const api: SiYuanClient = {
      sql: vi.fn().mockImplementation(async (stmt: string) => {
        if (stmt.includes('custom-dailynote-20261110')) return [{ root_id: 'doc-10' }];
        if (stmt.includes("type = 'd'")) {
          return [{ id: 'doc-10', box: 'nb-1', hpath: '/2026-11-10', content: '2026-11-10', tag: '', ial: '', updated: '20261110220000' }];
        }
        if (stmt.includes("type = 'html'")) {
          return [{ markdown: SAMPLE_HTML, content: '' }];
        }
        if (stmt.includes('SUM(length)')) {
          expect(stmt).not.toContain("'html'");
          return [{ totalWords: 6 }];
        }
        if (stmt.includes('FROM assets')) return [];
        return [{ content: '— 晚安 —', markdown: '— 晚安 —' }];
      }),
      renderAttributeView: vi.fn().mockResolvedValue(SAMPLE_AV_DATA),
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

    const note = await fetchDailyNoteByDate(api, 'nb-1', '2026-11-10', '周记与待办');
    expect(note).not.toBeNull();
    expect(note?.moments).toHaveLength(1);
    expect(note?.moments?.[0].title).toBe('上午例会');
    expect(note?.wordCount).toBe(11); // "上午例会"(4) + "汇报顺利完成。"(7) instead of 49227!
    expect(note?.thumbnailUrl).toBe('/assets/meal.jpg');
  });
});
