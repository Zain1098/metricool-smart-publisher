'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Send,
  Calendar as CalendarIcon,
  CheckCircle2,
  Eye,
  ArrowUpRight,
  Plus,
  Clock,
  Sparkles,
  TrendingUp,
  Layers,
  Link2,
  Zap,
  Users,
  AlarmClock,
  Edit3,
  BarChart2,
  Brain,
  PenTool,
  Youtube,
  Instagram,
  Facebook,
  Linkedin,
  Video,
  Share2,
} from 'lucide-react';
import { ConnectedAccount, ScheduledPost, SocialPlatform } from '@/lib/types';
import { PLATFORM_CONFIGS } from '@/lib/utils';
import type { RealVideoMetric, TimelinePoint } from '@/app/api/analytics/route';
import { Badge } from '@/components/ui/shadcn/badge';
import { Button } from '@/components/ui/shadcn/button';
import { Progress } from '@/components/ui/shadcn/progress';

const PLATFORM_BAR_COLORS: Record<string, string> = {
  youtube: '#FF0000',
  instagram: '#E1306C',
  facebook: '#1877F2',
  tiktok: '#201A17',
  twitter: '#4B5563',
  threads: '#6B5CE7',
  linkedin: '#0A66C2',
  pinterest: '#BD081C',
};

const TOPIC_COLORS = ['#C27345', '#2E7D66', '#D99B26', '#6B5CE7', '#C84E89', '#1E8FA3'];

function PlatformMiniIcon({ platform }: { platform: SocialPlatform }) {
  switch (platform) {
    case 'youtube':
      return <Youtube className="w-4 h-4 text-[#FF0000]" />;
    case 'instagram':
      return <Instagram className="w-4 h-4 text-[#E1306C]" />;
    case 'facebook':
      return <Facebook className="w-4 h-4 text-[#1877F2]" />;
    case 'linkedin':
      return <Linkedin className="w-4 h-4 text-[#0A66C2]" />;
    case 'tiktok':
      return <Video className="w-4 h-4 text-content-primary" />;
    default:
      return <Share2 className="w-4 h-4 text-brand" />;
  }
}

