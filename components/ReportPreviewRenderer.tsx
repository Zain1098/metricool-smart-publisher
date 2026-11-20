'use client';

import React from 'react';
import {
  Eye,
  Users,
  Heart,
  TrendingUp,
  Clock,
  Sparkles,
  ExternalLink,
  FileSpreadsheet,
  Printer,
} from 'lucide-react';
import GrowthEvolutionChart from '@/components/GrowthEvolutionChart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/shadcn/card';
import { Badge } from '@/components/ui/shadcn/badge';
import { Button } from '@/components/ui/shadcn/button';
import type { CustomReport } from '@/lib/reports-store';

export interface ReportAnalyticsPayload {
  generatedAt?: string;
  summary: {
    totalFollowers: number;
    totalChannelViews: number;
    totalChannelPosts: number;
    totalVideoLikes?: number;
    totalVideoComments?: number;
    avgViewsPerVideo?: number;
    topVideoViews?: number;
    overallEngagementRate?: number;
    publishedPostsCount: number;
    scheduledPostsCount: number;
  };
  platformBreakdown?: Array<{
    id: string;
    platform: string;
    accountName: string;
    handle: string;
    isConnected: boolean;
    followers: number;
    views: number;
    postsCount: number;
    sharePct: number;
  }>;
  videos: Array<{
    id: string;
    platform: string;
    title: string;
    publishedAt: string;
    thumbnailUrl: string;
    views: number;
    likes: number;
    comments: number;
    duration: string;
    url: string;
    engagementRate: number;
  }>;
  timeline: Array<{
    date: string;
    label: string;
    views: number;
    likes: number;
    comments: number;
    videosCount: number;
    topTitle: string;
  }>;
  topicInsights: Array<{
    topic: string;
    videosCount: number;
    totalViews: number;
    avgViews: number;
    bestTimePkt: string;
    badge: string;
  }>;
}

