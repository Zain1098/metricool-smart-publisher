'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScheduledPost, PostStatus } from '@/lib/types';
import { cn, PLATFORM_CONFIGS } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Calendar as CalendarIcon,
  Trash2,
  ExternalLink,
  Sparkles,
  Cloud,
  Send,
  Copy,
  GripVertical,
} from 'lucide-react';
import {
  Button,
  Card,
  Modal,
  PlatformBadge,
  SegmentedTabs,
  StatusPill,
  useToast,
} from './ui';

type CalendarMode = 'month' | 'week' | 'day';

interface CalendarViewProps {
  posts: ScheduledPost[];
  onSelectSlot?: (dateTime: string) => void;
  onPostDeleted?: () => void;
  onPostUpdated?: () => void;
}

function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toLocalIsoInput(date: Date): string {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

const DAY_HOURS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];

export default function CalendarView({
  posts = [],
  onSelectSlot,
  onPostDeleted,
  onPostUpdated,
}: CalendarViewProps) {
  const router = useRouter();
  const { pushToast } = useToast();

  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());
  const [viewMode, setViewMode] = useState<CalendarMode>('week');
  const [statusFilter, setStatusFilter] = useState<'all' | PostStatus>('all');
  const [activeModalPost, setActiveModalPost] = useState<ScheduledPost | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Drag-and-drop state
  const [draggedPostId, setDraggedPostId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const postsByDateKey = useMemo(() => {
    const map = new Map<string, ScheduledPost[]>();
    for (const p of posts) {
      if (!p.scheduledAt) continue;
      if (statusFilter !== 'all' && p.status !== statusFilter) continue;
      const d = new Date(p.scheduledAt);
      if (isNaN(d.getTime())) continue;
      const key = toLocalDateKey(d);
      const list = map.get(key) || [];
      list.push(p);
      map.set(key, list);
    }
    map.forEach((arr) => {
      arr.sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      );
    });
    return map;
  }, [posts, statusFilter]);

  const filteredPosts = useMemo(() => {
    if (statusFilter === 'all') return posts;
    return posts.filter((p) => p.status === statusFilter);
  }, [posts, statusFilter]);

  const weekDays = useMemo(() => {
    const d = new Date(anchorDate);
    const dayOfWeek = d.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    d.setDate(d.getDate() + diffToMonday);
    d.setHours(0, 0, 0, 0);

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const cur = new Date(d);
      cur.setDate(cur.getDate() + i);
      days.push(cur);
    }
    return days;
  }, [anchorDate]);

  const monthGridDays = useMemo(() => {
    const year = anchorDate.getFullYear();
    const month = anchorDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const start = new Date(firstDay);
    start.setDate(start.getDate() - start.getDay());

    const end = new Date(lastDay);
    if (end.getDay() !== 6) {
      end.setDate(end.getDate() + (6 - end.getDay()));
    }

    const days: Date[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      days.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }, [anchorDate]);

  const headerTitle = useMemo(() => {
    if (viewMode === 'month') {
      return anchorDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
    }
    if (viewMode === 'week') {
      const first = weekDays[0];
      const last = weekDays[6];
      const sameMonth = first.getMonth() === last.getMonth();
      if (sameMonth) {
        return `${first.toLocaleDateString('en-US', {
          month: 'short',
        })} ${first.getDate()} - ${last.getDate()}, ${first.getFullYear()}`;
      }
      return `${first.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })} - ${last.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`;
    }
    return anchorDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [anchorDate, viewMode, weekDays]);

  const handleNavigate = (direction: -1 | 0 | 1) => {
    if (direction === 0) {
      setAnchorDate(new Date());
      return;
    }
    const d = new Date(anchorDate);
    if (viewMode === 'month') {
      d.setMonth(d.getMonth() + direction);
    } else if (viewMode === 'week') {
      d.setDate(d.getDate() + direction * 7);
    } else {
      d.setDate(d.getDate() + direction);
    }
    setAnchorDate(d);
  };

  const getPostsForDate = (date: Date): ScheduledPost[] => {
    return postsByDateKey.get(toLocalDateKey(date)) || [];
  };

  const handleSlotClick = (date: Date, hour = 18, minute = 30) => {
    const target = new Date(date);
    target.setHours(hour, minute, 0, 0);
    const localISO = toLocalIsoInput(target);
    if (onSelectSlot) {
      onSelectSlot(localISO);
    } else {
      router.push(`/composer?date=${encodeURIComponent(localISO)}`);
    }
  };

  const handleDropOnDate = async (targetDate: Date, targetHour?: number) => {
    setDragOverKey(null);
    if (!draggedPostId) return;
    const post = posts.find((p) => p.id === draggedPostId);
    setDraggedPostId(null);
    if (!post) return;

    if (post.status === 'published' || post.status === 'scheduled_on_platform') {
      pushToast({
        type: 'warning',
        title: 'Reschedule blocked',
        description:
          post.status === 'published'
            ? 'Published posts cannot be moved to another date.'
            : 'Posts already held on YouTube/Meta servers cannot be moved locally.',
      });
      return;
    }

    const oldDate = new Date(post.scheduledAt);
    const updatedDate = new Date(targetDate);
    updatedDate.setHours(
      typeof targetHour === 'number' ? targetHour : oldDate.getHours(),
      typeof targetHour === 'number' ? 0 : oldDate.getMinutes(),
      0,
      0
    );

    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: updatedDate.toISOString() }),
      });
      if (!res.ok) throw new Error('Failed to reschedule');
      pushToast({
        type: 'success',
        title: 'Post rescheduled',
        description: `Moved to ${updatedDate.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}`,
      });
      if (onPostUpdated) onPostUpdated();
      else if (onPostDeleted) onPostDeleted();
      else router.refresh();
    } catch {
      pushToast({ type: 'error', title: 'Failed to reschedule' });
    }
  };

  const handleDeletePost = async (id: string) => {
    if (!confirm('Remove this post from your schedule?')) return;
    setIsDeleting(true);
    try {
      await fetch(`/api/posts/${id}`, { method: 'DELETE' });
      setActiveModalPost(null);
      pushToast({ type: 'success', title: 'Post removed from calendar' });
      if (onPostDeleted) onPostDeleted();
      else router.refresh();
    } catch {
      pushToast({ type: 'error', title: 'Delete failed' });
    } finally {
      setIsDeleting(false);
    }
  };

  const todayKey = toLocalDateKey(new Date());

  const renderEventCard = (post: ScheduledPost, compact = false) => {
    const canDrag =
      post.status === 'scheduled' ||
      post.status === 'draft' ||
      post.status === 'failed';
    const timeStr = new Date(post.scheduledAt).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    return (
      <div
        key={post.id}
        draggable={canDrag}
        onDragStart={(e) => {
          setDraggedPostId(post.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragEnd={() => {
          setDraggedPostId(null);
          setDragOverKey(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
          setActiveModalPost(post);
        }}
        className={cn(
          'group rounded-lg bg-[#FFFFFF] border border-slate-200 hover:border-[#00D2B4] p-2 cursor-pointer transition-all shadow-xs space-y-1.5',
          canDrag && 'cursor-grab active:cursor-grabbing',
          draggedPostId === post.id && 'opacity-50'
        )}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-500 tabular-nums font-semibold">
            {canDrag && (
              <GripVertical className="w-2.5 h-2.5 text-[#6E655D] opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
            <Clock className="w-2.5 h-2.5 text-[#00D2B4]" />
            {timeStr}
          </span>
          <StatusPill status={post.status} className="text-[9px] px-1.5 py-0" />
        </div>

        {!compact && post.coverUrl && (
          <div className="w-full h-14 rounded overflow-hidden bg-slate-900 border border-slate-200">
            <img
              src={post.coverUrl}
              alt="Post cover"
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <p className="text-[11px] font-bold text-slate-800 line-clamp-1 group-hover:text-[#00A38C] transition-colors">
          {post.globalCaption || post.mediaFileName}
        </p>

        <div className="flex items-center gap-1 flex-wrap">
          {post.targetPlatforms.map((plat) => (
            <PlatformBadge key={plat} platform={plat} size="xs" />
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <Card className="space-y-4">
        {/* Calendar Toolbar */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-3.5 border-b border-slate-200">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-[#00D2B4]" />
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                {headerTitle}
              </h2>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => handleNavigate(-1)}
                aria-label="Previous period"
                className="p-1.5 rounded-md hover:bg-slate-200 text-slate-600 hover:text-slate-900"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleNavigate(0)}
                className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded-md"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleNavigate(1)}
                aria-label="Next period"
                className="p-1.5 rounded-md hover:bg-slate-200 text-slate-600 hover:text-slate-900"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <span className="text-[11px] font-mono font-medium text-slate-500">
              {filteredPosts.length} post{filteredPosts.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SegmentedTabs
              size="xs"
              value={statusFilter}
              onChange={setStatusFilter}
              items={[
                { id: 'all', label: 'All' },
                { id: 'scheduled', label: 'Scheduled' },
                { id: 'scheduled_on_platform', label: 'Cloud Hold' },
                { id: 'published', label: 'Published' },
                { id: 'failed', label: 'Failed' },
                { id: 'draft', label: 'Draft' },
              ]}
            />

            <SegmentedTabs
              size="xs"
              value={viewMode}
              onChange={setViewMode}
              items={[
                { id: 'month', label: 'Month' },
                { id: 'week', label: 'Week' },
                { id: 'day', label: 'Day' },
              ]}
            />
          </div>
        </div>

        {/* Drag Hint & Optimal Window Legend */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#00A38C] bg-[#E6FAF7] px-2 py-0.5 rounded-full border border-[#7FE8D9]">
              <span className="w-2 h-2 rounded-full bg-[#00D2B4]" />
              <span>Metricool Peak Window: 18:30 PKT</span>
            </span>
            <span className="hidden sm:inline text-[#4E463F]">•</span>
            <span className="hidden sm:inline">
              Drag posts to any date cell to reschedule automatically
            </span>
          </div>
        </div>

        {/* VIEW 1: WEEKLY GRID */}
        {viewMode === 'week' && (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-2.5">
            {weekDays.map((date) => {
              const key = toLocalDateKey(date);
              const isToday = key === todayKey;
              const isDragTarget = dragOverKey === key;
              const dayPosts = getPostsForDate(date);

              return (
                <div
                  key={key}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverKey !== key) setDragOverKey(key);
                  }}
                  onDragLeave={() => {
                    if (dragOverKey === key) setDragOverKey(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDropOnDate(date);
                  }}
                  className={cn(
                    'min-h-[220px] rounded-xl p-2.5 border flex flex-col justify-between transition-all',
                    isDragTarget
                      ? 'bg-[#E6FAF7] border-[#00D2B4]'
                      : isToday
                      ? 'bg-emerald-50/40 border-[#00D2B4] shadow-xs'
                      : 'bg-[#FFFFFF] border-slate-200 hover:border-slate-300'
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <span
                        className={cn(
                          'text-[11px] font-bold uppercase tracking-wider',
                          isToday ? 'text-[#00A38C]' : 'text-slate-500'
                        )}
                      >
                        {date.toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                      <span
                        className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold',
                          isToday
                            ? 'bg-[#00D2B4] text-[#0D1525]'
                            : 'text-slate-700'
                        )}
                      >
                        {date.getDate()}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSlotClick(date, 18, 30)}
                      className="w-full py-1 px-2 rounded-md bg-[#E6FAF7] hover:bg-[#D4F7F2] border border-[#7FE8D9] flex items-center justify-between text-[10px] font-bold text-[#00A38C] transition-colors"
                    >
                      <span>18:30 Peak</span>
                      <Sparkles className="w-2.5 h-2.5 text-[#00D2B4]" />
                    </button>

                    <div className="space-y-1.5">
                      {dayPosts.map((post) => renderEventCard(post, false))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSlotClick(date)}
                    className="w-full mt-2.5 py-1.5 rounded-lg border border-dashed border-slate-300 hover:border-[#00D2B4] text-[11px] text-slate-500 hover:text-[#00A38C] flex items-center justify-center gap-1 transition-colors bg-slate-50/50 hover:bg-[#E6FAF7]"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Post</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* VIEW 2: MONTHLY GRID */}
        {viewMode === 'month' && (
          <div className="space-y-2">
            <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-7 gap-1.5">
              {monthGridDays.map((date) => {
                const key = toLocalDateKey(date);
                const inCurrentMonth =
                  date.getMonth() === anchorDate.getMonth();
                const isToday = key === todayKey;
                const isDragTarget = dragOverKey === key;
                const dayPosts = getPostsForDate(date);

                return (
                  <div
                    key={key}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverKey !== key) setDragOverKey(key);
                    }}
                    onDragLeave={() => {
                      if (dragOverKey === key) setDragOverKey(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDropOnDate(date);
                    }}
                    className={cn(
                      'min-h-[118px] rounded-lg p-2 border flex flex-col justify-between transition-colors',
                      isDragTarget
                        ? 'bg-[#E6FAF7] border-[#00D2B4]'
                        : isToday
                        ? 'bg-emerald-50/50 border-[#00D2B4]'
                        : inCurrentMonth
                        ? 'bg-[#FFFFFF] border-slate-200 hover:border-slate-300'
                        : 'bg-slate-50/60 border-slate-200/60 opacity-60'
                    )}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            'text-[11px] font-mono font-bold w-5 h-5 rounded-full flex items-center justify-center',
                            isToday
                              ? 'bg-[#00D2B4] text-[#0D1525]'
                              : 'text-slate-700'
                          )}
                        >
                          {date.getDate()}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSlotClick(date)}
                          aria-label={`Schedule on ${key}`}
                          className="p-0.5 rounded text-[#6E655D] hover:text-slate-800 hover:bg-slate-100"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="space-y-1">
                        {dayPosts.slice(0, 2).map((p) => renderEventCard(p, true))}
                        {dayPosts.length > 2 && (
                          <button
                            type="button"
                            onClick={() => {
                              setAnchorDate(date);
                              setViewMode('day');
                            }}
                            className="w-full text-left px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-mono text-slate-700 hover:bg-slate-200 font-semibold"
                          >
                            +{dayPosts.length - 2} more
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW 3: DAILY HOURLY TIMELINE */}
        {viewMode === 'day' && (
          <div className="space-y-2">
            {DAY_HOURS.map((hour) => {
              const slotKey = `${toLocalDateKey(anchorDate)}_${hour}`;
              const isPeak = hour === 18;
              const slotPosts = getPostsForDate(anchorDate).filter((p) => {
                const h = new Date(p.scheduledAt).getHours();
                return h >= hour && h < hour + 2;
              });
              const isDragTarget = dragOverKey === slotKey;

              return (
                <div
                  key={hour}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverKey !== slotKey) setDragOverKey(slotKey);
                  }}
                  onDragLeave={() => {
                    if (dragOverKey === slotKey) setDragOverKey(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDropOnDate(anchorDate, hour);
                  }}
                  className={cn(
                    'p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors',
                    isDragTarget
                      ? 'bg-[#E6FAF7] border-[#00D2B4]'
                      : isPeak
                      ? 'bg-[#E6FAF7]/40 border-[#7FE8D9]'
                      : 'bg-[#FFFFFF] border-slate-200 hover:border-slate-300'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-14 text-xs font-mono font-bold text-slate-600">
                      {String(hour).padStart(2, '0')}:00
                    </span>
                    {isPeak && (
                      <span className="text-[10px] font-bold text-[#00A38C] bg-[#E6FAF7] px-2 py-0.5 rounded-full border border-[#7FE8D9] flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5 text-[#00D2B4]" />
                        Metricool Peak Window
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-1 justify-end flex-wrap">
                    {slotPosts.map((post) => renderEventCard(post, true))}
                    <button
                      type="button"
                      onClick={() => handleSlotClick(anchorDate, hour, 0)}
                      className="h-7 px-2.5 rounded-md border border-dashed border-slate-300 hover:border-[#00D2B4] text-xs font-semibold text-slate-500 hover:text-[#00A38C] flex items-center gap-1 transition-colors bg-slate-50/50"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Schedule at {hour}:00</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Post Details & Management Modal */}
      {activeModalPost && (
        <Modal
          open={!!activeModalPost}
          onClose={() => setActiveModalPost(null)}
          title="Scheduled Video Post"
          subtitle={`Scheduled for ${new Date(
            activeModalPost.scheduledAt
          ).toLocaleString()}`}
          badge={<StatusPill status={activeModalPost.status} />}
          footer={
            <>
              <div className="flex items-center gap-2">
                <Button
                  size="xs"
                  variant="danger"
                  disabled={isDeleting}
                  onClick={() => handleDeletePost(activeModalPost.id)}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  <span>Delete</span>
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() => setActiveModalPost(null)}
                >
                  Close
                </Button>
                <Button
                  size="xs"
                  variant="primary"
                  onClick={() => {
                    const id = activeModalPost.id;
                    setActiveModalPost(null);
                    router.push(`/composer?edit=${id}`);
                  }}
                >
                  Edit in Composer
                </Button>
              </div>
            </>
          }
        >
          <div className="space-y-4">
            {activeModalPost.coverUrl && (
              <div className="w-full h-48 rounded-xl overflow-hidden bg-slate-900 border border-slate-200">
                <img
                  src={activeModalPost.coverUrl}
                  alt="Post Cover"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#6E655D]">
                Caption
              </label>
              <p className="mt-1 text-xs text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-200 whitespace-pre-wrap leading-relaxed">
                {activeModalPost.globalCaption || 'No caption provided.'}
              </p>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="font-semibold text-slate-700">Target Platforms</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {activeModalPost.targetPlatforms.map((plat) => (
                  <PlatformBadge key={plat} platform={plat} showName />
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
