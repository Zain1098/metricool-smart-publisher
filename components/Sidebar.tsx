'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import {
  Globe,
  Share2,
  Plus,
  CheckCircle2,
  BarChart2,
  Layers,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { ConnectedAccount } from '@/lib/types';
import { cn, PLATFORM_CONFIGS } from '@/lib/utils';

export const SOCIAL_CHANNELS = [
  { id: 'all', label: 'Summary', icon: BarChart2, color: '#00D2B4' },
  { id: 'website', label: 'Website & Blog', icon: Globe, color: '#596CF2' },
  { id: 'facebook', label: 'Facebook', icon: null, color: '#1877F2' },
  { id: 'instagram', label: 'Instagram', icon: null, color: '#E4405F' },
  { id: 'twitter', label: 'Twitter / X', icon: null, color: '#0F1419' },
  { id: 'linkedin', label: 'LinkedIn', icon: null, color: '#0A66C2' },
  { id: 'tiktok', label: 'TikTok', icon: null, color: '#000000' },
  { id: 'youtube', label: 'YouTube', icon: null, color: '#FF0000' },
  { id: 'pinterest', label: 'Pinterest', icon: null, color: '#BD081C' },
  { id: 'twitch', label: 'Twitch', icon: null, color: '#9146FF' },
];

function SidebarContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentNetwork = searchParams.get('network') || 'all';

  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [brandName, setBrandName] = useState('ZCodeDev');

  useEffect(() => {
    fetch('/api/accounts')
      .then((res) => res.json())
      .then((data) => {
        if (data.accounts) setAccounts(data.accounts);
      })
      .catch(() => {});

    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data?.settings?.brandName) setBrandName(data.settings.brandName);
      })
      .catch(() => {});
  }, [pathname]);

  const connectedMap = new Map(
    accounts.map((acc) => [acc.platform, acc.isConnected])
  );

  const handleSelectNetwork = (channelId: string) => {
    // If on analytics or home, switch network parameter
    if (pathname === '/' || pathname === '/analytics') {
      const params = new URLSearchParams(searchParams.toString());
      if (channelId === 'all') {
        params.delete('network');
      } else {
        params.set('network', channelId);
      }
      router.push(`${pathname}?${params.toString()}`);
    } else {
      // Navigate to analytics with selected channel
      if (channelId === 'all') {
        router.push('/analytics');
      } else {
        router.push(`/analytics?network=${channelId}`);
      }
    }
  };

  const isAnalyticsContext = pathname === '/' || pathname === '/analytics';

  return (
    <aside className="hidden lg:flex w-[230px] flex-shrink-0 bg-[#FFFFFF] border-r border-[#E2E8F0] flex-col justify-between select-none">
      {/* Top Channel Navigation Rail */}
      <div className="p-3 space-y-4 overflow-y-auto flex-1">
        <div>
          <div className="px-2.5 py-1.5 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Channels & Networks
            </span>
            <span className="text-[10px] font-semibold text-[#00D2B4] bg-[#00D2B4]/10 px-1.5 py-0.5 rounded">
              Active
            </span>
          </div>

          <div className="mt-1.5 space-y-0.5">
            {SOCIAL_CHANNELS.map((ch) => {
              const isSelected = isAnalyticsContext && currentNetwork === ch.id;
              const isConnected = ch.id === 'all' || ch.id === 'website' || connectedMap.get(ch.id as any);
              const Icon = ch.icon;

              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => handleSelectNetwork(ch.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all group text-left',
                    isSelected
                      ? 'bg-[#E6FAF7] text-[#00A38C] font-semibold shadow-xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {Icon ? (
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-white"
                        style={{ backgroundColor: ch.color }}
                      >
                        <Icon className="w-3.5 h-3.5 stroke-[2.5]" />
                      </div>
                    ) : (
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold shadow-xs"
                        style={{ backgroundColor: ch.color }}
                      >
                        {ch.label.charAt(0)}
                      </div>
                    )}
                    <span className="truncate">{ch.label}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {isConnected && ch.id !== 'all' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" title="Connected" />
                    )}
                    {isSelected && (
                      <span className="w-1 h-3.5 bg-[#00D2B4] rounded-full ml-1" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Workspace Quick Links */}
        <div className="pt-2 border-t border-slate-100">
          <div className="px-2.5 py-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Workspace
            </span>
          </div>
          <div className="mt-1 space-y-0.5">
            <Link
              href="/calendar"
              className={cn(
                'flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors',
                pathname === '/calendar'
                  ? 'bg-[#E6FAF7] text-[#00A38C] font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <span>Content Calendar</span>
            </Link>
            <Link
              href="/composer"
              className={cn(
                'flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors',
                pathname === '/composer'
                  ? 'bg-[#E6FAF7] text-[#00A38C] font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <span>Post Composer</span>
            </Link>
            <Link
              href="/publishing"
              className={cn(
                'flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors',
                pathname === '/publishing'
                  ? 'bg-[#E6FAF7] text-[#00A38C] font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <span>Publishing Queue</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom Connect Platform Callout */}
      <div className="p-3 border-t border-[#E2E8F0] bg-slate-50/50">
        <Link
          href="/connections"
          className="flex items-center justify-between p-2.5 rounded-lg bg-[#FFFFFF] border border-[#E2E8F0] hover:border-[#00D2B4] text-slate-700 text-xs font-medium shadow-xs transition-all group"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#00D2B4]/15 text-[#00A38C] flex items-center justify-center">
              <Share2 className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-slate-800">Add Network</span>
          </div>
          <Plus className="w-4 h-4 text-slate-400 group-hover:text-[#00D2B4] transition-colors" />
        </Link>
      </div>
    </aside>
  );
}

export default function Sidebar() {
  return (
    <Suspense
      fallback={
        <aside className="hidden lg:flex w-[240px] flex-shrink-0 bg-[#FFFFFF] border-r border-[#E2E8F0]" />
      }
    >
      <SidebarContent />
    </Suspense>
  );
}
