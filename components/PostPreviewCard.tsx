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
} from 'lucide-react';
import { PlatformBadge } from './ui';
import { Card, CardContent, CardHeader } from '@/components/ui/shadcn/card';
import { Badge } from '@/components/ui/shadcn/badge';

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
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const cfg = PLATFORM_CONFIGS[activePlatform] || PLATFORM_CONFIGS.youtube;

  // Whenever a new coverUrl is uploaded, show it over the video so the user sees it immediately
  useEffect(() => {
    if (coverUrl) {
      setIsPlayingVideo(false);
    }
  }, [coverUrl]);

  const showCoverOverlay = Boolean(coverUrl) && (viewMode === 'cover' || !isPlayingVideo);

  return (
    <Card className="border-[#E7DFD5] bg-white shadow-[0_2px_12px_rgba(30,27,24,0.05)]">
      <CardHeader className="p-4 pb-3 border-b border-[#EFE9E1] space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
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
                    'h-7 px-2.5 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-colors border flex-shrink-0',
                    isCurr
                      ? 'bg-[#F5DFCE] text-[#8D451E] border-[#EACBB4] font-semibold'
                      : 'bg-[#FAF6F1] text-[#6E655D] hover:text-[#1E1B18] border-[#E7DFD5]'
                  )}
                >
                  <PlatformBadge platform={plat} size="xs" />
                  <span>{pCfg.shortName}</span>
                </button>
              );
            })}
          </div>

          <div className="inline-flex rounded-lg bg-[#F5EFE8] p-0.5 border border-[#E7DFD5]">
            <button
              type="button"
              onClick={() => {
                setViewMode('video');
                setIsPlayingVideo(true);
              }}
              className={cn(
                'px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors',
                viewMode === 'video' && isPlayingVideo
                  ? 'bg-white text-[#1E1B18] shadow-xs'
                  : 'text-[#6E655D] hover:text-[#1E1B18]'
              )}
            >
              <Play className="w-3 h-3" />
              Video
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('cover');
                setIsPlayingVideo(false);
              }}
              className={cn(
                'px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors',
                viewMode === 'cover' || (coverUrl && !isPlayingVideo)
                  ? 'bg-white text-[#1E1B18] shadow-xs'
                  : 'text-[#6E655D] hover:text-[#1E1B18]'
              )}
            >
              <ImageIcon className="w-3 h-3" />
              Cover
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Responsive Authentic Mobile Device Frame */}
        <div className="w-full max-w-[285px] sm:max-w-[300px] mx-auto bg-[#1E1B18] rounded-[28px] p-2.5 shadow-[0_14px_32px_rgba(30,27,24,0.18)] border-2 border-[#3A342E]">
          {/* Phone Top Notch / Status Header */}
          <div className="px-3 py-2 flex items-center justify-between bg-white rounded-t-[18px] border-b border-[#EFE9E1]">
            <div className="flex items-center gap-1.5 min-w-0">
              <PlatformBadge platform={activePlatform} size="xs" />
              <span className="text-[11px] font-semibold text-[#1E1B18] truncate">
                {cfg.name} Preview
              </span>
            </div>
            <span className="text-[10px] font-medium text-[#3A8E63] bg-[#DCEAE2] px-2 py-0.5 rounded-full flex-shrink-0">
              {showCoverOverlay ? 'Cover' : 'Live Video'}
            </span>
          </div>

          {/* 9:14 Phone Viewport */}
          <div className="relative aspect-[9/14] w-full overflow-hidden bg-[#141210] flex items-center justify-center">
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
                    className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 hover:bg-black/30 transition-colors group"
                  >
                    <span className="w-12 h-12 rounded-full bg-white/95 text-[#1E1B18] flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </span>
                    <span className="mt-2 px-2.5 py-0.5 rounded-full bg-black/65 text-white text-[10px] font-medium">
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
              <div className="flex flex-col items-center justify-center p-6 text-center gap-2">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                  <Eye className="w-5 h-5 text-[#D6CBC0]" />
                </div>
                <span className="text-[11px] text-[#D6CBC0] leading-snug">
                  Upload a video or cover image to preview how it looks on mobile
                </span>
              </div>
            )}

            {/* Mobile Reels/Shorts Right Action Rail */}
            {(videoUrl || coverUrl) && (
              <div className="pointer-events-none absolute right-2 bottom-3 flex flex-col items-center gap-2.5 text-white drop-shadow">
                <div className="flex flex-col items-center">
                  <Heart className="w-4 h-4" />
                  <span className="text-[9px]">1.2k</span>
                </div>
                <div className="flex flex-col items-center">
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-[9px]">48</span>
                </div>
                <Share2 className="w-4 h-4" />
              </div>
            )}
          </div>

          {/* Phone Bottom Caption & Handle Bar */}
          <div className="p-3 rounded-b-[18px] bg-white border-t border-[#EFE9E1] space-y-1.5">
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                {accountAvatar && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={accountAvatar}
                    alt={accountHandle}
                    className="w-4 h-4 rounded-full object-cover flex-shrink-0"
                  />
                )}
                <p className="text-[11px] font-semibold text-[#1E1B18] truncate">
                  {accountHandle}
                </p>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {isAiGenerated && (
                  <Badge variant="lavender" className="text-[9px] px-1.5 py-0">
                    AI
                  </Badge>
                )}
                {paidPromotion && (
                  <Badge variant="peach" className="text-[9px] px-1.5 py-0">
                    Paid
                  </Badge>
                )}
              </div>
            </div>

            {title && (
              <p className="text-[11px] font-semibold text-[#1E1B18] line-clamp-1">
                {title}
              </p>
            )}

            <p className="text-[11px] text-[#4E463F] line-clamp-2 leading-snug">
              {caption || 'Write your caption in the editor...'}
            </p>

            {firstComment && (
              <p className="text-[10px] text-[#8D451E] bg-[#F5DFCE]/60 px-2 py-1 rounded-md truncate">
                1st Comment: {firstComment}
              </p>
            )}
          </div>
        </div>

        {/* Pre-Flight Verification Checklist */}
        <div className="p-3.5 rounded-xl bg-[#FAF6F1] border border-[#E7DFD5] space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-[#1E1B18] pb-2 border-b border-[#E7DFD5]">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#3A8E63]" />
              <span>Pre-Flight Check</span>
            </span>
            <span className="text-[11px] text-[#6E655D]">
              {selectedPlatforms.length} network(s)
            </span>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-[#6E655D]">Video Asset</span>
              <span
                className={cn(
                  'font-semibold flex items-center gap-1',
                  videoUrl ? 'text-[#3A8E63]' : 'text-[#A8582B]'
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
              <span className="text-[#6E655D]">Thumbnail Cover</span>
              <span
                className={cn(
                  'font-semibold',
                  coverUrl ? 'text-[#3A8E63]' : 'text-[#6E655D]'
                )}
              >
                {coverUrl ? 'Custom Cover Attached' : 'Auto frame'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#6E655D]">URL Shortener</span>
              <span className="font-semibold text-[#1E1B18]">
                {shortenerEnabled ? 'Active' : 'Off'}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
