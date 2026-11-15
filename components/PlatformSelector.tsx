'use client';

import { SocialPlatform, PlatformSpecificContent } from '@/lib/types';
import { cn, PLATFORM_CONFIGS } from '@/lib/utils';
import { Check, Plus } from 'lucide-react';
import { PlatformBadge } from './ui';

interface PlatformSelectorProps {
  selectedPlatforms: SocialPlatform[];
  onTogglePlatform: (platform: SocialPlatform) => void;
  connectedPlatforms: SocialPlatform[];
  platformOverrides?: Partial<Record<SocialPlatform, PlatformSpecificContent>>;
  onUpdateOverride?: (
    platform: SocialPlatform,
    content: Partial<PlatformSpecificContent>
  ) => void;
}

export default function PlatformSelector({
  selectedPlatforms,
  onTogglePlatform,
  connectedPlatforms,
  platformOverrides,
  onUpdateOverride,
}: PlatformSelectorProps) {
  const allPlatforms = Object.keys(PLATFORM_CONFIGS) as SocialPlatform[];

  const getFormatBadge = (platform: SocialPlatform): string => {
    const override = platformOverrides?.[platform];
    if (platform === 'youtube') {
      return (override?.postType || 'short') === 'video' ? 'VIDEO' : 'SHORT';
    }
    if (platform === 'instagram') {
      const pt = override?.postType || 'reel';
      return pt.toUpperCase();
    }
    if (platform === 'facebook') {
      return (override?.postType || 'reel') === 'video' ? 'VIDEO' : 'REEL';
    }
    if (platform === 'tiktok') return 'VIDEO';
    if (platform === 'twitter') return 'POST';
    if (platform === 'threads') return 'THREAD';
    if (platform === 'linkedin') return 'POST';
    if (platform === 'pinterest') return 'PIN';
    return 'POST';
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Select Social Networks &amp; Format
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Click a network to enable/disable it for this post. Active networks show their post format badge.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
            <strong className="text-slate-900">{selectedPlatforms.length}</strong> active •{' '}
            <span className="text-emerald-700 font-bold">{connectedPlatforms.length} linked</span>
          </span>
        </div>
      </div>

      {/* Metricool-style Network Pills Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {allPlatforms.map((platformId) => {
          const config = PLATFORM_CONFIGS[platformId];
          const isSelected = selectedPlatforms.includes(platformId);
          const isConnected = connectedPlatforms.includes(platformId);
          const formatLabel = getFormatBadge(platformId);

          return (
            <div
              key={platformId}
              className={cn(
                'relative rounded-xl border-2 transition-all flex flex-col justify-between p-3.5',
                isSelected
                  ? 'bg-[#F8FAFC] border-[#211832] shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300 opacity-75 hover:opacity-100'
              )}
            >
              <button
                type="button"
                onClick={() => onTogglePlatform(platformId)}
                className="w-full text-left flex items-start justify-between gap-2 focus:outline-none"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative flex-shrink-0">
                    <PlatformBadge
                      platform={platformId}
                      size="md"
                      muted={!isSelected}
                    />
                    <span
                      className={cn(
                        'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white',
                        isConnected ? 'bg-emerald-500' : 'bg-slate-300'
                      )}
                      title={isConnected ? 'Account Connected' : 'Not Connected'}
                    />
                  </div>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        'text-xs font-bold truncate',
                        isSelected ? 'text-slate-900' : 'text-slate-600'
                      )}
                    >
                      {config.name.replace(' (Twitter)', '')}
                    </p>
                    <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5">
                      {isConnected ? 'Connected' : 'Unlinked'}
                    </p>
                  </div>
                </div>

                {isSelected ? (
                  <span className="w-5 h-5 rounded-full bg-[#211832] text-[#D8FF36] flex items-center justify-center flex-shrink-0 shadow-xs">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                ) : (
                  <span className="w-5 h-5 rounded-full border border-slate-300 text-slate-400 flex items-center justify-center flex-shrink-0">
                    <Plus className="w-3 h-3" />
                  </span>
                )}
              </button>

              {/* Format Switcher Pill inside Selected Platform Card (Metricool style: YOUTUBE • SHORT / VIDEO) */}
              <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-500">
                  Format:
                </span>
                {isSelected &&
                onUpdateOverride &&
                (platformId === 'youtube' ||
                  platformId === 'instagram' ||
                  platformId === 'facebook') ? (
                  <select
                    value={
                      platformOverrides?.[platformId]?.postType ||
                      (platformId === 'youtube' ? 'short' : 'reel')
                    }
                    onChange={(e) => {
                      e.stopPropagation();
                      const val = e.target.value as any;
                      onUpdateOverride(platformId, {
                        postType: val,
                        isShortOrReel: val === 'short' || val === 'reel',
                      });
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="h-7 px-2 rounded-lg bg-[#211832] text-white text-[11px] font-bold tracking-wide uppercase cursor-pointer focus:outline-none"
                  >
                    {platformId === 'youtube' && (
                      <>
                        <option value="short">SHORT</option>
                        <option value="video">VIDEO</option>
                      </>
                    )}
                    {platformId === 'instagram' && (
                      <>
                        <option value="reel">REEL</option>
                        <option value="post">POST</option>
                        <option value="story">STORY</option>
                      </>
                    )}
                    {platformId === 'facebook' && (
                      <>
                        <option value="reel">REEL</option>
                        <option value="video">VIDEO</option>
                      </>
                    )}
                  </select>
                ) : (
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase',
                      isSelected
                        ? 'bg-slate-200 text-slate-800'
                        : 'bg-slate-100 text-slate-400'
                    )}
                  >
                    {formatLabel}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