export default function DashboardPage() {
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/posts').then((r) => r.json()),
      fetch('/api/analytics').then((r) => r.json()),
    ])
      .then(([postsRes, analyticsRes]) => {
        if (Array.isArray(postsRes?.posts)) setPosts(postsRes.posts);
        if (Array.isArray(analyticsRes?.accounts)) setAccounts(analyticsRes.accounts);
        if (analyticsRes?.summary) {
          setAnalyticsData({
            summary: analyticsRes.summary,
            videos: analyticsRes.videos || [],
            timeline: analyticsRes.timeline || [],
            topicInsights: analyticsRes.topicInsights || [],
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const scheduledPosts = useMemo(
    () =>
      posts.filter(
        (p) => p.status === 'scheduled' || p.status === 'scheduled_on_platform'
      ),
    [posts]
  );

  const publishedCount =
    analyticsData?.summary?.publishedPostsCount ??
    posts.filter((p) => p.status === 'published').length;

  const totalViews = analyticsData?.summary?.totalChannelViews ?? 0;
  const totalFollowers = analyticsData?.summary?.totalFollowers ?? 0;
  const totalVideos = analyticsData?.summary?.totalChannelPosts ?? 0;
  const connectedAccountsCount = accounts.filter((a) => a.isConnected).length;

  // Weekly Heatmap computed from real posts + baseline studio velocity
  const weeklyHeatmap = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const todayIdx = new Date().getDay();
    const counts = new Array(7).fill(0);
    for (const p of posts) {
      const d = new Date(p.scheduledAt);
      if (!isNaN(d.getTime())) counts[d.getDay()] += 1;
    }
    const ordered = [1, 2, 3, 4, 5, 6, 0]; // Mon -> Sun
    const defaultTimes = ['11 AM', '1:30 PM', '4:30 PM', '2:00 PM', '10 AM', '12 PM', '6 PM'];
    const baseHeights = [45, 70, 85, 95, 40, 20, 25];

    return ordered.map((dayIdx, i) => {
      const realCount = counts[dayIdx];
      const heightPct = realCount > 0 ? Math.min(96, 25 + realCount * 18) : baseHeights[i];
      return {
        label: days[dayIdx],
        postsCount: realCount,
        heightPct,
        bestTime: defaultTimes[i],
        isToday: dayIdx === todayIdx,
        isPeak: i === 3 || heightPct >= 85,
      };
    });
  }, [posts]);

  const platformGoals = useMemo(() => {
    const platforms: SocialPlatform[] = [
      'youtube',
      'instagram',
      'facebook',
      'tiktok',
      'twitter',
      'threads',
    ];
    return platforms.map((platform) => {
      const count = posts.filter((p) => p.targetPlatforms.includes(platform)).length;
      const goal = platform === 'youtube' ? 7 : 5;
      const pct = Math.min(100, Math.round((count / goal) * 100));
      return {
        platform,
        name: PLATFORM_CONFIGS[platform]?.name || platform,
        count,
        goal,
        pct,
        color: PLATFORM_BAR_COLORS[platform] || '#C27345',
      };
    });
  }, [posts]);

  const contentMix = useMemo(() => {
    const items = analyticsData?.topicInsights || [];
    if (items.length === 0) {
      return [
        { label: 'Tutorials & Coding', pct: 38, color: TOPIC_COLORS[0] },
        { label: 'Shorts & Reels', pct: 28, color: TOPIC_COLORS[1] },
        { label: 'AI & Automation', pct: 20, color: TOPIC_COLORS[2] },
        { label: 'Behind the Scenes', pct: 14, color: TOPIC_COLORS[3] },
      ];
    }
    const total = items.reduce((acc, i) => acc + Math.max(1, i.videosCount), 0);
    return items.slice(0, 5).map((item, idx) => ({
      label: item.topic,
      pct: Math.round((Math.max(1, item.videosCount) / total) * 100),
      color: TOPIC_COLORS[idx % TOPIC_COLORS.length],
    }));
  }, [analyticsData]);

  const feedItems = useMemo(() => {
    if (analyticsData?.videos && analyticsData.videos.length > 0) {
      return analyticsData.videos.slice(0, 4).map((v) => ({
        id: v.id,
        title: v.title,
        thumbnailUrl: v.thumbnailUrl,
        platform: v.platform,
        metric: `${v.views.toLocaleString()} views`,
        url: v.url,
      }));
    }
    return posts.slice(0, 4).map((p) => ({
      id: p.id,
      title: p.globalCaption || p.mediaFileName || 'Scheduled Post',
      thumbnailUrl: p.coverUrl || '',
      platform: p.targetPlatforms[0] || 'youtube',
      metric: p.status,
      url: '/publishing',
    }));
  }, [analyticsData, posts]);

  const topInsight = analyticsData?.topicInsights?.[0];

  return (
    <div className="space-y-6">
      {/* Top Welcome Banner & Controls (Exact Stitch Studio Dashboard) */}
      <section className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-1">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h2 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight text-content-primary">
              Welcome back, Admin
            </h2>
            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-brand-container text-brand text-xs font-semibold">
              Studio
            </span>
          </div>
          <p className="text-sm text-content-secondary">
            Here is what is happening across your connected social channels today.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-xs font-semibold shadow-card">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              Sync Status: {connectedAccountsCount} / {accounts.length || 8} Channels Active
            </span>
          </div>

          <Button asChild variant="secondary" size="sm">
            <Link href="/analytics">
              <CalendarIcon className="w-3.5 h-3.5 text-content-muted" />
              <span>Last 30 Days</span>
            </Link>
          </Button>

          <Button asChild variant="secondary" size="sm" className="bg-surface-high border-border">
            <Link href="/publishing">
              <Zap className="w-3.5 h-3.5 text-brand" />
              <span>Instant Publish</span>
            </Link>
          </Button>
        </div>
      </section>

      {/* Row 1: 4 Stitch Editorial KPI Cards */}
      <section
        aria-label="Key metrics"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        {/* KPI 1: Total Channel Views */}
        <div className="p-6 rounded-2xl bg-surface-lowest border border-border shadow-card hover:shadow-elevated transition-all flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-brand/10 pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-content-secondary">
              Total Channel Views
            </span>
            <span className="w-8 h-8 rounded-lg bg-surface-low flex items-center justify-center text-brand">
              <Eye className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-4 gap-2">
            <span className="font-serif text-[2.35rem] leading-none font-medium text-content-primary tabular-nums">
              {loading ? '—' : totalViews.toLocaleString()}
            </span>
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
              <TrendingUp className="w-3 h-3" />
              Live
            </span>
          </div>
          <div className="mt-4 pt-1 flex items-end justify-between">
            <span className="text-xs text-content-muted">Across connected channels</span>
            <svg className="w-24 h-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 100 24">
              <path d="M0 20 L15 17 L30 19 L45 11 L60 14 L75 6 L90 8 L100 2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              <path d="M0 20 L15 17 L30 19 L45 11 L60 14 L75 6 L90 8 L100 2 V 24 H 0 Z" fill="currentColor" fillOpacity="0.08" />
            </svg>
          </div>
        </div>

        {/* KPI 2: Published Videos */}
        <div className="p-6 rounded-2xl bg-surface-lowest border border-border shadow-card hover:shadow-elevated transition-all flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-content-secondary">
              Published Videos
            </span>
            <span className="w-8 h-8 rounded-lg bg-surface-low flex items-center justify-center text-brand">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-4 gap-2">
            <span className="font-serif text-[2.35rem] leading-none font-medium text-content-primary tabular-nums">
              {loading ? '—' : totalVideos}
            </span>
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
              +{publishedCount} studio
            </span>
          </div>
          <div className="mt-4 pt-1 flex items-center justify-between">
            <span className="text-xs text-content-muted">Total posts: {posts.length}</span>
            <div className="w-20 bg-surface-high h-2 rounded-full overflow-hidden">
              <div
                className="bg-brand h-full rounded-full"
                style={{ width: `${Math.min(100, Math.max(18, publishedCount * 12))}%` }}
              />
            </div>
          </div>
        </div>

        {/* KPI 3: Scheduled Posts */}
        <div className="p-6 rounded-2xl bg-surface-lowest border border-border shadow-card hover:shadow-elevated transition-all flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-content-secondary">
              Scheduled Posts
            </span>
            <span className="w-8 h-8 rounded-lg bg-brand-container flex items-center justify-center text-brand">
              <CalendarIcon className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-4 gap-2">
            <span className="font-serif text-[2.35rem] leading-none font-medium text-content-primary tabular-nums">
              {loading ? '—' : scheduledPosts.length}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-surface-high text-content-secondary text-xs font-semibold">
              Queue
            </span>
          </div>
          <div className="mt-4 pt-1 flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 text-brand font-medium">
              <span className="w-2 h-2 rounded-full bg-brand" />
              {posts.filter((p) => p.status === 'draft').length} Drafts
            </span>
            <span className="text-content-muted">•</span>
            <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {scheduledPosts.length} Ready
            </span>
          </div>
        </div>

        {/* KPI 4: Audience & Channels */}
        <div className="p-6 rounded-2xl bg-surface-lowest border border-border shadow-card hover:shadow-elevated transition-all flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-content-secondary">
              Total Audience
            </span>
            <span className="w-8 h-8 rounded-lg bg-surface-low flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-4 gap-2">
            <span className="font-serif text-[2.35rem] leading-none font-medium text-content-primary tabular-nums">
              {loading ? '—' : totalFollowers.toLocaleString()}
            </span>
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
              {connectedAccountsCount}/{accounts.length || 8} Active
            </span>
          </div>
          <div className="mt-4 pt-1 flex items-center justify-between text-xs">
            <span className="text-content-muted">Synced social profiles</span>
            <Link href="/connections" className="text-brand font-semibold hover:underline">
              Manage
            </Link>
          </div>
        </div>
      </section>

      {/* Main Stitch 12-Column Grid (8 Cols Left / 4 Cols Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (8 Cols = ~66%) */}
        <div className="lg:col-span-8 flex flex-col gap-6 min-w-0">
          {/* 1. Upcoming Queue & Smart Schedule */}
          <div className="p-6 rounded-2xl bg-surface-lowest border border-border shadow-card flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-surface-high flex items-center justify-center text-brand">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-content-primary">
                    Upcoming Queue &amp; Smart Schedule
                  </h2>
                  <p className="text-xs text-content-secondary">
                    Next immediate automated deliveries with audience peak optimization
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-semibold text-content-secondary bg-surface-low border border-border px-2.5 py-1 rounded-full">
                  {scheduledPosts.length} Scheduled
                </span>
                <Link
                  href="/publishing"
                  className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1"
                >
                  View All <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {scheduledPosts.slice(0, 3).map((post) => (
                <div
                  key={post.id}
                  className="p-4 rounded-xl bg-surface-low/80 hover:bg-surface-low border border-border-subtle transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start md:items-center gap-4 min-w-0">
                    <div className="relative flex-shrink-0">
                      <div className="w-16 h-16 rounded-xl bg-surface-high border border-border overflow-hidden flex items-center justify-center">
                        {post.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={post.coverUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Video className="w-5 h-5 text-content-muted" />
                        )}
                      </div>
                      <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-surface-lowest border border-border shadow flex items-center justify-center">
                        <PlatformMiniIcon platform={post.targetPlatforms[0] || 'youtube'} />
                      </span>
                    </div>

                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-brand-container text-brand text-[11px] font-semibold capitalize">
                          {post.targetPlatforms.join(', ')}
                        </span>
                        <span className="text-xs text-brand font-semibold inline-flex items-center gap-1">
                          <AlarmClock className="w-3.5 h-3.5" />
                          {new Date(post.scheduledAt).toLocaleString()}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-content-primary truncate">
                        {post.globalCaption || post.mediaFileName || 'Untitled Scheduled Post'}
                      </h3>
                      <p className="text-xs text-content-secondary truncate">
                        {post.mediaFileName || 'Ready for multi-channel dispatch'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-center">
                    <Link
                      href="/publishing"
                      title="View in Queue"
                      className="w-8 h-8 rounded-lg bg-surface-lowest border border-border text-content-secondary hover:text-brand flex items-center justify-center transition-colors shadow-card"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                    <Link
                      href="/calendar"
                      title="Reschedule on Calendar"
                      className="w-8 h-8 rounded-lg bg-surface-lowest border border-border text-content-secondary hover:text-brand flex items-center justify-center transition-colors shadow-card"
                    >
                      <CalendarIcon className="w-4 h-4" />
                    </Link>
                    <Link
                      href={`/composer?clone=${encodeURIComponent(post.id)}`}
                      title="Edit in Composer"
                      className="w-8 h-8 rounded-lg bg-surface-lowest border border-border text-content-secondary hover:text-brand flex items-center justify-center transition-colors shadow-card"
                    >
                      <Edit3 className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))}

              {scheduledPosts.length === 0 && (
                <div className="rounded-xl border border-dashed border-border bg-surface-low p-6 text-center space-y-2.5">
                  <p className="text-xs text-content-muted">
                    No upcoming posts in the queue right now.
                  </p>
                  <Button asChild size="sm">
                    <Link href="/composer">
                      <Plus className="w-3.5 h-3.5" />
                      Schedule a Post
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* 2. Publishing Velocity & Best Times to Post (Stitch 7-Day Heatmap Graphic) */}
          <div className="p-6 rounded-2xl bg-surface-lowest border border-border shadow-card flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-content-primary">
                    Publishing Velocity &amp; Best Times to Post
                  </h2>
                  <span className="bg-brand-container text-brand text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
                    AI Calibrated
                  </span>
                </div>
                <p className="text-xs text-content-secondary mt-0.5">
                  Recommended posting windows highlighted based on channel engagement heatmaps
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5 text-content-secondary">
                  <span className="w-3 h-3 rounded bg-surface-high" />
                  <span>Low</span>
                </div>
                <div className="flex items-center gap-1.5 text-content-secondary">
                  <span className="w-3 h-3 rounded bg-brand-container border border-brand/30" />
                  <span>Moderate</span>
                </div>
                <div className="flex items-center gap-1.5 text-brand font-semibold">
                  <span className="w-3 h-3 rounded bg-brand" />
                  <span>Peak Engagement</span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto pb-1 -mx-1 px-1">
              <div className="grid grid-cols-7 gap-2 pt-2 text-center min-w-[500px]">
                {weeklyHeatmap.map((day) => (
                <div
                  key={day.label}
                  className={
                    day.isToday
                      ? 'flex flex-col gap-2 p-2 rounded-xl bg-brand/5 ring-1 ring-brand/30 relative shadow-card'
                      : day.isPeak
                      ? 'flex flex-col gap-2 p-2 rounded-xl bg-brand-container/40 border border-brand/20'
                      : 'flex flex-col gap-2 p-2 rounded-xl bg-surface-low/60'
                  }
                >
                  {day.isToday && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-brand text-brand-contrast text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                      Today
                    </span>
                  )}
                  <span className={`text-xs font-semibold ${day.isToday ? 'text-brand' : 'text-content-primary'}`}>
                    {day.label}
                  </span>
                  <span className="text-[11px] text-content-muted">
                    {day.postsCount} {day.postsCount === 1 ? 'Post' : 'Posts'}
                  </span>
                  <div className="h-20 rounded-lg bg-surface-container flex flex-col justify-end p-1">
                    <div
                      className={`w-full rounded transition-all ${
                        day.isToday || day.isPeak
                          ? 'bg-brand shadow-soft'
                          : day.heightPct >= 45
                          ? 'bg-brand/45'
                          : 'bg-surface-high'
                      }`}
                      style={{ height: `${day.heightPct}%` }}
                    />
                  </div>
                  <span className={`text-[11px] font-semibold ${day.isToday || day.isPeak ? 'text-brand' : 'text-content-muted'}`}>
                    {day.bestTime} {day.isPeak ? '★' : ''}
                  </span>
                </div>
              ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-surface-low border border-border-subtle text-xs text-content-secondary">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-brand flex-shrink-0" />
                <span>
                  Predicted best slot this week:{' '}
                  <strong className="text-content-primary">
                    {topInsight?.bestTimePkt || 'Thursday at 2:00 PM'}
                  </strong>{' '}
                  (Peak audience activity)
                </span>
              </div>
              <Link href="/composer" className="text-brand font-semibold hover:underline">
                Schedule Post Here
              </Link>
            </div>
          </div>

          {/* 3. Feed Preview + Platform Goals & Content Mix (Preserved Existing Sections in Stitch Style) */}
          <div className="p-6 rounded-2xl bg-surface-lowest border border-border shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-content-primary flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand" />
                  Feed Preview
                </h2>
                <p className="text-xs text-content-secondary">Recent published &amp; queued media</p>
              </div>
              <Button asChild variant="outline" size="sm" className="text-xs h-8">
                <Link href="/publishing">
                  View Full Feed <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </Button>
            </div>

            {feedItems.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {feedItems.map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target={item.url.startsWith('http') ? '_blank' : undefined}
                    rel={item.url.startsWith('http') ? 'noreferrer' : undefined}
                    className="group rounded-xl border border-border bg-surface-low overflow-hidden flex flex-col hover:border-brand transition-colors"
                  >
                    <div className="aspect-[4/3] w-full bg-surface-high overflow-hidden relative">
                      {item.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-content-muted">
                          No preview
                        </div>
                      )}
                      <span className="absolute top-1.5 left-1.5 rounded-full bg-surface-lowest/90 backdrop-blur px-2 py-0.5 text-[10px] font-semibold text-content-primary capitalize shadow-card border border-border">
                        {item.platform}
                      </span>
                    </div>
                    <div className="p-2.5 space-y-1">
                      <p className="text-xs font-semibold text-content-primary line-clamp-2 leading-snug">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-content-muted">{item.metric}</p>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-surface-low p-6 text-center space-y-2">
                <p className="text-xs text-content-muted">No posts or videos loaded yet.</p>
                <Button asChild size="sm">
                  <Link href="/composer">Create First Post</Link>
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Platform Goals */}
            <div className="p-6 rounded-2xl bg-surface-lowest border border-border shadow-card space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-content-primary">Platform Goals</h3>
                  <p className="text-xs text-content-secondary">Posts queued per network</p>
                </div>
                <Button asChild variant="ghost" size="sm" className="text-xs h-7 px-2">
                  <Link href="/composer">
                    <Plus className="w-3.5 h-3.5" /> Add
                  </Link>
                </Button>
              </div>
              <div className="space-y-3">
                {platformGoals.map((item) => (
                  <div key={item.platform} className="grid grid-cols-[100px_1fr_36px] items-center gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-xs font-medium text-content-primary truncate">{item.name}</span>
                    </div>
                    <Progress value={item.pct} indicatorColor={item.color} />
                    <span className="text-xs font-semibold text-content-secondary text-right tabular-nums">
                      {item.count}/{item.goal}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Content Mix */}
            <div className="p-6 rounded-2xl bg-surface-lowest border border-border shadow-card space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-content-primary flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-brand" />
                    Content Mix
                  </h3>
                  <p className="text-xs text-content-secondary">Topic share across channel</p>
                </div>
                <Button asChild variant="ghost" size="sm" className="text-xs h-7 px-2">
                  <Link href="/analytics">Details</Link>
                </Button>
              </div>
              <div className="space-y-3">
                {contentMix.map((item) => (
                  <div key={item.label} className="grid grid-cols-[120px_1fr_40px] items-center gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-xs font-medium text-content-primary truncate">{item.label}</span>
                    </div>
                    <Progress value={item.pct} indicatorColor={item.color} />
                    <span className="text-xs font-semibold text-content-secondary text-right tabular-nums">
                      {item.pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (4 Cols = ~34%) */}
        <div className="lg:col-span-4 flex flex-col gap-6 min-w-0">
          {/* 1. Connected Channels Health & Audiences */}
          <div className="p-6 rounded-2xl bg-surface-lowest border border-border shadow-card flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-content-primary flex items-center gap-2">
                <Link2 className="w-4 h-4 text-brand" />
                Connected Channels
              </h2>
              <Link
                href="/connections"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Account</span>
              </Link>
            </div>

            <div className="flex flex-col gap-2">
              {accounts.slice(0, 6).map((acc) => (
                <div
                  key={acc.id}
                  className="p-3 rounded-xl bg-surface-low/70 hover:bg-surface-low border border-border-subtle transition-colors flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-surface-lowest border border-border flex items-center justify-center flex-shrink-0">
                      <PlatformMiniIcon platform={acc.platform} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-content-primary truncate">
                          {acc.handle || acc.accountName || PLATFORM_CONFIGS[acc.platform]?.name}
                        </span>
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            acc.isConnected ? 'bg-emerald-500' : 'bg-content-muted/40'
                          }`}
                        />
                      </div>
                      <span className="text-[11px] text-content-muted truncate">
                        {acc.followersCount
                          ? `${acc.followersCount.toLocaleString()} followers`
                          : PLATFORM_CONFIGS[acc.platform]?.name}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <Badge variant={acc.isConnected ? 'sage' : 'outline'} className="text-[10px]">
                      {acc.isConnected ? 'Live' : 'Offline'}
                    </Badge>
                  </div>
                </div>
              ))}
              {accounts.length === 0 && (
                <p className="text-xs text-content-muted py-4 text-center">Loading channels...</p>
              )}
            </div>
          </div>

          {/* 2. Studio AI Intelligence Card (Exact Stitch Card) */}
          <div className="p-6 rounded-2xl bg-brand-container/60 border border-brand/25 shadow-card flex flex-col gap-4 relative overflow-hidden">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-brand" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand-on-container">
                  Studio AI Intelligence
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-surface-lowest text-brand text-[11px] font-semibold shadow-card">
                Recommendation
              </span>
            </div>

            <p className="text-sm font-medium text-content-primary leading-snug">
              {topInsight ? (
                <>
                  Topic <strong className="text-brand font-semibold">{topInsight.topic}</strong> averages{' '}
                  <strong className="underline decoration-brand">{topInsight.avgViews.toLocaleString()} views</strong>{' '}
                  — best posted at {topInsight.bestTimePkt}.
                </>
              ) : (
                <>
                  Short-form vertical videos on <strong className="text-brand font-semibold">YouTube &amp; Instagram</strong>{' '}
                  perform <strong className="underline decoration-brand">2.8x better</strong> during evening peak hours.
                </>
              )}
            </p>

            <p className="text-xs text-content-secondary leading-relaxed">
              Use the Multi-Channel Composer to customize captions, thumbnails, and platform-specific overrides in one pass.
            </p>

            <Link
              href="/composer"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-hover text-brand-contrast text-xs font-semibold rounded-xl shadow-soft transition-all"
            >
              <PenTool className="w-4 h-4" />
              <span>Draft Post Now</span>
            </Link>
          </div>

          {/* 3. Recent Activity Card (Exact Stitch Card) */}
          <div className="p-6 rounded-2xl bg-surface-lowest border border-border shadow-card flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-content-primary">Recent Activity</h2>
              <Link href="/publishing" className="text-xs font-semibold text-content-muted hover:text-content-primary">
                History
              </Link>
            </div>
            <div className="flex flex-col gap-3">
              {posts.slice(0, 3).map((post) => (
                <div key={post.id} className="flex items-start gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      post.status === 'published'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : post.status === 'failed'
                        ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                        : 'bg-brand-container text-brand'
                    }`}
                  >
                    {post.status === 'published' ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Clock className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <p className="text-xs text-content-primary leading-snug line-clamp-2">
                      <strong className="capitalize">{post.status.replace(/_/g, ' ')}</strong>:{' '}
                      {post.globalCaption || post.mediaFileName || 'Studio post'}
                    </p>
                    <span className="text-[11px] text-content-muted mt-0.5">
                      {new Date(post.scheduledAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
              {posts.length === 0 && (
                <p className="text-xs text-content-muted text-center py-3">No recent activity yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
