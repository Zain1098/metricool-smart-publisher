'use client';

import { useEffect, useState, useCallback } from 'react';
import AnalyticsCharts from '@/components/AnalyticsCharts';
import {
  Download,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { ConnectedAccount } from '@/lib/types';
import { cn, PLATFORM_CONFIGS } from '@/lib/utils';
import type { RealVideoMetric, TimelinePoint } from '@/app/api/analytics/route';
import {
  Button,
  PlatformBadge,
  KpiGridSkeleton,
  ChartSkeleton,
  TableSkeleton,
  useToast,
} from '@/components/ui';

interface AnalyticsResponse {
  summary: {
    totalFollowers: number;
    totalChannelViews: number;
    totalChannelPosts: number;
    totalVideoLikes?: number;
    totalVideoComments?: number;
    avgViewsPerVideo?: number;
    topVideoViews?: number;
    publishedPostsCount: number;
    scheduledPostsCount: number;
  };
  accounts: ConnectedAccount[];
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

export default function AnalyticsPage() {
  const { pushToast } = useToast();
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<'all' | string>('all');

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analytics');
      if (!res.ok) throw new Error('Failed to fetch analytics');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err?.message || 'Failed to load analytics');
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
          title: 'Analytics refreshed',
          description: 'Latest real channel metrics and video insights loaded.',
        });
      }
    } catch {
      pushToast({
        type: 'error',
        title: 'Refresh failed',
        description: 'Could not reach analytics endpoint.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportCSV = () => {
    if (!data) return;

    const rows: (string | number)[][] = [
      ['Metricool Live Analytics Report'],
      ['Generated At', new Date().toISOString()],
      ['Total Followers', data.summary.totalFollowers],
      ['Total Views', data.summary.totalChannelViews],
      ['Total Posts', data.summary.totalChannelPosts],
      [],
      [
        'Video ID',
        'Title',
        'Published Date',
        'Duration',
        'Views',
        'Likes',
        'Comments',
        'Engagement %',
        'URL',
      ],
    ];

    for (const v of data.videos || []) {
      rows.push([
        v.id,
        `"${v.title.replace(/"/g, '""')}"`,
        v.publishedAt.slice(0, 10),
        v.duration,
        v.views,
        v.likes,
        v.comments,
        v.engagementRate,
        v.url,
      ]);
    }

    const csvContent =
      'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `metricool-analytics-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccess(true);
    pushToast({
      type: 'success',
      title: 'CSV report downloaded',
      description: `Exported ${data.videos?.length || 0} real video metrics.`,
    });
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  const connectedAccounts = (data?.accounts || []).filter((a) => a.isConnected);

  return (
    <div className="space-y-5">
      {/* Page Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] shadow-card">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">
            Performance &amp; Audience Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cross-platform data, follower growth, and video performance metrics
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600">
            <CalendarIcon className="w-3.5 h-3.5 text-[#00D2B4]" />
            <span>Last 30 Days</span>
          </div>

          <Button
            variant="secondary"
            size="sm"
            loading={isSyncing}
            onClick={handleLiveRefresh}
            icon={<RefreshCw className="w-3.5 h-3.5 text-[#00D2B4]" />}
          >
            Sync YouTube API
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCSV}
            disabled={!data}
            icon={
              downloadSuccess ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Download className="w-3.5 h-3.5 text-slate-500" />
              )
            }
          >
            {downloadSuccess ? 'Exported' : 'Export CSV'}
          </Button>
        </div>
      </div>

      {/* Network Filter Strip */}
      {data?.accounts && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedNetwork('all')}
            className={cn(
              'h-8 px-3.5 rounded-lg text-xs font-bold border transition-all shadow-xs',
              selectedNetwork === 'all'
                ? 'bg-[#00D2B4] text-[#0D1525] border-[#00D2B4]'
                : 'bg-[#FFFFFF] text-slate-700 border-slate-200 hover:bg-slate-50'
            )}
          >
            All Connected ({connectedAccounts.length})
          </button>

          {connectedAccounts.map((acc) => {
            const cfg = PLATFORM_CONFIGS[acc.platform];
            if (!cfg) return null;
            const active = selectedNetwork === acc.platform;
            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => setSelectedNetwork(acc.platform)}
                className={cn(
                  'h-8 px-3 rounded-lg text-xs font-bold border flex items-center gap-2 transition-all shadow-xs',
                  active
                    ? 'bg-[#E6FAF7] text-[#00A38C] border-[#00D2B4]'
                    : 'bg-[#FFFFFF] text-slate-700 border-slate-200 hover:bg-slate-50'
                )}
              >
                <PlatformBadge platform={acc.platform} size="xs" />
                <span>{cfg.name}</span>
                <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                  {acc.handle}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between gap-3 text-xs text-red-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <Button size="xs" variant="secondary" onClick={fetchAnalytics}>
            Retry
          </Button>
        </div>
      )}

      {/* Loading Skeletons */}
      {loading && !data && (
        <div className="space-y-4">
          <KpiGridSkeleton count={4} />
          <ChartSkeleton />
          <TableSkeleton rows={8} />
        </div>
      )}

      {/* Main Charts & Video Tables */}
      {data && (
        <AnalyticsCharts
          summary={data.summary}
          accounts={data.accounts || []}
          videos={data.videos || []}
          timeline={data.timeline || []}
          topicInsights={data.topicInsights || []}
          selectedNetwork={selectedNetwork}
        />
      )}
    </div>
  );
}
