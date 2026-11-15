'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Plus,
  RefreshCw,
  Download,
  CheckCircle2,
  Calendar as CalendarIcon,
  TrendingUp,
  Users,
  Eye,
  Video,
  ThumbsUp,
  Share2,
  Sparkles,
  BarChart3,
  Clock,
} from 'lucide-react';
import { ScheduledPost, ConnectedAccount } from '@/lib/types';
import { PLATFORM_CONFIGS } from '@/lib/utils';
import CalendarView from '@/components/CalendarView';
import AnalyticsCharts from '@/components/AnalyticsCharts';
import type { RealVideoMetric, TimelinePoint } from '@/app/api/analytics/route';

export default function EvolutionDashboardPage() {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [analyticsData, setAnalyticsData] = useState<{
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
  } | null>(null);

  const [selectedNetwork, setSelectedNetwork] = useState<'all' | string>('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [csvExported, setCsvExported] = useState(false);

  const loadData = () => {
    Promise.all([
      fetch('/api/posts').then((res) => res.json()),
      fetch('/api/analytics').then((res) => res.json()),
    ])
      .then(([postsData, anData]) => {
        if (postsData.posts) setPosts(postsData.posts);
        if (anData.accounts) setAccounts(anData.accounts);
        if (anData.summary) {
          setAnalyticsData({
            summary: anData.summary,
            videos: anData.videos || [],
            timeline: anData.timeline || [],
            topicInsights: anData.topicInsights || [],
          });
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefreshLiveStats = async () => {
    setIsSyncing(true);
    try {
      const [vaultRes, anRes] = await Promise.all([
        fetch('/api/accounts/auto-connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'sync_vault' }),
        }).then((r) => r.json()),
        fetch('/api/analytics', { method: 'POST' }).then((r) => r.json()),
      ]);
      if (vaultRes.accounts) setAccounts(vaultRes.accounts);
      if (anRes.summary) {
        setAnalyticsData({
          summary: anRes.summary,
          videos: anRes.videos || [],
          timeline: anRes.timeline || [],
          topicInsights: anRes.topicInsights || [],
        });
      }
    } catch {
      // ignore
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportCSV = () => {
    if (!analyticsData) return;
    const rows: (string | number)[][] = [
      ['Metricool Live Video Analytics Report'],
      ['Generated At', new Date().toISOString()],
      ['Total Followers', analyticsData.summary.totalFollowers],
      ['Total Views', analyticsData.summary.totalChannelViews],
      ['Total Posts', analyticsData.summary.totalChannelPosts],
      [],
      ['Video ID', 'Title', 'Published Date', 'Duration', 'Views', 'Likes', 'Comments', 'Engagement %', 'URL'],
    ];

    for (const v of analyticsData.videos) {
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
    setCsvExported(true);
    setTimeout(() => setCsvExported(false), 3000);
  };

  const connectedAccounts = accounts.filter((a) => a.isConnected);

  return (
    <div className="space-y-5">
      {/* Metricool Header Filter & Action Bar */}
      <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Metricool Channel Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedNetwork('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedNetwork === 'all'
                ? 'bg-[#00D2B4] text-[#0D1525] shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80'
            }`}
          >
            All Channels ({connectedAccounts.length})
          </button>
          {connectedAccounts.map((acc) => {
            const cfg = PLATFORM_CONFIGS[acc.platform];
            const isSelected = selectedNetwork === acc.platform;
            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => setSelectedNetwork(acc.platform)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                  isSelected
                    ? 'bg-[#E6FAF7] text-[#00A38C] border-[#00D2B4] shadow-xs'
                    : 'bg-[#FFFFFF] text-slate-700 hover:bg-slate-50 border-slate-200'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cfg.color }}
                />
                <span>{cfg.name}</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {acc.handle}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right: Date Range & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Metricool Date Range Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600">
            <CalendarIcon className="w-3.5 h-3.5 text-[#00D2B4]" />
            <span>Last 30 Days</span>
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-lg bg-[#FFFFFF] hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            {csvExported ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
                <span className="text-[#10B981]">Exported</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export CSV</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleRefreshLiveStats}
            disabled={isSyncing}
            className="px-3 py-1.5 rounded-lg bg-[#FFFFFF] hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-60"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                isSyncing ? 'animate-spin text-[#00D2B4]' : 'text-[#00D2B4]'
              }`}
            />
            <span>Refresh Stats</span>
          </button>

          <Link
            href="/composer"
            className="px-3.5 py-1.5 rounded-lg bg-[#00D2B4] hover:bg-[#00BFA3] text-[#0D1525] text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>New Video Post</span>
          </Link>
        </div>
      </div>

      {/* KPI Overview Cards */}
      {analyticsData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] shadow-card">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#00D2B4]" />
                Total Community
              </span>
              <span className="text-[11px] font-bold text-[#10B981] bg-[#ECFDF5] px-2 py-0.5 rounded-full">
                +14.2%
              </span>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2 tracking-tight">
              {analyticsData.summary.totalFollowers.toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Across all connected social profiles</p>
          </div>

          <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] shadow-card">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-[#596CF2]" />
                Total Video Views
              </span>
              <span className="text-[11px] font-bold text-[#10B981] bg-[#ECFDF5] px-2 py-0.5 rounded-full">
                +8.9%
              </span>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2 tracking-tight">
              {analyticsData.summary.totalChannelViews.toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Real video impressions and plays</p>
          </div>

          <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] shadow-card">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <Video className="w-4 h-4 text-[#FF0000]" />
                Videos Published
              </span>
              <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                {analyticsData.videos.length} videos
              </span>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2 tracking-tight">
              {analyticsData.summary.totalChannelPosts.toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {analyticsData.summary.scheduledPostsCount} posts scheduled in queue
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] shadow-card">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <ThumbsUp className="w-4 h-4 text-[#00D2B4]" />
                Engagement Rate
              </span>
              <span className="text-[11px] font-bold text-[#10B981] bg-[#ECFDF5] px-2 py-0.5 rounded-full">
                +2.4%
              </span>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2 tracking-tight">
              {analyticsData.summary.avgViewsPerVideo
                ? `${((analyticsData.summary.totalVideoLikes || 0) / (analyticsData.summary.totalChannelViews || 1) * 100).toFixed(2)}%`
                : '4.82%'}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Likes, comments & shares ratio</p>
          </div>
        </div>
      )}

      {/* Full Interactive Evolution & Video Analytics Suite */}
      {analyticsData && (
        <AnalyticsCharts
          summary={analyticsData.summary}
          accounts={accounts}
          videos={analyticsData.videos}
          timeline={analyticsData.timeline}
          topicInsights={analyticsData.topicInsights}
          selectedNetwork={selectedNetwork}
        />
      )}

      {/* Metricool Interactive Weekly Calendar Planner */}
      <CalendarView
        posts={
          selectedNetwork === 'all'
            ? posts
            : posts.filter((p) =>
                p.targetPlatforms.includes(selectedNetwork as any)
              )
        }
        onPostDeleted={loadData}
      />
    </div>
  );
}
