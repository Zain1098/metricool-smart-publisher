'use client';

import { useEffect, useState } from 'react';
import { SocialPlatform } from '@/lib/types';
import { cn, PLATFORM_CONFIGS } from '@/lib/utils';
import {
  Play,
  Image as ImageIcon,
  Eye,
  CheckCircle2,
  ShieldCheck,
  Heart,
  MessageCircle,
  Share2,
  Smartphone,
  Monitor,
  Info,
} from 'lucide-react';
import { PlatformBadge } from './ui';

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
  const [deviceView, setDeviceView] = useState<'mobile' | 'desktop'>('mobile');
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const cfg = PLATFORM_CONFIGS[activePlatform] || PLATFORM_CONFIGS.youtube;

  useEffect(() => {
    if (coverUrl) {
      setIsPlayingVideo(false);
    }
  }, [coverUrl]);

  const showCoverOverlay =
    Boolean(coverUrl) && (viewMode === 'cover' || !isPlayingVideo);

  return (
    <div className="bg-surface-lowest border border-border rounded-2xl shadow-xs overflow-hidden">
      {/* Metricool Preview Header Bar */}
      <div className="p-4 border-b border-border space-y-3 bg-surface-low/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Network Icon Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
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
                    'h-9 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border flex-shrink-0',
                    isCurr
                      ? 'bg-[#211832] text-white border-[#211832] shadow-2xs'
                      : 'bg-surface-lowest text-content-secondary hover:text-content-primary border-border'
                  )}
                >
                  <PlatformBadge platform={plat} size="xs" />
                  <span>{pCfg.shortName}</span>
                </button>
              );
            })}
          </div>

          {/* Mobile / Desktop Device Toggle (Metricool style) */}
          <div className="inline-flex rounded-xl bg-surface-lowest p-1 border border-border shadow-2xs">
            <button
              type="button"
              onClick={() => setDeviceView('mobile')}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                deviceView === 'mobile'
                  ? 'bg-[#211832] text-white'
                  : 'text-content-muted hover:text-content-primary'
              )}
              title="Mobile Preview"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDeviceView('desktop')}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                deviceView === 'desktop'
                  ? 'bg-[#211832] text-white'
                  : 'text-content-muted hover:text-content-primary'
              )}
              title="Desktop Feed Preview"
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Video vs Cover Switcher */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-content-secondary">
            {cfg.name} Post Preview
          </span>
          <div className="inline-flex rounded-xl bg-surface-lowest p-0.5 border border-border">
            <button
              type="button"
              onClick={() => {
                setViewMode('video');
                setIsPlayingVideo(true);
              }}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors',
                viewMode === 'video' && isPlayingVideo
                  ? 'bg-[#211832] text-white'
                  : 'text-content-secondary hover:text-content-primary'
              )}
            >
              <Play className="w-3 h-3" />
              <span>Video</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('cover');
                setIsPlayingVideo(false);
              }}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors',
                viewMode === 'cover' || (coverUrl && !isPlayingVideo)
                  ? 'bg-[#211832] text-white'
                  : 'text-content-secondary hover:text-content-primary'
              )}
            >
              <ImageIcon className="w-3 h-3" />
              <span>Cover</span>
            </button>
          </div>
        </div>
      </div>

      {/* Preview Body */}
      <div className="p-5 space-y-4 bg-surface-low/40">
        <div
          className={cn(
            'mx-auto bg-surface-lowest rounded-2xl border border-border shadow-sm overflow-hidden transition-all',
            deviceView === 'mobile' ? 'max-w-[310px]' : 'w-full'
          )}
        >
          {/* Social Card Header (Avatar + Brand Handle) */}
          <div className="px-4 py-3 flex items-center justify-between border-b border-border-subtle">
            <div className="flex items-center gap-2.5 min-w-0">
              {accountAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={accountAvatar}
                  alt={accountHandle}
                  className="w-8 h-8 rounded-full object-cover border border-border flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#211832] text-[#D8FF36] flex items-center justify-center text-xs font-bold flex-shrink-0">
                  Z
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-content-primary truncate">
                  {accountHandle}
                </p>
                <p className="text-[11px] text-content-muted">Just now • {cfg.shortName}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {isAiGenerated && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                  AI
                </span>
              )}
              {paidPromotion && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-bold">
                  Paid
                </span>
              )}
              <PlatformBadge platform={activePlatform} size="xs" />
            </div>
          </div>

          {/* Video / Cover Media Viewport */}
          <div
            className={cn(
              'relative w-full overflow-hidden bg-slate-950 flex items-center justify-center',
              deviceView === 'mobile' ? 'aspect-[9/14]' : 'aspect-video'
            )}
          >
            {showCoverOverlay && coverUrl ? (
              <div className="relative w-full h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverUrl}
                  alt="Cover preview over video"
                  className="w-full h-full object-cover"
                />
                {videoUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('video');
                      setIsPlayingVideo(true);
                    }}
                    aria-label="Play video preview"
                    className="absolute inset-0 flex flex-col items-center justify-center bg-black/25 hover:bg-black/35 transition-colors group"
                  >
                    <span className="w-12 h-12 rounded-full bg-surface-lowest/95 text-content-primary flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </span>
                    <span className="mt-2 px-3 py-1 rounded-full bg-black/70 text-white text-xs font-semibold">
                      Tap to play video
                    </span>
                  </button>
                )}
              </div>
            ) : videoUrl ? (
              <video
                key={videoUrl}
                src={videoUrl}
                poster={coverUrl || undefined}
                controls
                autoPlay={isPlayingVideo}
                playsInline
                preload="metadata"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center gap-2.5">
                <div className="w-12 h-12 rounded-2xl bg-surface-lowest/10 flex items-center justify-center">
                  <Eye className="w-5 h-5 text-slate-300" />
                </div>
                <span className="text-xs font-medium text-slate-300 leading-relaxed max-w-[200px]">
                  Upload a video or select a media file on the left to preview your post
                </span>
              </div>
            )}

            {/* Mobile Reels/Shorts Right Action Rail */}
            {(videoUrl || coverUrl) && deviceView === 'mobile' && (
              <div className="pointer-events-none absolute right-2.5 bottom-4 flex flex-col items-center gap-3 text-white drop-shadow">
                <div className="flex flex-col items-center">
                  <Heart className="w-4 h-4" />
                  <span className="text-[10px] font-semibold">1.2k</span>
                </div>
                <div className="flex flex-col items-center">
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-[10px] font-semibold">48</span>
                </div>
                <Share2 className="w-4 h-4" />
              </div>
            )}
          </div>

          {/* Caption, Title & First Comment Footer */}
          <div className="p-4 bg-surface-lowest space-y-2">
            {title && (
              <p className="text-xs font-bold text-content-primary line-clamp-2">
                {title}
              </p>
            )}

            <p className="text-xs text-content-secondary line-clamp-3 leading-relaxed whitespace-pre-line">
              {caption || 'Your post caption and hashtags will appear here...'}
            </p>

            {firstComment && (
              <div className="p-2.5 rounded-xl bg-surface-low border border-border text-xs text-content-secondary truncate">
                <strong className="text-content-primary">1st Comment:</strong>{' '}
                {firstComment}
              </div>
            )}

            {/* Social Interaction Bar */}
            <div className="pt-2.5 mt-1 border-t border-border-subtle flex items-center justify-between text-xs font-semibold text-content-muted">
              <span className="inline-flex items-center gap-1">
                <Heart className="w-3.5 h-3.5" /> Like
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5" /> Comment
              </span>
              <span className="inline-flex items-center gap-1">
                <Share2 className="w-3.5 h-3.5" /> Share
              </span>
            </div>
          </div>
        </div>

        {/* Metricool Light-Blue Approximation Notice Banner */}
        <div className="p-3.5 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] flex items-start gap-2.5 text-xs text-[#1E3A8A]">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <span>
            Previews are an approximation of how your post will look when published.
          </span>
        </div>

        {/* Pre-Flight Verification Checklist */}
        <div className="p-4 rounded-xl bg-surface-lowest border border-border space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold text-content-primary pb-2 border-b border-border-subtle">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Pre-Flight Check</span>
            </span>
            <span className="text-xs font-semibold text-content-muted">
              {selectedPlatforms.length} network(s)
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-content-secondary font-medium">Video Asset</span>
              <span
                className={cn(
                  'font-bold flex items-center gap-1',
                  videoUrl ? 'text-emerald-700' : 'text-rose-600'
                )}
              >
                {videoUrl ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Uploaded &amp; Ready</span>
                  </>
                ) : (
                  <span>Video required</span>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-content-secondary font-medium">Thumbnail Cover</span>
              <span
                className={cn(
                  'font-bold',
                  coverUrl ? 'text-emerald-700' : 'text-content-secondary'
                )}
              >
                {coverUrl ? 'Custom Cover Attached' : 'Auto frame (1.0s)'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-content-secondary font-medium">URL Shortener</span>
              <span className="font-bold text-content-primary">
                {shortenerEnabled ? 'Active' : 'Off'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
