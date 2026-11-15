'use client';

import { useMemo, useState } from 'react';
import { TrendingUp, BarChart2 } from 'lucide-react';
import type { TimelinePoint } from '@/app/api/analytics/route';
import { Card, CardHeader } from './ui/Card';
import { SegmentedTabs } from './ui/Tabs';
import { EmptyState } from './ui/EmptyState';

export type EvolutionMetric = 'views' | 'likes' | 'engagement' | 'videosCount';

interface ChartPoint {
  x: number;
  y: number;
  val: number;
  engagement: number;
  pt: TimelinePoint;
}

function formatAxisVal(val: number, isPercent = false): string {
  if (isPercent) return `${val.toFixed(1)}%`;
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
  return String(Math.round(val));
}

function buildSmoothPath(points: ChartPoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export default function GrowthEvolutionChart({
  timeline = [],
  title = 'Audience & Video Growth Evolution',
  subtitle = 'Chronological performance over real published content',
}: {
  timeline?: TimelinePoint[];
  title?: string;
  subtitle?: string;
}) {
  const [chartMetric, setChartMetric] = useState<EvolutionMetric>('views');
  const [rangeLimit, setRangeLimit] = useState<'15' | '30' | 'all'>('30');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const visibleTimeline = useMemo(() => {
    if (!timeline || timeline.length === 0) return [];
    if (rangeLimit === '15') return timeline.slice(-15);
    if (rangeLimit === '30') return timeline.slice(-30);
    return timeline;
  }, [timeline, rangeLimit]);

  const maxChartVal = useMemo(() => {
    if (!visibleTimeline.length) return 1;
    if (chartMetric === 'engagement') {
      const highest = Math.max(
        ...visibleTimeline.map((pt) =>
          pt.views > 0 ? ((pt.likes + pt.comments) / pt.views) * 100 : 0
        )
      );
      return Math.max(highest * 1.15, 5);
    }
    const highest = Math.max(
      ...visibleTimeline.map((pt) => pt[chartMetric] || 0)
    );
    return Math.max(highest * 1.15, 10);
  }, [visibleTimeline, chartMetric]);

  const chartWidth = 900;
  const chartHeight = 260;
  const padLeft = 56;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 38;

  const usableW = chartWidth - padLeft - padRight;
  const usableH = chartHeight - padTop - padBottom;

  const chartPoints = useMemo<ChartPoint[]>(() => {
    if (!visibleTimeline.length) return [];
    return visibleTimeline.map((pt, i) => {
      const x =
        visibleTimeline.length === 1
          ? padLeft + usableW / 2
          : padLeft + (i / (visibleTimeline.length - 1)) * usableW;
      const engagement =
        pt.views > 0 ? Number((((pt.likes + pt.comments) / pt.views) * 100).toFixed(2)) : 0;
      const val =
        chartMetric === 'engagement' ? engagement : pt[chartMetric] || 0;
      const clampedY = Math.max(
        padTop,
        Math.min(padTop + usableH, padTop + usableH - (val / maxChartVal) * usableH)
      );
      return { x, y: clampedY, val, engagement, pt };
    });
  }, [visibleTimeline, chartMetric, maxChartVal, usableW, usableH]);

  const linePath = useMemo(() => buildSmoothPath(chartPoints), [chartPoints]);

  const areaPath = useMemo(() => {
    if (!chartPoints.length) return '';
    const first = chartPoints[0];
    const last = chartPoints[chartPoints.length - 1];
    const baseLine = padTop + usableH;
    return `${linePath} L ${last.x.toFixed(1)} ${baseLine} L ${first.x.toFixed(1)} ${baseLine} Z`;
  }, [chartPoints, linePath, usableH]);

  const activePoint =
    hoveredIdx !== null && chartPoints[hoveredIdx]
      ? chartPoints[hoveredIdx]
      : chartPoints[chartPoints.length - 1] || null;

  const metricLabel =
    chartMetric === 'views'
      ? 'Video Views'
      : chartMetric === 'likes'
      ? 'Likes'
      : chartMetric === 'engagement'
      ? 'Engagement Rate (%)'
      : 'Uploads';

  const strokeColor =
    chartMetric === 'likes'
      ? '#10B981'
      : chartMetric === 'engagement'
      ? '#596CF2'
      : chartMetric === 'videosCount'
      ? '#F59E0B'
      : '#00D2B4'; // Metricool Teal

  return (
    <Card className="space-y-4">
      <CardHeader
        icon={<TrendingUp className="w-4 h-4 text-[#00D2B4]" />}
        title={title}
        subtitle={subtitle}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <SegmentedTabs
              size="xs"
              value={chartMetric}
              onChange={setChartMetric}
              items={[
                { id: 'views', label: 'Views' },
                { id: 'likes', label: 'Likes' },
                { id: 'engagement', label: 'Engagement' },
                { id: 'videosCount', label: 'Uploads' },
              ]}
            />
            <SegmentedTabs
              size="xs"
              value={rangeLimit}
              onChange={setRangeLimit}
              items={[
                { id: '15', label: '15 pts' },
                { id: '30', label: '30 pts' },
                { id: 'all', label: 'All' },
              ]}
            />
          </div>
        }
      />

      {chartPoints.length === 0 ? (
        <EmptyState
          icon={<BarChart2 className="w-5 h-5" />}
          title="No timeline points available"
          description="Connect a YouTube channel or sync live analytics to inspect chronological performance."
        />
      ) : (
        <>
          {/* Legend + Active Point Inspector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: strokeColor }}
              />
              <span className="text-[11px] font-semibold text-slate-500 flex-shrink-0">
                {metricLabel}
              </span>
              {activePoint && (
                <>
                  <span className="text-[#4E463F]">•</span>
                  <span className="px-1.5 py-0.5 rounded bg-[#FFFFFF] border border-slate-200 font-mono text-[11px] font-bold text-slate-800 flex-shrink-0">
                    {activePoint.pt.date}
                  </span>
                  <span className="text-xs font-semibold text-slate-800 truncate">
                    {activePoint.pt.topTitle}
                  </span>
                </>
              )}
            </div>

            {activePoint && (
              <div className="flex items-center gap-3.5 text-xs font-mono tabular-nums flex-shrink-0">
                <span className="text-slate-900 font-bold">
                  {activePoint.pt.views.toLocaleString()}{' '}
                  <span className="text-[#6E655D] font-normal">views</span>
                </span>
                <span className="text-emerald-600 font-bold">
                  {activePoint.pt.likes}{' '}
                  <span className="text-[#6E655D] font-normal">likes</span>
                </span>
                <span className="text-[#596CF2] font-bold">
                  {activePoint.engagement}%
                </span>
              </div>
            )}
          </div>

          {/* Smooth Responsive SVG Chart */}
          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-52 sm:h-64 select-none overflow-visible"
            >
              <defs>
                <linearGradient id="metricoolEvolutionGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={strokeColor} stopOpacity="0.22" />
                  <stop offset="90%" stopColor={strokeColor} stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = padTop + usableH * (1 - ratio);
                const val = maxChartVal * ratio;
                return (
                  <g key={ratio}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={chartWidth - padRight}
                      y2={y}
                      stroke="#E2E8F0"
                      strokeWidth="1"
                      strokeDasharray={ratio === 0 ? undefined : '3 3'}
                    />
                    <text
                      x={padLeft - 8}
                      y={y + 3}
                      textAnchor="end"
                      fontSize="10"
                      fill="#94A3B8"
                      fontFamily="monospace"
                    >
                      {formatAxisVal(val, chartMetric === 'engagement')}
                    </text>
                  </g>
                );
              })}

              {/* Area Fill */}
              {areaPath && (
                <path d={areaPath} fill="url(#metricoolEvolutionGrad)" />
              )}

              {/* Line Curve */}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Hover / Data Points */}
              {chartPoints.map((pt, i) => {
                const isHovered = hoveredIdx === i;
                const isSelected = activePoint?.x === pt.x;
                return (
                  <g
                    key={i}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    {/* Hit area */}
                    <rect
                      x={pt.x - usableW / (chartPoints.length * 2)}
                      y={padTop}
                      width={usableW / chartPoints.length}
                      height={usableH + padBottom}
                      fill="transparent"
                    />

                    {/* Active vertical guide line */}
                    {(isHovered || isSelected) && (
                      <line
                        x1={pt.x}
                        y1={padTop}
                        x2={pt.x}
                        y2={padTop + usableH}
                        stroke={strokeColor}
                        strokeWidth="1"
                        strokeDasharray="2 2"
                        opacity="0.6"
                      />
                    )}

                    {/* Circle Node */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 5.5 : isSelected ? 4 : 2.5}
                      fill={isHovered || isSelected ? '#FFFFFF' : strokeColor}
                      stroke={strokeColor}
                      strokeWidth={isHovered || isSelected ? 2.5 : 1}
                    />

                    {/* Date label at bottom */}
                    {(i === 0 ||
                      i === chartPoints.length - 1 ||
                      (chartPoints.length > 10 && i % Math.floor(chartPoints.length / 5) === 0)) && (
                      <text
                        x={pt.x}
                        y={chartHeight - 8}
                        textAnchor="middle"
                        fontSize="9.5"
                        fill="#94A3B8"
                        fontFamily="monospace"
                      >
                        {pt.pt.date.slice(5)}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </>
      )}
    </Card>
  );
}
