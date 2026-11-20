'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import AnalyticsCharts from '@/components/AnalyticsCharts';
import {
  Download,
  RefreshCw,
  AlertTriangle,
  Eye,
  Users,
  Heart,
  TrendingUp,
  FileSpreadsheet,
  Bot,
  Printer,
  Clock,
  Sparkles,
  ExternalLink,
  Search,
  ArrowUpDown,
} from 'lucide-react';
import { ConnectedAccount } from '@/lib/types';
import { cn, PLATFORM_CONFIGS } from '@/lib/utils';
import type { RealVideoMetric, TimelinePoint } from '@/app/api/analytics/route';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/shadcn/card';
import { Badge } from '@/components/ui/shadcn/badge';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Progress } from '@/components/ui/shadcn/progress';
import { useToast } from '@/components/ui';

interface PlatformBreakdownItem {
  id: string;
  platform: string;
  accountName: string;
  handle: string;
  isConnected: boolean;
  tokenStatus: string;
  followers: number;
  views: number;
  postsCount: number;
  sharePct: number;
}

interface BestHourItem {
  hourLabel: string;
  videosCount: number;
  avgViews: number;
  totalViews: number;
}

interface AnalyticsResponse {
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
  accounts: ConnectedAccount[];
  platformBreakdown?: PlatformBreakdownItem[];
  bestPostingHours?: BestHourItem[];
  aiExecutiveInsights?: string[];
  videos: RealVideoMetric[];
  timeline: TimelinePoint[];
  topicInsights: Array<{
    topic: string;
    videosCount: number;
    totalViews: number;
    avgViews: number;
    bestTimePkt: string;
    badge: string;
  }>;
}

