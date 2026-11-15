'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { ScheduledPost, PostStatus } from '@/lib/types';
import { PLATFORM_CONFIGS } from '@/lib/utils';
import {
  Send,
  Clock,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  Plus,
  RefreshCw,
  Trash2,
  Copy,
  ExternalLink,
  Search,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  PlatformBadge,
  SegmentedTabs,
  StatusPill,
  TableSkeleton,
  useToast,
} from '@/components/ui';

type FilterTab =
  | 'all'
  | 'queue'
  | 'scheduled_on_platform'
  | 'published'
  | 'failed'
  | 'draft';

export default function PublishingPage() {
  const { pushToast } = useToast();
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [runningCron, setRunningCron] = useState(false);

  const loadPosts = useCallback(async () => {
    try {
      const res = await fetch('/api/posts');
      const data = await res.json();
      if (data.posts) setPosts(data.posts);
    } catch {
      pushToast({ type: 'error', title: 'Could not load publishing queue' });
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handleRunCron = async () => {
    setRunningCron(true);
    try {
      const res = await fetch('/api/cron');
      const data = await res.json();
      pushToast({
        type: 'success',
        title: 'Scheduler queue processed',
        description: data.message || 'Checked due posts for dispatch.',
      });
      loadPosts();
    } catch {
      pushToast({ type: 'error', title: 'Cron execution failed' });
    } finally {
      setRunningCron(false);
    }
  };

  const handleExecuteNow = async (post: ScheduledPost, useNative = false) => {
    setActiveId(post.id);
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useNativeSchedule: useNative }),
      });
      const data = await res.json();
      pushToast({
        type: data.success ? 'success' : 'warning',
        title: data.message || 'Publish check completed',
        description: Array.isArray(data.errors) && data.errors.length > 0
          ? data.errors.join(' | ')
          : undefined,
      });
      loadPosts();
    } catch {
      pushToast({ type: 'error', title: 'Network error publishing post' });
    } finally {
      setActiveId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this post from publishing queue and history?')) return;
    try {
      await fetch(`/api/posts/${id}`, { method: 'DELETE' });
      pushToast({ type: 'success', title: 'Post deleted' });
      loadPosts();
    } catch {
      pushToast({ type: 'error', title: 'Could not delete post' });
    }
  };

  const counts = useMemo(() => {
    const map: Record<PostStatus, number> = {
      draft: 0,
      scheduled: 0,
      scheduled_on_platform: 0,
      publishing: 0,
      published: 0,
      failed: 0,
    };
    for (const p of posts) map[p.status] = (map[p.status] || 0) + 1;
    return map;
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter((p) => {
      const matchesTab =
        tab === 'all'
          ? true
          : tab === 'queue'
          ? p.status === 'scheduled' || p.status === 'publishing'
          : p.status === tab;
      const matchesSearch =
        !q ||
        (p.globalCaption || '').toLowerCase().includes(q) ||
        (p.mediaFileName || '').toLowerCase().includes(q) ||
        p.targetPlatforms.some((pl) => pl.includes(q));
      return matchesTab && matchesSearch;
    });
  }, [posts, tab, search]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-studio-border">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-ink-primary tracking-[-0.02em]">
            Publishing Management
          </h1>
          <p className="text-xs text-ink-muted">
            Monitor queued dispatches, Cloud Server Holds, published history, and retry failed deliveries.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={runningCron}
            onClick={handleRunCron}
            icon={<RefreshCw className="w-3.5 h-3.5 text-status-success" />}
          >
            Process Due Queue
          </Button>
          <Link href="/composer">
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              New Post
            </Button>
          </Link>
        </div>
      </div>

      {/* Status Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card padding="sm" className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>Local Queue</span>
            <Clock className="w-4 h-4 text-accent-soft" />
          </div>
          <p className="text-2xl font-semibold font-mono tabular-nums text-ink-primary">
            {counts.scheduled + counts.publishing}
          </p>
          <p className="text-[11px] text-ink-muted">Pending scheduler trigger</p>
        </Card>

        <Card padding="sm" className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>Cloud Server Hold</span>
            <Cloud className="w-4 h-4 text-status-cloud" />
          </div>
          <p className="text-2xl font-semibold font-mono tabular-nums text-ink-primary">
            {counts.scheduled_on_platform}
          </p>
          <p className="text-[11px] text-ink-muted">Held on YouTube / Meta</p>
        </Card>

        <Card padding="sm" className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>Published Live</span>
            <CheckCircle2 className="w-4 h-4 text-status-success" />
          </div>
          <p className="text-2xl font-semibold font-mono tabular-nums text-ink-primary">
            {counts.published}
          </p>
          <p className="text-[11px] text-ink-muted">Verified network posts</p>
        </Card>

        <Card padding="sm" className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>Needs Attention</span>
            <AlertTriangle className="w-4 h-4 text-status-danger" />
          </div>
          <p className="text-2xl font-semibold font-mono tabular-nums text-ink-primary">
            {counts.failed}
          </p>
          <p className="text-[11px] text-ink-muted">Failed / retry available</p>
        </Card>
      </div>

      {/* Queue List Card */}
      <Card className="space-y-4">
        <CardHeader
          icon={<Send className="w-4 h-4 text-accent-soft" />}
          title="Dispatch Queue &amp; History"
          subtitle="Filter by delivery status or inspect per-platform status logs"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search caption or file..."
                leftIcon={<Search className="w-3.5 h-3.5" />}
                className="w-full sm:w-52 h-8 text-xs"
              />
              <SegmentedTabs
                size="xs"
                value={tab}
                onChange={setTab}
                items={[
                  { id: 'all', label: 'All', count: posts.length },
                  {
                    id: 'queue',
                    label: 'Queue',
                    count: counts.scheduled + counts.publishing,
                  },
                  {
                    id: 'scheduled_on_platform',
                    label: 'Cloud Hold',
                    count: counts.scheduled_on_platform,
                  },
                  { id: 'published', label: 'Published', count: counts.published },
                  { id: 'failed', label: 'Failed', count: counts.failed },
                  { id: 'draft', label: 'Drafts', count: counts.draft },
                ]}
              />
            </div>
          }
        />

        {loading ? (
          <TableSkeleton rows={4} />
        ) : filteredPosts.length === 0 ? (
          <EmptyState
            icon={<Send className="w-5 h-5" />}
            title="No posts in this view"
            description={
              tab === 'all'
                ? 'Schedule or publish your first video from Post Composer to track delivery status here.'
                : 'No posts match this status filter right now.'
            }
            action={
              <Link href="/composer">
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Plus className="w-3.5 h-3.5" />}
                >
                  Open Composer
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="divide-y divide-studio-border">
            {filteredPosts.map((post) => (
              <div
                key={post.id}
                className="py-4 first:pt-0 last:pb-0 space-y-3"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-16 h-11 rounded-md bg-black overflow-hidden border border-studio-border flex-shrink-0">
                      {post.coverUrl ? (
                        <img
                          src={post.coverUrl}
                          alt={post.mediaFileName}
                          className="w-full h-full object-cover"
                        />
                      ) : post.mediaUrl ? (
                        <video
                          src={post.mediaUrl}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                        />
                      ) : null}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusPill status={post.status} />
                        <span className="text-[11px] font-mono text-ink-muted">
                          {new Date(post.scheduledAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[13px] font-medium text-ink-primary line-clamp-1">
                        {post.globalCaption || post.mediaFileName}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {post.targetPlatforms.map((plat) => (
                          <PlatformBadge
                            key={plat}
                            platform={plat}
                            size="xs"
                            showName
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                    {post.publishedUrls &&
                      Object.entries(post.publishedUrls).map(([plat, url]) => (
                        <a
                          key={plat}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="h-8 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-medium inline-flex items-center gap-1.5"
                        >
                          <span>
                            {PLATFORM_CONFIGS[plat as keyof typeof PLATFORM_CONFIGS]
                              ?.shortName || plat}
                          </span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}

                    {(post.status === 'failed' ||
                      post.status === 'scheduled' ||
                      post.status === 'draft') && (
                      <Button
                        size="xs"
                        variant={post.status === 'failed' ? 'primary' : 'success'}
                        loading={activeId === post.id}
                        onClick={() => handleExecuteNow(post, false)}
                        icon={<Send className="w-3 h-3" />}
                      >
                        {post.status === 'failed'
                          ? 'Retry Live'
                          : 'Publish Now'}
                      </Button>
                    )}

                    <Link href={`/composer?clone=${encodeURIComponent(post.id)}`}>
                      <Button
                        size="xs"
                        variant="secondary"
                        icon={<Copy className="w-3 h-3" />}
                      >
                        Clone
                      </Button>
                    </Link>

                    <Button
                      size="xs"
                      variant="danger"
                      onClick={() => handleDelete(post.id)}
                      icon={<Trash2 className="w-3 h-3" />}
                    >
                      Remove
                    </Button>
                  </div>
                </div>

                {/* Per-platform Status & Error Breakdown */}
                {(post.errorMessage ||
                  (post.platformStatusNotes &&
                    Object.keys(post.platformStatusNotes).length > 0)) && (
                  <div className="p-3 rounded-lg bg-studio-subtle border border-studio-border space-y-1.5 text-xs">
                    {post.errorMessage && (
                      <p className="text-rose-600 flex items-center gap-2 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                        <span>{post.errorMessage}</span>
                      </p>
                    )}
                    {post.platformStatusNotes &&
                      Object.entries(post.platformStatusNotes).map(
                        ([plat, note]) => (
                          <p
                            key={plat}
                            className="text-ink-secondary flex items-center gap-2"
                          >
                            <Cloud className="w-3.5 h-3.5 text-status-cloud flex-shrink-0" />
                            <span>
                              <strong className="text-ink-primary uppercase">
                                {plat}:
                              </strong>{' '}
                              {note}
                            </span>
                          </p>
                        )
                      )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
