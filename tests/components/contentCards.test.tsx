import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StatsHeatmapCard } from '../../src/components/StatsHeatmapCard';
import { TodayDailyNoteCard } from '../../src/components/TodayDailyNoteCard';
import { RecentDocsCard } from '../../src/components/RecentDocsCard';
import type { DocPreviewItem, HeatmapDay, OverviewStats } from '../../src/domain/types';

const SAMPLE_STATS: OverviewStats = {
  totalDocs: 342,
  totalWords: 482100,
  totalBlocks: 12500,
  recent7DaysDocs: 18,
  yearDiaryDays: 126,
};

const SAMPLE_HEATMAP: HeatmapDay[] = [
  { date: '2026-01-01', count: 5, level: 2, hasDiary: true },
  { date: '2026-01-02', count: 0, level: 0, hasDiary: false },
];

const SAMPLE_DOC: DocPreviewItem = {
  id: 'doc-1',
  box: 'nb-1',
  notebookName: '技术笔记',
  hpath: '/Frontend/React',
  title: 'React 19 架构笔记',
  icon: { type: 'emoji', value: '⚛️' },
  snippet: '这是一段清洗后的笔记正文摘要预览。',
  thumbnailUrl: 'assets/cover.png',
  tags: ['前端', 'React'],
  updatedAtMs: Date.now() - 10 * 60_000,
  wordCount: 420,
};

