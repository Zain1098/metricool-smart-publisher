'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  Send,
  PenSquare,
  FolderOpen,
  BarChart3,
  Link2,
  Settings,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/shadcn/badge';
import { Separator } from '@/components/ui/shadcn/separator';
import { ConnectedAccount, ScheduledPost } from '@/lib/types';

const PRIMARY_NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/publishing', label: 'Content Scheduler', icon: Send, badgeKey: 'posts' as const },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/composer', label: 'Composer', icon: PenSquare },
  { href: '/media', label: 'Media Library', icon: FolderOpen },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/connections', label: 'Connections', icon: Link2, badgeKey: 'accounts' as const },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [brandName, setBrandName] = useState('ZCodeDev');
  const [postsCount, setPostsCount] = useState<number | null>(null);
  const [connectedCount, setConnectedCount] = useState<number | null>(null);
  const [totalAccounts, setTotalAccounts] = useState<number>(8);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => {
        if (d?.settings?.brandName) setBrandName(d.settings.brandName);
      })
      .catch(() => {});

    fetch('/api/posts')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.posts)) setPostsCount((d.posts as ScheduledPost[]).length);
      })
      .catch(() => {});

    fetch('/api/accounts')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.accounts)) {
          const list = d.accounts as ConnectedAccount[];
          setTotalAccounts(list.length);
          setConnectedCount(list.filter((a) => a.isConnected).length);
        }
      })
      .catch(() => {});
  }, [pathname]);

  return (
    <>
      <aside className="hidden lg:flex w-[240px] flex-shrink-0 bg-[#F6F1EB] border-r border-[#E7DFD5] flex-col justify-between select-none">
        {/* Brand + Main Nav */}
        <div className="p-4 space-y-5 overflow-y-auto flex-1">
          <Link href="/" className="flex items-center gap-3 px-2 py-1 group">
            <div className="w-9 h-9 rounded-xl bg-[#EFE9E1] border border-[#E2D9CE] flex items-center justify-center shadow-xs group-hover:bg-[#F5DFCE] transition-colors">
              <Sparkles className="w-4 h-4 text-[#C27345]" />
            </div>
            <div className="min-w-0">
              <div className="text-[15px] font-bold tracking-tight text-[#1E1B18] truncate">
                {brandName}
              </div>
              <div className="text-[11px] font-medium text-[#6E655D] truncate">
                Social Planner Pro
              </div>
            </div>
          </Link>

          <nav className="space-y-1" aria-label="Main navigation">
            {PRIMARY_NAV.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);

              let badgeText: string | null = null;
              if (item.badgeKey === 'posts' && postsCount !== null) {
                badgeText = String(postsCount);
              } else if (item.badgeKey === 'accounts' && connectedCount !== null) {
                badgeText = `${connectedCount}/${totalAccounts}`;
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all',
                    isActive
                      ? 'bg-[#F5DFCE] text-[#8D451E] font-semibold shadow-xs border border-[#EACBB4]/70'
                      : 'text-[#4E463F] hover:bg-[#EFE9E1] hover:text-[#1E1B18] border border-transparent'
                  )}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={cn(
                        'w-4 h-4 flex-shrink-0',
                        isActive ? 'text-[#C27345]' : 'text-[#7C7268]'
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {badgeText && (
                    <Badge
                      variant={isActive ? 'peach' : 'outline'}
                      className="px-2 py-0 text-[10px] font-semibold tabular-nums"
                    >
                      {badgeText}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Utility Section */}
        <div className="p-4 pt-2 space-y-3">
          <Separator />
          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors',
              pathname.startsWith('/settings')
                ? 'bg-[#F5DFCE] text-[#8D451E] font-semibold'
                : 'text-[#4E463F] hover:bg-[#EFE9E1] hover:text-[#1E1B18]'
            )}
          >
            <Settings className="w-4 h-4 text-[#7C7268]" />
            <span>Settings</span>
          </Link>

          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-[#E7DFD5] text-[11px] font-medium text-[#4E463F]">
            <span className="w-2 h-2 rounded-full bg-[#3A8E63] flex-shrink-0" />
            <span className="truncate">Synced & Protected</span>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#F6F1EB]/95 backdrop-blur border-t border-[#E7DFD5] px-2 py-1.5 flex items-center justify-around"
      >
        {PRIMARY_NAV.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg text-[10px] font-medium',
                isActive ? 'text-[#8D451E] bg-[#F5DFCE]' : 'text-[#6E655D]'
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label.split(' ')[0]}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
