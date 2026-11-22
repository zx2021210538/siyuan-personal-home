import React, { useMemo } from 'react';
import {
  Activity,
  BookOpen,
  CalendarCheck2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileText,
  Flame,
} from 'lucide-react';
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

  const statTiles = [
    {
      label: '文档总数',
      value: stats.totalDocs.toLocaleString(),
      sub: '全工作区笔记',
      icon: FileText,
      tint: '#3b82f6',
    },
    {
      label: '总字数',
      value: formatCompactWords(stats.totalWords),
      sub: `${stats.totalBlocks.toLocaleString()} 个内容块`,
      icon: BookOpen,
      tint: '#8b5cf6',
    },
    {
      label: '近 7 天活跃',
      value: String(stats.recent7DaysDocs),
      sub: '篇近期更新',
      icon: Flame,
      tint: '#f59e0b',
    },
    {
      label: '今年日记',
      value: String(stats.yearDiaryDays),
      sub: '天已留下记录',
      icon: CalendarCheck2,
      tint: '#10b981',
    },
  ];

  const rowLabels =
    weekStartDay === 1
      ? ['一', '', '三', '', '五', '', '日']
      : ['日', '', '二', '', '四', '', '六'];

  return (
    <section className="flex flex-col gap-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {statTiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <div key={tile.label} className="sph-stat-tile px-4 py-3.5 flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium" style={{ color: 'var(--sph-muted)' }}>
                  {tile.label}
                </span>
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${tile.tint} 12%, transparent)`,
                    color: tile.tint,
                  }}
                >
                  <Icon size={15} strokeWidth={2} />
                </span>
              </div>
              <div className="min-w-0">
                <div
                  className="sph-tabular text-2xl font-semibold tracking-tight leading-none truncate"
                  style={{ color: 'var(--sph-text)' }}
                >
                  {tile.value}
                </div>
                <div className="text-[11px] mt-1.5 truncate" style={{ color: 'var(--sph-subtle)' }}>
                  {tile.sub}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="sph-card px-4 py-3.5 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span
              className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--sph-accent-soft)', color: 'var(--sph-accent)' }}
            >
              <Activity size={13} />
            </span>
            <span className="text-[13px] font-semibold" style={{ color: 'var(--sph-text)' }}>
              {year} 年度写作热力图
            </span>
            <span className="text-xs sph-tabular" style={{ color: 'var(--sph-muted)' }}>
              {totalBlocksInYear.toLocaleString()} 块 · 活跃 {activeDaysInYear} 天
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {showHeatmap && (
              <div
                className="inline-flex items-center rounded-lg p-0.5"
                style={{ backgroundColor: 'var(--sph-tile)', border: '1px solid var(--sph-border)' }}
              >
                <button
                  type="button"
                  className="sph-btn-ghost !p-1"
                  aria-label="上一年"
                  onClick={() => onChangeYear(year - 1)}
                >
                  <ChevronLeft size={13} />
                </button>
                <span className="text-xs font-medium px-1.5 sph-tabular">{year}</span>
                <button
                  type="button"
                  className="sph-btn-ghost !p-1"
                  aria-label="下一年"
                  onClick={() => onChangeYear(year + 1)}
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            )}
            <button
              type="button"
              className="sph-btn-ghost px-2 py-1 text-xs"
              aria-label={showHeatmap ? '折叠热力图' : '展开热力图'}
              onClick={onToggleHeatmap}
            >
              {showHeatmap ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              <span>{showHeatmap ? '收起' : '展开'}</span>
            </button>
          </div>
        </div>

        {showHeatmap && weeks.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="overflow-x-auto pb-1">
              <div className="min-w-[640px] flex flex-col gap-1">
                {/* Month labels */}
                <div
                  className="grid items-center pl-6 text-[10px]"
                  style={{
                    gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))`,
                    gap: '3px',
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

                {/* Day labels + full-width grid */}
                <div className="flex gap-1.5 items-stretch">
                  <div
                    className="w-4 shrink-0 grid grid-rows-7 text-[10px] items-center text-right pr-0.5 select-none"
                    style={{ gap: '3px', color: 'var(--sph-subtle)' }}
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
              <span>点击任意格子可直达或创建当日日记</span>
              <div className="inline-flex items-center gap-1">
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