function downloadBlob(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function AnalyticsPage() {
  const { pushToast } = useToast();
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'views' | 'engagement' | 'date'>('views');

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analytics');
      if (!res.ok) throw new Error('Failed to fetch analytics');
      const json = await res.json();
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleLiveRefresh = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/analytics', { method: 'POST' });
      const json = await res.json();
      if (json.summary) {
        setData(json);
        pushToast({
          type: 'success',
          title: 'Live Platform Analytics Synced',
          description: 'Fetched fresh metrics across connected social channels.',
        });
      }
    } catch {
      pushToast({
        type: 'error',
        title: 'Sync failed',
        description: 'Could not refresh live analytics.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredVideos = useMemo(() => {
    const list = data?.videos || [];
    const netFiltered =
      selectedNetwork === 'all'
        ? list
        : list.filter((v) => v.platform === selectedNetwork);

    const q = searchQuery.trim().toLowerCase();
    const searched = q
      ? netFiltered.filter((v) => v.title.toLowerCase().includes(q))
      : netFiltered;

    return [...searched].sort((a, b) => {
      if (sortBy === 'views') return b.views - a.views;
      if (sortBy === 'engagement') return b.engagementRate - a.engagementRate;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });
  }, [data, selectedNetwork, searchQuery, sortBy]);

  const handleExportExcelCsv = () => {
    if (!data) return;
    const rows: string[] = [];
    const esc = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    rows.push('SECTION,PLATFORM BREAKDOWN');
    rows.push('Platform,Account,Handle,Connected,Followers,Views,Posts,Audience Share %');
    for (const p of data.platformBreakdown || []) {
      rows.push(
        [
          esc(p.platform),
          esc(p.accountName),
          esc(p.handle),
          esc(p.isConnected ? 'Yes' : 'No'),
          p.followers,
          p.views,
          p.postsCount,
          p.sharePct,
        ].join(',')
      );
    }

    rows.push('');
    rows.push('SECTION,VIDEO PERFORMANCE');
    rows.push('Title,Platform,Published At,Views,Likes,Comments,Engagement %,Duration,URL');
    for (const v of filteredVideos) {
      rows.push(
        [
          esc(v.title),
          esc(v.platform),
          esc(v.publishedAt),
          v.views,
          v.likes,
          v.comments,
          v.engagementRate,
          esc(v.duration),
          esc(v.url),
        ].join(',')
      );
    }

    // UTF-8 BOM so Microsoft Excel opens Unicode/emojis cleanly
    downloadBlob(
      '\uFEFF' + rows.join('\n'),
      `zcodedev-analytics-${new Date().toISOString().slice(0, 10)}.csv`,
      'text/csv;charset=utf-8;'
    );
    pushToast({ type: 'success', title: 'Excel / CSV Report Downloaded' });
  };

  const handleExportAiMarkdown = () => {
    if (!data) return;
    const s = data.summary;
    const top10 = [...(data.videos || [])].sort((a, b) => b.views - a.views).slice(0, 10);
    const bottom5 = [...(data.videos || [])].sort((a, b) => a.views - b.views).slice(0, 5);

    const md = `# Social Media Deep Analytics Report (AI-Ready)
Generated: ${data.generatedAt || new Date().toISOString()}

> **Prompt for AI Assistant:** Analyze this creator's cross-platform performance below. Identify why the Top 10 videos outperformed, diagnose why the Bottom 5 underperformed, recommend exact title/hook templates, and build a 7-day posting schedule using the Best Posting Windows.

## 1. Executive Summary KPIs
- **Total Channel Views:** ${s.totalChannelViews.toLocaleString()}
- **Total Followers / Subscribers:** ${s.totalFollowers.toLocaleString()}
- **Total Channel Posts / Videos:** ${s.totalChannelPosts.toLocaleString()}
- **Total Likes:** ${(s.totalVideoLikes || 0).toLocaleString()}
- **Total Comments:** ${(s.totalVideoComments || 0).toLocaleString()}
- **Average Views / Video:** ${(s.avgViewsPerVideo || 0).toLocaleString()}
- **Top Video Views:** ${(s.topVideoViews || 0).toLocaleString()}
- **Overall Engagement Rate:** ${s.overallEngagementRate || 0}%

## 2. Platform Breakdown
| Platform | Account | Status | Followers | Views | Posts | Share % |
|---|---|---|---:|---:|---:|---:|
${(data.platformBreakdown || [])
  .map(
    (p) =>
      `| ${p.platform} | ${p.accountName} (${p.handle}) | ${p.isConnected ? 'Connected' : 'Disconnected'} | ${p.followers} | ${p.views} | ${p.postsCount} | ${p.sharePct}% |`
  )
  .join('\n')}

## 3. Best Posting Windows (PKT UTC+5)
${(data.bestPostingHours || [])
  .map((h) => `- **${h.hourLabel}**: ${h.avgViews.toLocaleString()} avg views (${h.videosCount} videos, ${h.totalViews.toLocaleString()} total views)`)
  .join('\n')}

## 4. Content Pillar Performance
${(data.topicInsights || [])
  .map((t) => `- **${t.topic}** (${t.badge}): ${t.videosCount} videos, ${t.totalViews.toLocaleString()} total views, ${t.avgViews.toLocaleString()} avg views | Best: ${t.bestTimePkt}`)
  .join('\n')}

## 5. Top 10 Best Performing Videos
${top10
  .map(
    (v, i) =>
      `${i + 1}. **${v.title}** — ${v.views.toLocaleString()} views, ${v.likes} likes, ${v.comments} comments (${v.engagementRate}% eng) | ${v.publishedAt.slice(0, 10)} | ${v.url}`
  )
  .join('\n')}

## 6. Bottom 5 Underperforming Videos (Optimization Candidates)
${bottom5
  .map(
    (v, i) =>
      `${i + 1}. **${v.title}** — ${v.views.toLocaleString()} views, ${v.likes} likes (${v.engagementRate}% eng) | ${v.publishedAt.slice(0, 10)}`
  )
  .join('\n')}
`;

    downloadBlob(
      md,
      `zcodedev-ai-analytics-report-${new Date().toISOString().slice(0, 10)}.md`,
      'text/markdown;charset=utf-8;'
    );
    pushToast({
      type: 'success',
      title: 'AI-Ready Report (.md) Downloaded',
      description: 'Upload or paste this file into ChatGPT, Claude, or Gemini for deep growth analysis.',
    });
  };

  const handlePrintPdf = () => {
    window.print();
  };

  if (loading && !data) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-surface-high animate-pulse" />
          ))}
        </div>
        <div className="h-72 rounded-2xl bg-surface-high animate-pulse" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <Card className="p-8 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-[#C84B4B] mx-auto" />
        <p className="text-sm font-semibold text-content-primary">{error}</p>
        <Button onClick={fetchAnalytics}>Retry</Button>
      </Card>
    );
  }

  const s = data?.summary;
  const connectedPlatforms = (data?.platformBreakdown || []).filter((p) => p.isConnected);

  return (
    <div className="space-y-6">
      {/* Stitch Editorial Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-brand text-xs font-semibold uppercase tracking-wider">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Performance Intelligence</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-normal text-content-primary tracking-tight">
            Analytics &amp; Insights
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary">
            Cross-platform reach, engagement trajectories, posting window heatmaps, and AI-ready reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLiveRefresh}
            disabled={isSyncing}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing APIs...' : 'Sync Live APIs'}</span>
          </Button>

          <Button type="button" variant="outline" size="sm" onClick={handleExportExcelCsv}>
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Excel / CSV</span>
          </Button>

          <Button type="button" variant="outline" size="sm" onClick={handleExportAiMarkdown}>
            <Bot className="w-3.5 h-3.5 text-brand" />
            <span>AI Report (.md)</span>
          </Button>

          <Button type="button" size="sm" onClick={handlePrintPdf}>
            <Printer className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </Button>
        </div>
      </div>

      {/* Network Filter Pills */}
      <div className="flex flex-wrap items-center gap-1.5 print:hidden">
        {['all', 'youtube', 'instagram', 'facebook', 'tiktok', 'twitter', 'threads'].map(
          (net) => {
            const active = selectedNetwork === net;
            const label =
              net === 'all' ? 'All Platforms' : PLATFORM_CONFIGS[net as keyof typeof PLATFORM_CONFIGS]?.name || net;
            return (
              <button
                key={net}
                type="button"
                onClick={() => setSelectedNetwork(net)}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all',
                  active
                    ? 'bg-brand text-brand-contrast border-brand shadow-soft'
                    : 'bg-surface-lowest text-content-secondary border-border hover:bg-surface-high hover:text-content-primary'
                )}
              >
                {label}
              </button>
            );
          }
        )}
      </div>

      {/* Row 1: 4 Stitch Editorial KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="p-6 rounded-2xl bg-surface-lowest border border-border shadow-card hover:shadow-elevated transition-all flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-content-secondary">
              Total Reach
            </span>
            <span className="w-8 h-8 rounded-lg bg-surface-low flex items-center justify-center text-brand">
              <Eye className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-3 gap-2">
            <span className="font-serif text-[2.25rem] leading-none font-medium text-content-primary tabular-nums">
              {(s?.totalChannelViews || 0).toLocaleString()}
            </span>
            <Badge variant="sage">Reach</Badge>
          </div>
          <div className="mt-3 flex items-end justify-between">
            <span className="text-xs text-content-muted">
              Avg {(s?.avgViewsPerVideo || 0).toLocaleString()}/video
            </span>
            <svg className="w-20 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 100 24">
              <path d="M0 18 L20 14 L40 16 L60 9 L80 11 L100 3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-surface-lowest border border-border shadow-card hover:shadow-elevated transition-all flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-content-secondary">
              Total Audience
            </span>
            <span className="w-8 h-8 rounded-lg bg-brand-container flex items-center justify-center text-brand">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-3 gap-2">
            <span className="font-serif text-[2.25rem] leading-none font-medium text-content-primary tabular-nums">
              {(s?.totalFollowers || 0).toLocaleString()}
            </span>
            <Badge variant="peach">{connectedPlatforms.length} Connected</Badge>
          </div>
          <p className="mt-3 text-xs text-content-muted">
            Total Audience Across Channels
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-surface-lowest border border-border shadow-card hover:shadow-elevated transition-all flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-content-secondary">
              Engagements
            </span>
            <span className="w-8 h-8 rounded-lg bg-surface-low flex items-center justify-center text-brand">
              <Heart className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-3 gap-2">
            <span className="font-serif text-[2.25rem] leading-none font-medium text-content-primary tabular-nums">
              {((s?.totalVideoLikes || 0) + (s?.totalVideoComments || 0)).toLocaleString()}
            </span>
            <Badge variant="sage">{s?.overallEngagementRate || 0}% Rate</Badge>
          </div>
          <p className="mt-3 text-xs text-content-muted">
            {(s?.totalVideoLikes || 0).toLocaleString()} Likes · {(s?.totalVideoComments || 0).toLocaleString()} Comments
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-surface-lowest border border-border shadow-card hover:shadow-elevated transition-all flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-content-secondary">
              Peak Video
            </span>
            <span className="w-8 h-8 rounded-lg bg-surface-low flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-3 gap-2">
            <span className="font-serif text-[2.25rem] leading-none font-medium text-content-primary tabular-nums">
              {(s?.topVideoViews || 0).toLocaleString()}
            </span>
            <Badge variant="lavender">Top Views</Badge>
          </div>
          <p className="mt-3 text-xs text-content-muted">
            {s?.totalChannelPosts || 0} Total Published Videos
          </p>
        </div>
      </section>

      {/* Row 2: Platform-by-Platform Breakdown + AI Executive Insights */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <Card className="lg:col-span-7 min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              Multi-Platform Breakdown
            </CardTitle>
            <CardDescription>
              Followers, views, posts, and audience share across every channel
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.platformBreakdown || []).map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-border-subtle bg-surface p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-content-primary capitalize">
                      {PLATFORM_CONFIGS[p.platform as keyof typeof PLATFORM_CONFIGS]?.name || p.platform}
                    </span>
                    <span className="text-[11px] text-content-muted truncate">
                      {p.handle || p.accountName}
                    </span>
                  </div>
                  <Badge variant={p.isConnected ? 'sage' : 'outline'} className="text-[10px]">
                    {p.isConnected ? 'Connected' : 'Not Connected'}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-content-muted text-[10px] block">Followers</span>
                    <span className="font-semibold text-content-primary tabular-nums">
                      {p.followers.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-content-muted text-[10px] block">Views / Likes</span>
                    <span className="font-semibold text-content-primary tabular-nums">
                      {p.views.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-content-muted text-[10px] block">Posts</span>
                    <span className="font-semibold text-content-primary tabular-nums">
                      {p.postsCount.toLocaleString()}
                    </span>
                  </div>
                </div>
                <Progress value={p.sharePct} indicatorColor="#C27345" />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="lg:col-span-5 space-y-5 min-w-0">
          {/* AI Executive Insights */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#C27345]" />
                AI Executive Summary
              </CardTitle>
              <CardDescription>
                Actionable takeaways computed from your live channel data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {(data?.aiExecutiveInsights || []).map((line, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-border-subtle bg-surface px-3.5 py-2.5 text-xs text-content-primary leading-relaxed"
                >
                  {line}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Best Posting Hours */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#C27345]" />
                Best Posting Windows (PKT)
              </CardTitle>
              <CardDescription>
                Hours with highest average views per video
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {(data?.bestPostingHours || []).map((h) => (
                <div
                  key={h.hourLabel}
                  className="flex items-center justify-between text-xs rounded-lg border border-border-subtle bg-surface px-3 py-2"
                >
                  <span className="font-semibold text-content-primary">{h.hourLabel}</span>
                  <span className="text-content-muted">
                    {h.avgViews.toLocaleString()} avg views ({h.videosCount} vids)
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Row 3: Charts & Topic Insights */}
      {data && (
        <AnalyticsCharts
          summary={data.summary}
          accounts={data.accounts}
          videos={filteredVideos}
          timeline={data.timeline}
          topicInsights={data.topicInsights}
        />
      )}

      {/* Row 4: Full Video & Post Performance Table */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-sm font-semibold">
              Detailed Video Performance ({filteredVideos.length})
            </CardTitle>
            <CardDescription>
              Full per-video views, likes, comments, and engagement rate
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <div className="relative w-52">
              <Search className="w-3.5 h-3.5 text-content-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter videos..."
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setSortBy((prev) =>
                  prev === 'views' ? 'engagement' : prev === 'engagement' ? 'date' : 'views'
                )
              }
              className="text-xs h-8"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span className="capitalize">Sort: {sortBy}</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-content-muted">
                <th className="py-2.5 pr-3 font-semibold">Video</th>
                <th className="py-2.5 px-3 font-semibold">Published</th>
                <th className="py-2.5 px-3 font-semibold text-right">Views</th>
                <th className="py-2.5 px-3 font-semibold text-right">Likes</th>
                <th className="py-2.5 px-3 font-semibold text-right">Comments</th>
                <th className="py-2.5 px-3 font-semibold text-right">Eng %</th>
                <th className="py-2.5 pl-3 font-semibold text-right print:hidden">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE9E1]">
              {filteredVideos.slice(0, 50).map((v) => (
                <tr key={v.id} className="hover:bg-surface">
                  <td className="py-2.5 pr-3 max-w-[320px]">
                    <div className="flex items-center gap-2.5">
                      {v.thumbnailUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={v.thumbnailUrl}
                          alt={v.title}
                          className="w-12 h-8 rounded object-cover flex-shrink-0 border border-border"
                        />
                      )}
                      <span className="font-medium text-content-primary line-clamp-2">
                        {v.title}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-content-muted whitespace-nowrap">
                    {v.publishedAt?.slice(0, 10)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold text-content-primary tabular-nums">
                    {v.views.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right text-content-secondary tabular-nums">
                    {v.likes.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right text-content-secondary tabular-nums">
                    {v.comments.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <Badge variant="sage" className="text-[10px] tabular-nums">
                      {v.engagementRate}%
                    </Badge>
                  </td>
                  <td className="py-2.5 pl-3 text-right print:hidden">
                    <a
                      href={v.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[#C27345] hover:underline font-medium"
                    >
                      Open
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
