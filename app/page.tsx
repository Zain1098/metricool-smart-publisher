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
} from 'lucide-react';
import { ConnectedAccount, ScheduledPost, SocialPlatform } from '@/lib/types';
import { PLATFORM_CONFIGS } from '@/lib/utils';
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
import { Progress } from '@/components/ui/shadcn/progress';

const PLATFORM_BAR_COLORS: Record<string, string> = {
  youtube: '#D94343',
  instagram: '#D84E7D',
  facebook: '#2E77D0',
  tiktok: '#2B2825',
  twitter: '#4B5563',
  threads: '#6B5CE7',
  linkedin: '#2563EB',
  pinterest: '#C83E4D',
};

const TOPIC_COLORS = ['#2E77D0', '#D99B26', '#3A8E63', '#6B5CE7', '#C84E89', '#1E8FA3'];

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
  const totalVideos = analyticsData?.summary?.totalChannelPosts ?? 0;
  const connectedAccountsCount = accounts.filter((a) => a.isConnected).length;

  // Platform goals breakdown
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

  // Content mix from topicInsights
  const contentMix = useMemo(() => {
    const items = analyticsData?.topicInsights || [];
    if (items.length === 0) {
      return [
        { label: 'Tutorials & Coding', pct: 38, target: 40, color: TOPIC_COLORS[0] },
        { label: 'Shorts & Reels', pct: 28, target: 30, color: TOPIC_COLORS[1] },
        { label: 'AI & Automation', pct: 20, target: 20, color: TOPIC_COLORS[2] },
        { label: 'Behind the Scenes', pct: 14, target: 10, color: TOPIC_COLORS[3] },
      ];
    }
    const total = items.reduce((acc, i) => acc + Math.max(1, i.videosCount), 0);
    return items.slice(0, 5).map((item, idx) => ({
      label: item.topic,
      pct: Math.round((Math.max(1, item.videosCount) / total) * 100),
      target: Math.round(100 / Math.min(5, items.length)),
      color: TOPIC_COLORS[idx % TOPIC_COLORS.length],
    }));
  }, [analyticsData]);

  // Feed preview items (latest videos or posts)
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

  return (
    <div className="space-y-6">
      {/* Row 1: 4 Pastel KPI Cards (NestKit Editorial Style) */}
      <section
        aria-label="Key metrics"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        {/* KPI 1: Sage Mint */}
        <Card className="bg-[#DCEAE2] border-[#C5DDD0] shadow-none">
          <CardContent className="p-5 flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-white/70 flex items-center justify-center text-[#24503B]">
                <Send className="w-4 h-4" />
              </div>
              <Badge variant="sage" className="bg-white/80 border-transparent font-semibold">
                <TrendingUp className="w-3 h-3 mr-1" />
                Live
              </Badge>
            </div>
            <div>
              <div className="text-3xl font-bold tracking-tight text-[#1E1B18] tabular-nums">
                {loading ? '—' : posts.length}
              </div>
              <p className="text-xs font-medium text-[#2F4F3E] mt-1">
                Total Studio Posts
              </p>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Warm Peach */}
        <Card className="bg-[#F5DFCE] border-[#EACBB4] shadow-none">
          <CardContent className="p-5 flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-white/70 flex items-center justify-center text-[#8D451E]">
                <CalendarIcon className="w-4 h-4" />
              </div>
              <Badge variant="peach" className="bg-white/80 border-transparent font-semibold">
                Queue
              </Badge>
            </div>
            <div>
              <div className="text-3xl font-bold tracking-tight text-[#1E1B18] tabular-nums">
                {loading ? '—' : scheduledPosts.length}
              </div>
              <p className="text-xs font-medium text-[#6B3A1E] mt-1">
                Scheduled Posts
              </p>
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: Soft Rose */}
        <Card className="bg-[#F3DADF] border-[#E8C5CD] shadow-none">
          <CardContent className="p-5 flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-white/70 flex items-center justify-center text-[#8B3247]">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <Badge variant="rose" className="bg-white/80 border-transparent font-semibold">
                +{publishedCount} studio
              </Badge>
            </div>
            <div>
              <div className="text-3xl font-bold tracking-tight text-[#1E1B18] tabular-nums">
                {loading ? '—' : totalVideos}
              </div>
              <p className="text-xs font-medium text-[#6C2B3B] mt-1">
                Published Videos
              </p>
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Soft Lavender */}
        <Card className="bg-[#E5DFF5] border-[#D4CBEB] shadow-none">
          <CardContent className="p-5 flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-white/70 flex items-center justify-center text-[#4B3688]">
                <Eye className="w-4 h-4" />
              </div>
              <Badge variant="lavender" className="bg-white/80 border-transparent font-semibold">
                {connectedAccountsCount}/{accounts.length || 8} active
              </Badge>
            </div>
            <div>
              <div className="text-3xl font-bold tracking-tight text-[#1E1B18] tabular-nums">
                {loading ? '—' : totalViews.toLocaleString()}
              </div>
              <p className="text-xs font-medium text-[#3F2E73] mt-1">
                Total Channel Views
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Row 2: 3-Column Bento Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Card 1: Platform Goals */}
        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-sm font-semibold">Platform Goals</CardTitle>
              <CardDescription>Posts queued per network</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs h-7 px-2">
              <Link href="/composer">
                <Plus className="w-3.5 h-3.5" />
                Add
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {platformGoals.map((item) => (
              <div key={item.platform} className="grid grid-cols-[110px_1fr_36px] items-center gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs font-medium text-[#1E1B18] truncate">
                    {item.name}
                  </span>
                </div>
                <Progress value={item.pct} indicatorColor={item.color} />
                <span className="text-xs font-semibold text-[#6E655D] text-right tabular-nums">
                  {item.count}/{item.goal}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Card 2: Content Mix */}
        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#C27345]" />
                Content Mix
              </CardTitle>
              <CardDescription>Topic share across channel</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs h-7 px-2">
              <Link href="/analytics">Details</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {contentMix.map((item) => (
              <div key={item.label} className="grid grid-cols-[130px_1fr_44px] items-center gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs font-medium text-[#1E1B18] truncate">
                    {item.label}
                  </span>
                </div>
                <Progress value={item.pct} indicatorColor={item.color} />
                <span className="text-xs font-semibold text-[#6E655D] text-right tabular-nums">
                  {item.pct}%
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Card 3: Connected Channels */}
        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Link2 className="w-4 h-4 text-[#C27345]" />
                Connected Channels
              </CardTitle>
              <CardDescription>Live OAuth & API health</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm" className="text-xs h-7 px-2.5">
              <Link href="/connections">All</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {accounts.slice(0, 5).map((acc) => (
              <div
                key={acc.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-[#EFE9E1] bg-[#FAF6F1] px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#1E1B18] truncate">
                    {acc.accountName || PLATFORM_CONFIGS[acc.platform]?.name}
                  </div>
                  <div className="text-[11px] text-[#6E655D] truncate">
                    {acc.handle || acc.platform}
                  </div>
                </div>
                <Badge
                  variant={acc.isConnected ? 'sage' : 'outline'}
                  className="flex-shrink-0 text-[10px]"
                >
                  {acc.isConnected ? 'Active' : 'Disconnected'}
                </Badge>
              </div>
            ))}
            {accounts.length === 0 && (
              <p className="text-xs text-[#6E655D] py-4 text-center">
                Loading channels...
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Row 3: 2-Column Bottom Grid (Feed Preview + Due Today / Upcoming) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Feed Preview */}
        <Card className="lg:col-span-7 min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#C27345]" />
                Feed Preview
              </CardTitle>
              <CardDescription>Recent published & queued media</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm" className="text-xs h-8">
              <Link href="/publishing">
                View Full Feed
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {feedItems.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {feedItems.map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target={item.url.startsWith('http') ? '_blank' : undefined}
                    rel={item.url.startsWith('http') ? 'noreferrer' : undefined}
                    className="group rounded-xl border border-[#E7DFD5] bg-[#FAF6F1] overflow-hidden flex flex-col hover:border-[#C27345] transition-colors"
                  >
                    <div className="aspect-[4/3] w-full bg-[#EFE9E1] overflow-hidden relative">
                      {item.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-[#8E847A]">
                          No preview
                        </div>
                      )}
                      <span className="absolute top-1.5 left-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-[#1E1B18] capitalize shadow-xs">
                        {item.platform}
                      </span>
                    </div>
                    <div className="p-2.5 space-y-1">
                      <p className="text-xs font-semibold text-[#1E1B18] line-clamp-2 leading-snug">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-[#6E655D]">{item.metric}</p>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#D6CBC0] bg-[#FAF6F1] p-6 text-center space-y-2">
                <p className="text-xs text-[#6E655D]">No posts or videos loaded yet.</p>
                <Button asChild size="sm">
                  <Link href="/composer">Create First Post</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Due Today / Upcoming */}
        <Card className="lg:col-span-5 min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#C27345]" />
                Due Today / Upcoming
              </CardTitle>
              <CardDescription>Next scheduled social posts</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm" className="text-xs h-8">
              <Link href="/calendar">Calendar</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {scheduledPosts.slice(0, 4).map((post) => (
              <Link
                key={post.id}
                href="/publishing"
                className="flex items-center justify-between gap-3 rounded-xl border border-[#EFE9E1] bg-[#FAF6F1] p-3 hover:border-[#C27345] transition-colors"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="text-xs font-semibold text-[#1E1B18] truncate">
                    {post.globalCaption || post.mediaFileName || 'Untitled Post'}
                  </p>
                  <p className="text-[11px] text-[#6E655D] truncate">
                    {new Date(post.scheduledAt).toLocaleString()} ·{' '}
                    {post.targetPlatforms.join(', ')}
                  </p>
                </div>
                <Badge variant="peach" className="flex-shrink-0 text-[10px]">
                  Scheduled
                </Badge>
              </Link>
            ))}

            {scheduledPosts.length === 0 && (
              <div className="rounded-xl border border-dashed border-[#D6CBC0] bg-[#FAF6F1] p-6 text-center space-y-2.5">
                <p className="text-xs text-[#6E655D]">
                  No upcoming posts in the queue right now.
                </p>
                <Button asChild size="sm" variant="secondary">
                  <Link href="/composer">
                    <Plus className="w-3.5 h-3.5" />
                    Schedule a Post
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