export function exportReportCsv(report: CustomReport, analytics: ReportAnalyticsPayload) {
  const rows: string[] = [
    ['Report Title', report.title].join(','),
    ['Brand', report.brandName].join(','),
    ['Date Range', report.dateRangeLabel].join(','),
    ['Generated At', new Date().toISOString()].join(','),
    '',
    'Video Title,Platform,Published,Views,Likes,Comments,Engagement %',
    ...analytics.videos.slice(0, 100).map((v) =>
      [
        `"${(v.title || '').replace(/"/g, '""')}"`,
        v.platform,
        v.publishedAt?.slice(0, 10) || '',
        v.views,
        v.likes,
        v.comments,
        v.engagementRate,
      ].join(',')
    ),
  ];

  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${report.brandName.toLowerCase().replace(/\s+/g, '-')}-report.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ReportPreviewRenderer({
  report,
  analytics,
  showExportBar = true,
}: {
  report: CustomReport;
  analytics: ReportAnalyticsPayload;
  showExportBar?: boolean;
}) {
  const enabledBlocks = report.blocks.filter((b) => b.enabled);
  const summary = analytics.summary;

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Report Header Banner */}
      <div
        className="rounded-2xl border border-border bg-surface-card p-6 md:p-8 shadow-sm"
        style={{ borderTopWidth: '4px', borderTopColor: report.accentColor || '#C27345' }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="sage" className="text-[11px]">
                {report.brandName}
              </Badge>
              <span className="text-xs text-content-muted">• {report.dateRangeLabel}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-content-primary tracking-tight">
              {report.title}
            </h1>
            <p className="text-xs text-content-muted mt-1">
              Generated {new Date(analytics.generatedAt || Date.now()).toLocaleString()} • Live Analytics Snapshot
            </p>
          </div>
          {showExportBar && (
            <div className="flex items-center gap-2 print:hidden">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => exportReportCsv(report, analytics)}
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export CSV
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => window.print()}
                style={{ backgroundColor: report.accentColor || '#C27345' }}
                className="text-white hover:opacity-90"
              >
                <Printer className="w-4 h-4" />
                Print / PDF
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Rendered Blocks */}
      {enabledBlocks.map((block) => {
        if (block.type === 'kpi_summary') {
          return (
            <div key={block.id} className="space-y-3">
              <h2 className="text-sm font-semibold text-content-secondary uppercase tracking-wider">
                {block.title}
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between text-content-muted text-xs mb-1">
                      <span>Total Followers</span>
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="text-2xl font-bold tabular-nums">
                      {summary.totalFollowers.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between text-content-muted text-xs mb-1">
                      <span>Total Views</span>
                      <Eye className="w-4 h-4" />
                    </div>
                    <div className="text-2xl font-bold tabular-nums">
                      {summary.totalChannelViews.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between text-content-muted text-xs mb-1">
                      <span>Total Likes</span>
                      <Heart className="w-4 h-4" />
                    </div>
                    <div className="text-2xl font-bold tabular-nums">
                      {(summary.totalVideoLikes || 0).toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between text-content-muted text-xs mb-1">
                      <span>Engagement Rate</span>
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div className="text-2xl font-bold tabular-nums">
                      {summary.overallEngagementRate ?? 0}%
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          );
        }

        if (block.type === 'platform_breakdown') {
          const connected = (analytics.platformBreakdown || []).filter((p) => p.isConnected);
          return (
            <Card key={block.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{block.title}</CardTitle>
                <CardDescription>Audience, posts, and view distribution across connected channels</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {connected.map((p) => (
                    <div key={p.id} className="rounded-xl border border-border p-4 bg-surface">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold capitalize text-sm">{p.platform}</span>
                        <Badge variant="outline" className="text-[11px]">{p.sharePct}% share</Badge>
                      </div>
                      <p className="text-xs text-content-muted mb-3">{p.accountName} ({p.handle})</p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="text-content-muted">Followers</div>
                          <div className="font-semibold tabular-nums">{p.followers.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-content-muted">Views</div>
                          <div className="font-semibold tabular-nums">{p.views.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-content-muted">Posts</div>
                          <div className="font-semibold tabular-nums">{p.postsCount.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        }

        if (block.type === 'growth_timeline') {
          return (
            <Card key={block.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{block.title}</CardTitle>
                <CardDescription>Daily video views and engagement trend</CardDescription>
              </CardHeader>
              <CardContent>
                <GrowthEvolutionChart timeline={analytics.timeline as any} />
              </CardContent>
            </Card>
          );
        }

        if (block.type === 'top_videos') {
          const top = [...analytics.videos].sort((a, b) => b.views - a.views).slice(0, 10);
          return (
            <Card key={block.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{block.title}</CardTitle>
                <CardDescription>Top 10 performing videos by total views</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border text-content-muted">
                      <th className="py-2 pr-3 font-semibold">Video</th>
                      <th className="py-2 px-3 font-semibold">Published</th>
                      <th className="py-2 px-3 font-semibold text-right">Views</th>
                      <th className="py-2 px-3 font-semibold text-right">Likes</th>
                      <th className="py-2 px-3 font-semibold text-right">Eng %</th>
                      <th className="py-2 pl-3 font-semibold text-right print:hidden">Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {top.map((v) => (
                      <tr key={v.id}>
                        <td className="py-2 pr-3 font-medium max-w-[300px] truncate">{v.title}</td>
                        <td className="py-2 px-3 text-content-muted whitespace-nowrap">{v.publishedAt?.slice(0, 10)}</td>
                        <td className="py-2 px-3 text-right font-semibold tabular-nums">{v.views.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{v.likes.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{v.engagementRate}%</td>
                        <td className="py-2 pl-3 text-right print:hidden">
                          <a href={v.url} target="_blank" rel="noreferrer" className="text-brand hover:underline inline-flex items-center gap-1">
                            View <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          );
        }

        if (block.type === 'topic_insights') {
          return (
            <Card key={block.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand" />
                  {block.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {analytics.topicInsights.map((t) => (
                    <div key={t.topic} className="rounded-xl border border-border p-4 bg-surface">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm">{t.topic}</span>
                        <Badge variant="sage" className="text-[10px]">{t.badge}</Badge>
                      </div>
                      <div className="text-xs text-content-muted flex items-center gap-1 mb-2">
                        <Clock className="w-3 h-3" /> {t.bestTimePkt}
                      </div>
                      <div className="text-xs">
                        Avg <strong>{t.avgViews.toLocaleString()}</strong> views ({t.videosCount} videos)
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        }

        if (block.type === 'executive_notes') {
          return (
            <Card key={block.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{block.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-content-secondary whitespace-pre-wrap leading-relaxed">
                  {block.notes || 'No executive notes added yet.'}
                </p>
              </CardContent>
            </Card>
          );
        }

        return null;
      })}
    </div>
  );
}
