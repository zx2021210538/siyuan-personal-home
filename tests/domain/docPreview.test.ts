import { describe, expect, it } from 'vitest';
import {
  cleanSnippetMarkdown,
  extractDocIcon,
  extractTitleImageUrl,
  formatRelativeTime,
  groupDocsByDateBucket,
  parseIalAttrs,
  parseTags,
} from '../../src/domain/docPreview';

describe('docPreview', () => {
  it('parses SiYuan IAL attributes including HTML entities', () => {
    const ial = '{: id="20261122-abc" icon="1f4d6" title-img="background-image:url(&quot;assets/cover-1.png&quot;)" updated="20261122140000"}';
    const attrs = parseIalAttrs(ial);
    expect(attrs.id).toBe('20261122-abc');
    expect(attrs.icon).toBe('1f4d6');
    expect(attrs['title-img']).toContain('assets/cover-1.png');
  });

  it('extracts real image URLs from title-img and ignores gradients, solid colors, or malformed IAL', () => {
    expect(
      extractTitleImageUrl('{: title-img="background-image:url(assets/cover-123.png)"}'),
    ).toBe('assets/cover-123.png');
    expect(
      extractTitleImageUrl('{: title-img="background-image:url(&quot;https://example.com/a.webp&quot;)"}'),
    ).toBe('https://example.com/a.webp');
    expect(
      extractTitleImageUrl('{: title-img="background-image:linear-gradient(120deg, #a1c4fd 0%, #c2e9fb 100%)"}'),
    ).toBeNull();
    expect(
      extractTitleImageUrl('{: title-img="background-color:#222222"}'),
    ).toBeNull();
    expect(
      extractTitleImageUrl('{: title-img="background-image:url(data:image/svg+xml;utf8,<svg/>)"}'),
    ).toBeNull();
    expect(extractTitleImageUrl(null)).toBeNull();
    expect(extractTitleImageUrl('broken-ial-without-braces')).toBeNull();
  });

  it('extracts emoji and custom image doc icons', () => {
    expect(extractDocIcon('{: icon="1f4d6"}')).toEqual({ type: 'emoji', value: '📖' });
    expect(extractDocIcon('{: icon="1f469-200d-1f4bb"}')).toEqual({
      type: 'emoji',
      value: '👩‍💻',
    });
    expect(extractDocIcon('{: icon="custom/my-icon.svg"}')).toEqual({
      type: 'image',
      value: '/emojis/custom/my-icon.svg',
    });
    expect(extractDocIcon('{: id="123"}')).toBeNull();
  });

  it('cleans markdown syntax from snippets and handles empty docs safely', () => {
    const snippet = cleanSnippetMarkdown(
      [
        '## 第一节 **核心结论**',
        '参考 ((20260101-xyz "实验记录")) 和 [思源官网](https://b3log.org) 的说明。',
        '```ts\nconst x = 1;\n```',
      ],
      80,
    );
    expect(snippet).toBe('第一节 核心结论 参考 实验记录 和 思源官网 的说明。');
    expect(cleanSnippetMarkdown([])).toBe('');
    expect(cleanSnippetMarkdown(['   ', ''])).toBe('');
  });

  it('parses up to 3 tags from SiYuan tag field', () => {
    expect(parseTags('#科研# #论文/实验# #复盘# #多余标签#')).toEqual([
      '科研',
      '论文/实验',
      '复盘',
    ]);
    expect(parseTags('')).toEqual([]);
  });

  it('formats relative time concisely in Chinese', () => {
    const now = Date.UTC(2026, 10, 22, 14, 0, 0);
    expect(formatRelativeTime(now - 20_000, now)).toBe('刚刚');
    expect(formatRelativeTime(now - 12 * 60_000, now)).toBe('12 分钟前');
    expect(formatRelativeTime(now - 3 * 3_600_000, now)).toBe('3 小时前');
    expect(formatRelativeTime(now - 5 * 86_400_000, now)).toBe('11-17');
  });

  it('groups documents into Notebook Navigator date buckets', () => {
    const now = new Date(2026, 10, 22, 16, 0, 0).getTime();
    const docs = [
      { id: '1', ts: new Date(2026, 10, 22, 10, 0, 0).getTime() },
      { id: '2', ts: new Date(2026, 10, 21, 18, 0, 0).getTime() },
      { id: '3', ts: new Date(2026, 10, 18, 9, 0, 0).getTime() },
      { id: '4', ts: new Date(2026, 10, 5, 9, 0, 0).getTime() },
      { id: '5', ts: new Date(2026, 8, 15, 9, 0, 0).getTime() },
      { id: '6', ts: 0 },
    ];
    const groups = groupDocsByDateBucket(docs, (d) => d.ts, now);
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ['今天', ['1']],
      ['昨天', ['2']],
      ['近 7 天', ['3']],
      ['近 30 天', ['4']],
      ['2026 年 9 月', ['5']],
      ['更早', ['6']],
    ]);
  });
});
