import React, { useMemo } from 'react';
import {
  BookOpen,
  CalendarCheck,
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
  const weeks = useMemo(() => {
    if (heatmap.length === 0) return [] as Array<Array<HeatmapDay | null>>;
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
    return cols;
  }, [heatmap, weekStartDay]);

  const statTiles = [
    {
      label: '文档总数',
      value: stats.totalDocs.toLocaleString(),
      sub: '全工作区',
      icon: FileText,
    },
    {
      label: '总字数',
      value: formatCompactWords(stats.totalWords),
      sub: `${stats.totalBlocks.toLocaleString()} 内容块`,
      icon: BookOpen,
    },
    {
      label: '近 7 天活跃',
      value: String(stats.recent7DaysDocs),
      sub: '篇更新',
      icon: Flame,
    },
    {
      label: '今年日记',
      value: String(stats.yearDiaryDays),
      sub: '天已记录',
      icon: CalendarCheck,
    },
  ];

  return (
    <section className="sph-card p-4 flex flex-col gap-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statTiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <div
              key={tile.label}
              className="rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2"
              style={{
                backgroundColor: 'var(--sph-surface)',
                border: '1px solid var(--sph-border)',
              }}
            >
              <div className="min-w-0">
                <div className="text-xs" style={{ color: 'var(--sph-muted)' }}>
                  {tile.label}
                </div>
                <div className="text-xl font-semibold leading-tight mt-0.5 truncate">
                  {tile.value}
                </div>
                <div className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--sph-muted)' }}>
                  {tile.sub}
                </div>
              </div>
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: 'var(--sph-accent-soft)',
                  color: 'var(--sph-accent)',
                }}
              >
                <Icon size={16} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--sph-muted)' }}>
          <span className="font-medium" style={{ color: 'var(--sph-text)' }}>
            {year} 年度写作热力图
          </span>
          <span>
            共 {totalBlocksInYear.toLocaleString()} 块 · 活跃 {activeDaysInYear} 天
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {showHeatmap && (
            <>
              <button
                type="button"
                className="sph-btn !p-1"
                aria-label="上一年"
                onClick={() => onChangeYear(year - 1)}
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-medium px-1">{year}</span>
              <button
                type="button"
                className="sph-btn !p-1"
                aria-label="下一年"
                onClick={() => onChangeYear(year + 1)}
              >
                <ChevronRight size={14} />
              </button>
            </>
          )}
          <button
            type="button"
            className="sph-btn !px-2 !py-1"
            aria-label={showHeatmap ? '折叠热力图' : '展开热力图'}
            onClick={onToggleHeatmap}
          >
            {showHeatmap ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            <span>{showHeatmap ? '收起' : '展开'}</span>
          </button>
        </div>
      </div>

      {showHeatmap && (
        <div className="overflow-x-auto pb-1">
          <div className="inline-flex gap-[3px] min-w-full">
            {weeks.map((week, colIdx) => (
              <div key={colIdx} className="flex flex-col gap-[3px]">
                {week.map((day, rowIdx) => {
                  if (!day) {
                    return <div key={rowIdx} className="w-[11px] h-[11px]" />;
                  }
                  const label = `${day.date} · ${day.count} 个内容块${day.hasDiary ? ' · 已有日记' : ''}`;
                  return (
                    <button
                      key={day.date}
                      type="button"
                      aria-label={label}
                      title={label}
                      onClick={() => onClickDate(day.date)}
                      className="w-[11px] h-[11px] rounded-[2.5px] border-0 p-0 cursor-pointer transition-transform hover:scale-125"
                      style={{
                        backgroundColor: HEAT_COLORS[day.level],
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
