'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import CalendarView from '@/components/CalendarView';
import { ScheduledPost } from '@/lib/types';
import {
  Clock,
  Plus,
  Trash2,
  ExternalLink,
  Send,
  Copy,
  Calendar as CalendarIcon,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  PlatformBadge,
  StatusPill,
  Skeleton,
  useToast,
} from '@/components/ui';

export default function CalendarPage() {
  const { pushToast } = useToast();
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch('/api/posts');
      const data = await res.json();
      if (data.posts) setPosts(data.posts);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handlePublishNow = async (id: string) => {
    setPublishingId(id);
    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useNativeSchedule: false }),
      });
      const data = await res.json();
      pushToast({
        type: data.success ? 'success' : 'warning',
        title: data.message || 'Publish action completed',
      });
      fetchPosts();
    } catch {
      pushToast({ type: 'error', title: 'Failed to trigger publish' });
    } finally {
      setPublishingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this post from queue?')) return;
    try {
      const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not delete post');
      }
      pushToast({ type: 'success', title: 'Post removed from queue' });
      fetchPosts();
    } catch (err: unknown) {
      pushToast({
        type: 'error',
        title: err instanceof Error ? err.message : 'Could not delete post',
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Bar (Stitch Social Calendar & Scheduler) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-brand text-xs font-semibold uppercase tracking-wider">
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Campaign Operations</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-serif text-2xl sm:text-3xl font-medium text-content-primary tracking-tight">
              Social Calendar &amp; Scheduler
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Sync Active
            </span>
          </div>
          <p className="text-xs sm:text-sm text-content-secondary">
            Organize monthly, weekly, and daily posts with Metricool best-hours recommendations
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/publishing">
            <Button variant="secondary" size="sm">
              Publishing Queue
            </Button>
          </Link>
          <Link href="/composer">
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Schedule Post
            </Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-[460px] w-full rounded-xl" />
      ) : (
        <CalendarView
          posts={posts}
          onPostDeleted={fetchPosts}
          onPostUpdated={fetchPosts}
        />
      )}

      {/* Scheduled & Published Timeline Feed */}
      <Card className="space-y-4">
        <CardHeader
          icon={<Clock className="w-4 h-4 text-brand" />}
          title="Scheduled &amp; Published Timeline"
          subtitle="Quick actions for upcoming slots and recent dispatches"
          action={
            <span className="text-xs font-mono font-semibold text-content-muted">
              {posts.length} total posts
            </span>
          }
        />

        {posts.length === 0 ? (
          <EmptyState
            icon={<CalendarIcon className="w-5 h-5 text-ink-muted" />}
            title="Your planning calendar is empty"
            description="Upload a video and schedule it for peak engagement time (18:30 PKT) or save a draft."
            action={
              <Link href="/composer">
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Plus className="w-3.5 h-3.5" />}
                >
                  Create First Post
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="divide-y divide-studio-border">
            {posts.map((post) => {
              const dateStr = new Date(post.scheduledAt).toLocaleString(
                'en-US',
                {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                }
              );

              return (
                <div
                  key={post.id}
                  className="py-3.5 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-studio-subtle/60 p-2 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-14 h-10 rounded-lg bg-studio-subtle overflow-hidden flex-shrink-0 border border-studio-border">
                      {post.coverUrl ? (
                        <img
                          src={post.coverUrl}
                          alt="Thumb"
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

                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-ink-primary line-clamp-1">
                        {post.globalCaption || post.mediaFileName}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-ink-muted font-mono mt-0.5">
                        <span className="font-semibold text-ink-secondary">{dateStr}</span>
                        <span>•</span>
                        <span className="truncate">{post.mediaFileName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 justify-between md:justify-end">
                    <div className="flex items-center gap-1">
                      {post.targetPlatforms.map((plat) => (
                        <PlatformBadge key={plat} platform={plat} size="xs" />
                      ))}
                    </div>

                    <StatusPill status={post.status} />

                    {post.publishedUrls &&
                      Object.entries(post.publishedUrls).map(([plat, url]) => (
                        <a
                          key={plat}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="h-7 px-2 rounded-md bg-surface-container hover:bg-surface-high border border-border text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 text-[11px] font-bold"
                          title={`Open ${plat}`}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}

                    {(post.status === 'scheduled' ||
                      post.status === 'failed') && (
                      <Button
                        size="xs"
                        variant="success"
                        loading={publishingId === post.id}
                        onClick={() => handlePublishNow(post.id)}
                        icon={<Send className="w-3 h-3" />}
                      >
                        {post.status === 'failed' ? 'Retry' : 'Publish'}
                      </Button>
                    )}

                    <Link
                      href={`/composer?clone=${encodeURIComponent(post.id)}`}
                      className="h-7 w-7 rounded-md bg-surface-lowest hover:bg-surface-high border border-border text-content-secondary hover:text-content-primary inline-flex items-center justify-center transition-colors shadow-card"
                      title="Clone / Edit in Composer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Link>

                    <button
                      type="button"
                      onClick={() => handleDelete(post.id)}
                      className="h-7 w-7 rounded-md hover:bg-red-500/10 text-content-muted hover:text-red-600 dark:hover:text-red-400 inline-flex items-center justify-center transition-colors"
                      title="Delete post"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