describe('Content Cards (Task 7)', () => {
  it('StatsHeatmapCard displays 4 stats, toggles heatmap, switches year, and opens date on click', () => {
    const onChangeYear = vi.fn();
    const onToggleHeatmap = vi.fn();
    const onClickDate = vi.fn();

    render(
      <StatsHeatmapCard
        stats={SAMPLE_STATS}
        heatmap={SAMPLE_HEATMAP}
        totalBlocksInYear={5}
        activeDaysInYear={1}
        year={2026}
        showHeatmap={true}
        weekStartDay={1}
        onChangeYear={onChangeYear}
        onToggleHeatmap={onToggleHeatmap}
        onClickDate={onClickDate}
      />,
    );

    expect(screen.getByText('342')).toBeInTheDocument();
    expect(screen.getByText('48.2w')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('126')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '上一年' }));
    expect(onChangeYear).toHaveBeenCalledWith(2025);

    fireEvent.click(screen.getByRole('button', { name: '折叠热力图' }));
    expect(onToggleHeatmap).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /2026-01-01/ }));
    expect(onClickDate).toHaveBeenCalledWith('2026-01-01');
  });

  it('TodayDailyNoteCard renders empty state with create action or preview card with open action', () => {
    const onOpenDoc = vi.fn();
    const onCreateToday = vi.fn();

    const { rerender } = render(
      <TodayDailyNoteCard
        todayStr="2026-11-22"
        dailyNote={null}
        loading={false}
        onOpenDoc={onOpenDoc}
        onCreateToday={onCreateToday}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /写今天的日记/ }));
    expect(onCreateToday).toHaveBeenCalledTimes(1);

    rerender(
      <TodayDailyNoteCard
        todayStr="2026-11-22"
        dailyNote={SAMPLE_DOC}
        loading={false}
        onOpenDoc={onOpenDoc}
        onCreateToday={onCreateToday}
      />,
    );

    expect(screen.getByText('React 19 架构笔记')).toBeInTheDocument();
    expect(screen.getByText(/420 字/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('today-daily-note-card'));
    expect(onOpenDoc).toHaveBeenCalledWith('doc-1');

    // Structured LifeLog moments rendering
    rerender(
      <TodayDailyNoteCard
        expanded
        todayStr="2026-11-10"
        dailyNote={{
          ...SAMPLE_DOC,
          title: '2026-11-10',
          wordCount: 120,
          moments: [
            {
              id: 'm1',
              title: '上午例会',
              period: '上午',
              time: '09:00–11:30',
              text: '汇报顺利完成。',
              images: [],
            },
          ],
        }}
        loading={false}
        onOpenDoc={onOpenDoc}
        onCreateToday={onCreateToday}
      />,
    );
    expect(screen.getByText('上午例会')).toBeInTheDocument();
    expect(screen.getByText('汇报顺利完成。')).toBeInTheDocument();
    expect(screen.getByText(/1 条片段/)).toBeInTheDocument();
  });

  it('RecentDocsCard switches tabs, hides thumbnails when absent, renders cold-start copy, and loads more', () => {
    const onChangeTab = vi.fn();
    const onOpenDoc = vi.fn();
    const onLoadMore = vi.fn();

    const docNoImg: DocPreviewItem = {
      ...SAMPLE_DOC,
      id: 'doc-2',
      title: '无图笔记',
      thumbnailUrl: null,
      tags: ['后端'],
    };

    const { rerender } = render(
      <RecentDocsCard
        activeTab="modified"
        onChangeTab={onChangeTab}
        items={[SAMPLE_DOC, docNoImg]}
        hasMore={true}
        loading={false}
        hideDailyNotes={false}
        onToggleHideDailyNotes={vi.fn()}
        notebookId="all"
        notebooks={[{ id: 'nb-1', name: '技术笔记', icon: '', closed: false }]}
        onChangeNotebook={vi.fn()}
        keyword=""
        onChangeKeyword={vi.fn()}
        onLoadMore={onLoadMore}
        onOpenDoc={onOpenDoc}
      />,
    );

    expect(screen.getByText('React 19 架构笔记')).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.getByText('#前端')).toBeInTheDocument();

    fireEvent.click(screen.getByText('无图笔记'));
    expect(onOpenDoc).toHaveBeenCalledWith('doc-2');

    fireEvent.click(screen.getByRole('button', { name: /加载更多/ }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('tab', { name: '最近读过' }));
    expect(onChangeTab).toHaveBeenCalledWith('read');

    rerender(
      <RecentDocsCard
        activeTab="read"
        onChangeTab={onChangeTab}
        items={[]}
        hasMore={false}
        loading={false}
        hideDailyNotes={false}
        onToggleHideDailyNotes={vi.fn()}
        notebookId="all"
        notebooks={[]}
        onChangeNotebook={vi.fn()}
        keyword=""
        onChangeKeyword={vi.fn()}
        onLoadMore={onLoadMore}
        onOpenDoc={onOpenDoc}
      />,
    );

    expect(screen.getByText(/浏览过的笔记会自动出现在这里/)).toBeInTheDocument();
  });

  it('RecentDocsCard renders custom image doc icons and hides broken thumbnails cleanly on error', () => {
    const docWithImgIcon: DocPreviewItem = {
      ...SAMPLE_DOC,
      id: 'doc-img-icon',
      title: '自定义图标笔记',
      icon: { type: 'image', value: '/emojis/custom.svg' },
      thumbnailUrl: 'assets/missing.png',
    };

    render(
      <RecentDocsCard
        activeTab="modified"
        onChangeTab={vi.fn()}
        items={[docWithImgIcon]}
        hasMore={false}
        loading={false}
        hideDailyNotes={false}
        onToggleHideDailyNotes={vi.fn()}
        notebookId="all"
        notebooks={[]}
        onChangeNotebook={vi.fn()}
        keyword=""
        onChangeKeyword={vi.fn()}
        onLoadMore={vi.fn()}
        onOpenDoc={vi.fn()}
      />,
    );

    const imgs = document.querySelectorAll('img');
    expect(imgs).toHaveLength(2); // icon img + thumbnail img
    fireEvent.error(screen.getByAltText('自定义图标笔记'));
    expect(screen.queryByAltText('自定义图标笔记')).toBeNull();
    expect(document.querySelectorAll('img')).toHaveLength(1);
  });

  it('RecentDocsCard navigator mode supports hiding notebooks, appearance popover (lines/justify/indent), date groups, and clickable tags', () => {
    const onToggleHiddenNotebook = vi.fn();
    const onChangeKeyword = vi.fn();
    const onOpenDoc = vi.fn();
    const onChangeDisplayPrefs = vi.fn();

    const { container } = render(
      <RecentDocsCard
        navigatorMode
        activeTab="modified"
        onChangeTab={vi.fn()}
        items={[SAMPLE_DOC]}
        hasMore={false}
        loading={false}
        hiddenNotebookIds={[]}
        onToggleHiddenNotebook={onToggleHiddenNotebook}
        diaryNotebookId="nb-diary"
        notebookId="all"
        notebooks={[
          { id: 'nb-1', name: '技术笔记', icon: '', closed: false },
          { id: 'nb-diary', name: '每日日记', icon: '', closed: false },
        ]}
        onChangeNotebook={vi.fn()}
        keyword=""
        onChangeKeyword={onChangeKeyword}
        onLoadMore={vi.fn()}
        onOpenDoc={onOpenDoc}
        onChangeDisplayPrefs={onChangeDisplayPrefs}
      />,
    );

    // Date group header shown
    expect(screen.getByText('今天')).toBeInTheDocument();

    // Clicking tag filters keyword without opening document
    fireEvent.click(screen.getByRole('button', { name: '#前端' }));
    expect(onChangeKeyword).toHaveBeenCalledWith('#前端');
    expect(onOpenDoc).not.toHaveBeenCalled();

    // Hiding diary notebook via dedicated switch or eye button
    fireEvent.click(screen.getByLabelText('隐藏日记本'));
    expect(onToggleHiddenNotebook).toHaveBeenCalledWith('nb-diary');

    // Open Appearance popover and adjust preview lines + justify + indent
    fireEvent.click(screen.getByRole('button', { name: '卡片显示外观' }));
    fireEvent.click(screen.getByRole('button', { name: '预览 4 行' }));
    expect(onChangeDisplayPrefs).toHaveBeenCalledWith({ previewLines: 4 });
    expect(container.querySelector('.sph-line-clamp-4')).not.toBeNull();

    fireEvent.click(screen.getByLabelText('两端对齐'));
    expect(container.querySelector('.sph-snippet-justify')).not.toBeNull();

    fireEvent.click(screen.getByLabelText('首行缩进 2 字'));
    expect(container.querySelector('.sph-snippet-indent')).not.toBeNull();

    // Compact mode (0 lines) hides snippet
    fireEvent.click(screen.getByRole('button', { name: '紧凑模式（0行）' }));
    expect(screen.queryByText(/这是一段清洗后的笔记正文摘要预览/)).toBeNull();
  });
});
