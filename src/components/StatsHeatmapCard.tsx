import React, { useMemo } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import { parseDateToUtcMs } from '../domain/habitStats';
import type { HeatmapDay, OverviewStats, WeekStartDay } from '../domain/types';

export interface StatsHeatmapCardProps {
  stats: OverviewStats;
  heatmap: HeatmapDay[];
  totalBlocksInYear: number;
  activeDaysInYear: number;
  year: number;
  showHeatmap: boolean;
  weekStartDay: WeekStartDay;
  heatmapOnly?: boolean;
  onChangeYear: (year: number) => void;
  onToggleHeatmap: () => void;
  onClickDate: (dateStr: string) => void;
}

function formatCompactWords(words: number): string {
  if (words >= 10000) {
    return `${(words / 10000).toFixed(1)}w`;
  }
  return words.toLocaleString();
}

const HEAT_COLORS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'var(--sph-heat-0)',
  1: 'var(--sph-heat-1)',
  2: 'var(--sph-heat-2)',
  3: 'var(--sph-heat-3)',
  4: 'var(--sph-heat-4)',
};

const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

export const StatsHeatmapCard: React.FC<StatsHeatmapCardProps> = ({
  stats,
  heatmap,
  totalBlocksInYear,
  activeDaysInYear,
  year,
  showHeatmap,
  weekStartDay,
  heatmapOnly = false,
  onChangeYear,
  onToggleHeatmap,
  onClickDate,
}) => {
  const { weeks, monthLabels } = useMemo(() => {
    if (heatmap.length === 0) {
      return {
        weeks: [] as Array<Array<HeatmapDay | null>>,
        monthLabels: [] as Array<{ col: number; label: string }>,
      };
    }
    const firstDow = new Date(parseDateToUtcMs(heatmap[0].date)).getUTCDay();
    const leadingEmpty = (firstDow - weekStartDay + 7) % 7;
    const cells: Array<HeatmapDay | null> = [
      ...Array.from({ length: leadingEmpty }, () => null),
      ...heatmap,
    ];
    const cols: Array<Array<HeatmapDay | null>> = [];
    for (let i = 0; i < cells.length; i += 7) {
      const col = cells.slice(i, i + 7);
      while (col.length < 7) col.push(null);
      cols.push(col);
    }

    const seenMonths = new Set<number>();
    const labels: Array<{ col: number; label: string }> = [];
    cols.forEach((col, colIdx) => {
      for (const day of col) {
        if (!day) continue;
        const m = Number(day.date.slice(5, 7));
        if (!seenMonths.has(m)) {
          seenMonths.add(m);
          labels.push({ col: colIdx, label: MONTH_NAMES[m - 1] ?? '' });
        }
        break;
      }
    });

    return { weeks: cols, monthLabels: labels };
  }, [heatmap, weekStartDay]);

  const statItems = [
    { label: '文档总数', value: stats.totalDocs.toLocaleString(), note: '篇' },
    {
      label: '累计字数',
      value: formatCompactWords(stats.totalWords),
      note: `${stats.totalBlocks.toLocaleString()} 块`,
    },
    { label: '近 7 日活跃', value: String(stats.recent7DaysDocs), note: '篇更新' },
    { label: '今年日记', value: String(stats.yearDiaryDays), note: '天' },
  ];

  const rowLabels =
    weekStartDay === 1
      ? ['一', '', '三', '', '五', '', '日']
      : ['日', '', '二', '', '四', '', '六'];

  return (
    <section className="flex flex-col gap-6">
      {!heatmapOnly && (
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-6 py-4"
          style={{
            borderTop: '1px solid var(--sph-hairline)',
            borderBottom: '1px solid var(--sph-hairline)',
          }}
        >
          {statItems.map((item, idx) => (
            <div
              key={item.label}
              className="flex flex-col gap-1"
              style={{
                borderLeft: idx > 0 ? '1px solid var(--sph-hairline)' : 'none',
                paddingLeft: idx > 0 ? '20px' : '0px',
              }}
            >
              <span className="text-xs tracking-wide" style={{ color: 'var(--sph-muted)' }}>
                {item.label}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="sph-num-font text-[28px] font-semibold tracking-tight leading-none">
                  {item.value}
                </span>
                <span className="text-xs" style={{ color: 'var(--sph-subtle)' }}>
                  {item.note}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[16px] font-medium tracking-wide">
              {year} 写作足迹
            </h2>
            <span className="text-xs sph-num-font" style={{ color: 'var(--sph-muted)' }}>
              共 {totalBlocksInYear.toLocaleString()} 块 · 活跃 {activeDaysInYear} 天
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {showHeatmap && (
              <div className="inline-flex items-center gap-0.5">
                <button
                  type="button"
                  className="sph-btn-ghost !p-1"
                  aria-label="上一年"
                  onClick={() => onChangeYear(year - 1)}
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs font-medium px-1.5 sph-num-font">{year}</span>
                <button
                  type="button"
                  className="sph-btn-ghost !p-1"
                  aria-label="下一年"
                  onClick={() => onChangeYear(year + 1)}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
            {!heatmapOnly && (
              <button
                type="button"
                className="sph-btn-ghost px-2 py-1 text-xs"
                aria-label={showHeatmap ? '折叠热力图' : '展开热力图'}
                onClick={onToggleHeatmap}
              >
                {showHeatmap ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                <span>{showHeatmap ? '收起' : '展开'}</span>
              </button>
            )}
          </div>
        </div>

        {showHeatmap && weeks.length > 0 && (
          <div className="sph-panel px-4 py-4 flex flex-col gap-2.5">
            <div className="overflow-x-auto pb-0.5">
              <div className="min-w-[640px] flex flex-col gap-1.5">
                <div
                  className="grid items-center pl-6 text-[10.5px] sph-num-font"
                  style={{
                    gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))`,
                    gap: '3.5px',
                    color: 'var(--sph-subtle)',
                  }}
                >
                  {weeks.map((_, colIdx) => {
                    const found = monthLabels.find((m) => m.col === colIdx);
                    return (
                      <span key={colIdx} className="overflow-visible whitespace-nowrap leading-none">
                        {found ? found.label : ''}
                      </span>
                    );
                  })}
                </div>

                <div className="flex gap-2 items-stretch">
                  <div
                    className="w-4 shrink-0 grid grid-rows-7 text-[10px] items-center text-right select-none"
                    style={{ gap: '3.5px', color: 'var(--sph-subtle)' }}
                  >
                    {rowLabels.map((lbl, idx) => (
                      <span key={idx} className="leading-none">
                        {lbl}
                      </span>
                    ))}
                  </div>

                  <div
                    className="sph-heatmap-grid flex-1"
                    style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
                  >
                    {weeks.map((week, colIdx) =>
                      week.map((day, rowIdx) => {
                        if (!day) {
                          return <div key={`${colIdx}-${rowIdx}`} className="sph-heatmap-cell" />;
                        }
                        const label = `${day.date} · ${day.count} 个内容块${day.hasDiary ? ' · 已有日记' : ''}`;
                        return (
                          <button
                            key={day.date}
                            type="button"
                            aria-label={label}
                            title={label}
                            onClick={() => onClickDate(day.date)}
                            className="sph-heatmap-cell"
                            style={{ backgroundColor: HEAT_COLORS[day.level] }}
                          />
                        );
                      }),
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--sph-subtle)' }}>
              <span>点击任意日期格可直达或创建当日日记</span>
              <div className="inline-flex items-center gap-1.5">
                <span>少</span>
                {([0, 1, 2, 3, 4] as const).map((lv) => (
                  <span
                    key={lv}
                    className="w-2.5 h-2.5 rounded-[2.5px] inline-block"
                    style={{ backgroundColor: HEAT_COLORS[lv] }}
                  />
                ))}
                <span>多</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
