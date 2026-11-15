'use client';

import { useState } from 'react';
import { SocialPlatform } from '@/lib/types';
import { cn, PLATFORM_CONFIGS } from '@/lib/utils';
import {
  Play,
  Image as ImageIcon,
  Eye,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { Badge, Card, PlatformBadge, SegmentedTabs } from './ui';

interface PostPreviewCardProps {
  selectedPlatforms: SocialPlatform[];
  activePlatform: SocialPlatform;
  onSelectPlatform: (p: SocialPlatform) => void;
  videoUrl: string;
  coverUrl?: string;
  title?: string;
  caption: string;
  firstComment?: string;
  accountHandle?: string;
  accountAvatar?: string;
  isAiGenerated?: boolean;
  paidPromotion?: boolean;
  shortenerEnabled?: boolean;
}

export default function PostPreviewCard({
  selectedPlatforms,
  activePlatform,
  onSelectPlatform,
  videoUrl,
  coverUrl,
  title,
  caption,
  firstComment,
  accountHandle = '@zcodedev',
  accountAvatar,
  isAiGenerated,
  paidPromotion,
  shortenerEnabled,
}: PostPreviewCardProps) {
  const [viewMode, setViewMode] = useState<'video' | 'cover'>('video');
  const cfg = PLATFORM_CONFIGS[activePlatform] || PLATFORM_CONFIGS.youtube;

  return (
    <Card padding="sm" className="space-y-3.5">
      {/* Top Preview Controls */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-studio-border">
        <div className="flex items-center gap-1 overflow-x-auto">
          {(selectedPlatforms.length > 0
            ? selectedPlatforms
            : (['youtube'] as SocialPlatform[])
          ).map((plat) => {
            const pCfg = PLATFORM_CONFIGS[plat];
            const isCurr = plat === activePlatform;
            return (
              <button
                key={plat}
                type="button"
                onClick={() => onSelectPlatform(plat)}
                className={cn(
                  'h-7 px-2 rounded-md text-[11px] font-medium flex items-center gap-1.5 transition-colors border',
                  isCurr
                    ? 'bg-studio-hover text-ink-primary border-studio-borderStrong'
                    : 'bg-transparent text-ink-muted hover:text-ink-primary border-transparent'
                )}
              >
                <PlatformBadge platform={plat} size="xs" />
                <span>{pCfg.shortName}</span>
              </button>
            );
          })}
        </div>

        <SegmentedTabs
          size="xs"
          value={viewMode}
          onChange={setViewMode}
          items={[
            { id: 'video', label: 'Video', icon: <Play className="w-2.5 h-2.5" /> },
            { id: 'cover', label: 'Cover', icon: <ImageIcon className="w-2.5 h-2.5" /> },
          ]}
        />
      </div>

      {/* Authentic Mobile Device Preview Shell */}
      <div className="w-full max-w-[268px] mx-auto bg-[#07090D] rounded-[22px] p-2 shadow-modal border border-studio-borderStrong space-y-2">
        <div className="px-2.5 py-1.5 flex items-center justify-between bg-studio-shell rounded-t-[14px] border-b border-studio-border">
          <div className="flex items-center gap-1.5">
            <PlatformBadge platform={activePlatform} size="xs" />
            <span className="text-[11px] font-semibold text-ink-primary">
              {cfg.name}
            </span>
          </div>
          <span className="text-[10px] font-mono text-status-success">
            {viewMode === 'cover' ? 'Cover' : 'Player'}
          </span>
        </div>

        <div className="relative aspect-[9/14] rounded-xl overflow-hidden bg-black flex items-center justify-center">
          {viewMode === 'cover' && coverUrl ? (
            <img
              src={coverUrl}
              alt="Thumbnail Cover Preview"
              className="w-full h-full object-cover"
            />
          ) : videoUrl ? (
            <video
              key={videoUrl}
              src={videoUrl}
              poster={coverUrl || undefined}
              controls
              playsInline
              preload="auto"
              onLoadedData={(e) => {
                const v = e.currentTarget;
                if (v.currentTime === 0) {
                  v.currentTime = 1.0;
                }
              }}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-5 text-center gap-2">
              <Eye className="w-6 h-6 text-ink-muted" />
              <span className="text-[11px] text-ink-muted leading-snug">
                Upload or select a video to preview live playback and cover frame
              </span>
            </div>
          )}
        </div>

        <div className="p-2.5 rounded-b-[14px] bg-studio-shell border-t border-studio-border space-y-1.5">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              {accountAvatar && (
                <img
                  src={accountAvatar}
                  alt={accountHandle}
                  className="w-4 h-4 rounded-full object-cover flex-shrink-0"
                />
              )}
              <p className="text-[11px] font-semibold text-ink-primary truncate">
                {accountHandle}
              </p>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {isAiGenerated && (
                <Badge tone="warning" className="text-[9px] px-1 py-0">
                  AI
                </Badge>
              )}
              {paidPromotion && (
                <Badge tone="success" className="text-[9px] px-1 py-0">
                  Paid
                </Badge>
              )}
            </div>
          </div>

          {title && (
            <p className="text-[11px] font-semibold text-ink-primary line-clamp-1">
              {title}
            </p>
          )}

          <p className="text-[11px] text-ink-secondary line-clamp-2 leading-snug">
            {caption || 'Write your caption in the editor...'}
          </p>

          {firstComment && (
            <p className="text-[10px] text-accent-soft bg-studio-subtle px-2 py-1 rounded truncate">
              1st Comment: {firstComment}
            </p>
          )}
        </div>
      </div>

      {/* Pre-Flight Verification Checklist */}
      <div className="p-3 rounded-lg bg-studio-subtle border border-studio-border space-y-2">
        <div className="flex items-center justify-between text-xs font-medium text-ink-primary pb-2 border-b border-studio-border">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-status-success" />
            <span>Pre-Flight Check</span>
          </span>
          <span className="text-[11px] text-ink-muted font-mono">
            {selectedPlatforms.length} network(s)
          </span>
        </div>

        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">Video Asset</span>
            <span
              className={cn(
                'font-medium flex items-center gap-1',
                videoUrl ? 'text-status-success' : 'text-status-warning'
              )}
            >
              {videoUrl ? (
                <>
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Ready</span>
                </>
              ) : (
                <span>Missing file</span>
              )}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-ink-muted">Thumbnail Cover</span>
            <span
              className={cn(
                'font-medium',
                coverUrl ? 'text-status-success' : 'text-ink-secondary'
              )}
            >
              {coverUrl ? 'Custom Set' : 'Auto 1st Frame'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-ink-muted">AI Disclosure</span>
            <span
              className={cn(
                'font-medium',
                isAiGenerated ? 'text-status-warning' : 'text-ink-secondary'
              )}
            >
              {isAiGenerated ? 'Disclosed' : 'Standard'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-ink-muted">URL Shortener</span>
            <span
              className={cn(
                'font-medium',
                shortenerEnabled ? 'text-status-success' : 'text-ink-secondary'
              )}
            >
              {shortenerEnabled ? 'Active' : 'Off'}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
