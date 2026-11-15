'use client';

import { SocialPlatform } from '@/lib/types';
import { cn, PLATFORM_CONFIGS } from '@/lib/utils';
import { Check } from 'lucide-react';
import { Card, CardHeader, PlatformBadge } from './ui';

interface PlatformSelectorProps {
  selectedPlatforms: SocialPlatform[];
  onTogglePlatform: (platform: SocialPlatform) => void;
  connectedPlatforms: SocialPlatform[];
}

export default function PlatformSelector({
  selectedPlatforms,
  onTogglePlatform,
  connectedPlatforms,
}: PlatformSelectorProps) {
  const allPlatforms = Object.keys(PLATFORM_CONFIGS) as SocialPlatform[];

  return (
    <Card padding="sm" className="space-y-3">
      <CardHeader
        title="Target Social Channels"
        subtitle="Select which networks receive this post simultaneously"
        action={
          <span className="text-[11px] font-mono text-slate-500 tabular-nums">
            <strong className="text-slate-800">{selectedPlatforms.length}</strong> selected • {connectedPlatforms.length} linked
          </span>
        }
        className="pb-2.5"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {allPlatforms.map((platformId) => {
          const config = PLATFORM_CONFIGS[platformId];
          const isSelected = selectedPlatforms.includes(platformId);
          const isConnected = connectedPlatforms.includes(platformId);

          return (
            <button
              key={platformId}
              type="button"
              onClick={() => onTogglePlatform(platformId)}
              className={cn(
                'relative p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between h-[72px] shadow-xs',
                isSelected
                  ? 'bg-[#E6FAF7] border-[#00D2B4] shadow-xs'
                  : 'bg-[#FFFFFF] border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              )}
            >
              <div className="flex items-center justify-between w-full">
                <PlatformBadge
                  platform={platformId}
                  size="xs"
                  muted={!isConnected && !isSelected}
                />
                {isSelected ? (
                  <span className="w-4 h-4 rounded-full bg-[#00D2B4] text-[#0D1525] flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                ) : (
                  <span className="w-4 h-4 rounded-full border border-slate-300" />
                )}
              </div>

              <div className="min-w-0">
                <p className={cn(
                  'text-[11px] font-bold truncate leading-tight',
                  isSelected ? 'text-[#00A38C]' : 'text-slate-800'
                )}>
                  {config.name}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span
                    className={cn(
                      'w-1.5 h-1.5 rounded-full flex-shrink-0',
                      isConnected ? 'bg-[#10B981]' : 'bg-slate-300'
                    )}
                  />
                  <span className="text-[10px] text-slate-400 truncate">
                    {isConnected ? 'Linked' : 'Not linked'}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
