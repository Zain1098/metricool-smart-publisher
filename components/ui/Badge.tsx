import React from 'react';
import { cn, PLATFORM_CONFIGS } from '@/lib/utils';
import { PostStatus, SocialPlatform } from '@/lib/types';

export type BadgeTone =
  | 'neutral'
  | 'accent'
  | 'success'
  | 'cloud'
  | 'warning'
  | 'danger';

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-container text-content-secondary border-border',
  accent: 'bg-brand-container text-brand border-brand/25',
  success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
  cloud: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25',
  warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25',
  danger: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/25',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium whitespace-nowrap',
        TONE_CLASSES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

const POST_STATUS_META: Record<
  PostStatus,
  { label: string; tone: BadgeTone; dot: string }
> = {
  published: {
    label: 'Published',
    tone: 'success',
    dot: 'bg-emerald-500',
  },
  scheduled_on_platform: {
    label: 'Cloud Hold',
    tone: 'cloud',
    dot: 'bg-sky-500',
  },
  scheduled: {
    label: 'Scheduled',
    tone: 'accent',
    dot: 'bg-brand',
  },
  publishing: {
    label: 'Publishing',
    tone: 'warning',
    dot: 'bg-amber-500',
  },
  draft: {
    label: 'Draft',
    tone: 'neutral',
    dot: 'bg-slate-400',
  },
  failed: {
    label: 'Failed',
    tone: 'danger',
    dot: 'bg-red-500',
  },
};

export function StatusPill({
  status,
  className,
}: {
  status: PostStatus;
  className?: string;
}) {
  const meta = POST_STATUS_META[status] || POST_STATUS_META.draft;
  return (
    <Badge tone={meta.tone} className={className}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', meta.dot)} />
      <span>{meta.label}</span>
    </Badge>
  );
}

export function PlatformBadge({
  platform,
  size = 'sm',
  showName = false,
  muted = false,
}: {
  platform: SocialPlatform;
  size?: 'xs' | 'sm' | 'md';
  showName?: boolean;
  muted?: boolean;
}) {
  const cfg = PLATFORM_CONFIGS[platform];
  if (!cfg) return null;

  const boxSize =
    size === 'xs'
      ? 'w-4 h-4 text-[8px]'
      : size === 'md'
      ? 'w-6 h-6 text-[10px]'
      : 'w-5 h-5 text-[9px]';

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          'rounded font-mono font-semibold text-white inline-flex items-center justify-center flex-shrink-0 tracking-tight shadow-xs',
          boxSize
        )}
        style={{
          backgroundColor: muted ? '#94A3B8' : cfg.color,
          color: '#FFFFFF',
        }}
        title={cfg.name}
      >
        {cfg.shortName}
      </span>
      {showName && (
        <span className="text-xs font-medium text-slate-800">{cfg.name}</span>
      )}
    </span>
  );
}
