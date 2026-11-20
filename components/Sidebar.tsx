'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  Building2,
  ChevronsUpDown,
  Sparkles,
  Menu,
  X,
  Plus,
  Search,
  FileText,
  Globe,
  Repeat,
  Radar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConnectedAccount, ScheduledPost } from '@/lib/types';

const PRIMARY_NAV = [
  { href: '/', label: 'Dashboard', shortLabel: 'Home', icon: LayoutDashboard },
  { href: '/publishing', label: 'Content Scheduler', shortLabel: 'Queue', icon: Send, badgeKey: 'posts' as const },
  { href: '/calendar', label: 'Social Calendar', shortLabel: 'Calendar', icon: CalendarDays },
  { href: '/composer', label: 'Post Composer', shortLabel: 'Compose', icon: PenSquare },
  { href: '/media', label: 'Media Library', shortLabel: 'Media', icon: FolderOpen },
  { href: '/analytics', label: 'Analytics & Insights', shortLabel: 'Analytics', icon: BarChart3 },
  { href: '/reports', label: 'Reporting Studio', shortLabel: 'Reports', icon: FileText },
  { href: '/web-analytics', label: 'Web Pixel', shortLabel: 'Pixel', icon: Globe },
  { href: '/competitors', label: 'Competitors & Tags', shortLabel: 'Compete', icon: Radar },
  { href: '/flows', label: 'Evergreen Flows', shortLabel: 'Flows', icon: Repeat },
  { href: '/smartlinks', label: 'SmartLinks', shortLabel: 'Bio', icon: Link2 },
  { href: '/connections', label: 'Connected Channels', shortLabel: 'Channels', icon: Link2, badgeKey: 'accounts' as const },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [brandName, setBrandName] = useState('ZCodeDev');
  const [postsCount, setPostsCount] = useState<number | null>(null);
  const [connectedCount, setConnectedCount] = useState<number | null>(null);
  const [totalAccounts, setTotalAccounts] = useState<number>(8);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState('');

  useEffect(() => {
    setMobileDrawerOpen(false);
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

  const handleMobileSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (mobileSearch.trim()) {
      setMobileDrawerOpen(false);
      router.push(`/publishing?q=${encodeURIComponent(mobileSearch.trim())}`);
    }
  };

  return (
    <>
      <aside className="hidden lg:flex w-[264px] flex-shrink-0 bg-surface-low border-r border-border flex-col justify-between select-none transition-colors duration-200">
        {/* Top Brand + Workspace + Navigation */}
        <div className="p-4 space-y-5 overflow-y-auto flex-1">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 px-2 py-1 group">
            <div className="w-9 h-9 rounded-xl bg-brand text-brand-contrast flex items-center justify-center shadow-soft group-hover:bg-brand-hover transition-colors">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[16px] font-bold tracking-tight text-content-primary leading-none truncate">
                {brandName}
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-brand mt-1 truncate">
                Social Planner Pro
              </div>
            </div>
          </Link>

          {/* Workspace Card (Stitch Studio Switcher) */}
          <div className="bg-surface-lowest border border-border rounded-xl p-2.5 flex items-center justify-between shadow-card">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-surface-high flex items-center justify-center text-content-secondary flex-shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-content-primary truncate">
                  Main Agency Studio
                </div>
                <div className="text-[11px] text-content-muted leading-none mt-0.5 truncate">
                  Pro Workspace
                </div>
              </div>
            </div>
            <ChevronsUpDown className="w-4 h-4 text-content-muted flex-shrink-0" />
          </div>

          {/* Primary Navigation */}
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
                    'flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-[13px] transition-all',
                    isActive
                      ? 'bg-brand-container text-brand font-semibold shadow-card border border-brand/20'
                      : 'text-content-secondary hover:bg-surface-high hover:text-content-primary font-medium border border-transparent'
                  )}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={cn(
                        'w-[18px] h-[18px] flex-shrink-0',
                        isActive ? 'text-brand' : 'text-content-muted'
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {badgeText && (
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-semibold tabular-nums',
                        isActive
                          ? 'bg-brand text-brand-contrast'
                          : 'bg-surface-high text-content-secondary border border-border'
                      )}
                    >
                      {badgeText}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Utility + Active Plan Card */}
        <div className="p-4 pt-2 space-y-3 border-t border-border-subtle">
          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] transition-all',
              pathname.startsWith('/settings')
                ? 'bg-brand-container text-brand font-semibold border border-brand/20'
                : 'text-content-secondary hover:bg-surface-high hover:text-content-primary font-medium'
            )}
          >
            <Settings
              className={cn(
                'w-[18px] h-[18px]',
                pathname.startsWith('/settings') ? 'text-brand' : 'text-content-muted'
              )}
            />
            <span>Settings &amp; Admin</span>
          </Link>

          <div className="bg-brand-container/70 border border-brand/15 rounded-xl p-3.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-on-container">
                Active Plan
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                Studio Tier
              </span>
            </div>
            <p className="text-[11px] text-content-secondary leading-snug">
              {connectedCount !== null
                ? `${connectedCount} / ${totalAccounts} Channels Syncing seamlessly`
                : 'Synced & Protected'}
            </p>
          </div>
        </div>
      </aside>

      {/* Stitch Mobile Bottom Navigation Bar (with elevated Compose CTA + full Menu drawer trigger) */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-low/95 backdrop-blur-xl border-t border-border px-2 py-1.5 flex items-center justify-around shadow-elevated"
      >
        <Link
          href="/"
          className={cn(
            'flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl text-[10px] font-medium transition-colors',
            pathname === '/' ? 'text-brand bg-brand-container font-semibold' : 'text-content-muted'
          )}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Home</span>
        </Link>

        <Link
          href="/calendar"
          className={cn(
            'flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl text-[10px] font-medium transition-colors',
            pathname.startsWith('/calendar') ? 'text-brand bg-brand-container font-semibold' : 'text-content-muted'
          )}
        >
          <CalendarDays className="w-4 h-4" />
          <span>Calendar</span>
        </Link>

        {/* Elevated Center Stitch Compose Button */}
        <Link
          href="/composer"
          aria-label="Create Post"
          className="flex flex-col items-center justify-center -mt-4"
        >
          <span className="w-11 h-11 rounded-2xl bg-brand text-brand-contrast flex items-center justify-center shadow-soft ring-4 ring-surface">
            <Plus className="w-5 h-5" />
          </span>
          <span className="text-[10px] font-semibold text-brand mt-0.5">Post</span>
        </Link>

        <Link
          href="/analytics"
          className={cn(
            'flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl text-[10px] font-medium transition-colors',
            pathname.startsWith('/analytics') ? 'text-brand bg-brand-container font-semibold' : 'text-content-muted'
          )}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Analytics</span>
        </Link>

        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className={cn(
            'flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl text-[10px] font-medium transition-colors',
            mobileDrawerOpen ||
              pathname.startsWith('/publishing') ||
              pathname.startsWith('/media') ||
              pathname.startsWith('/connections') ||
              pathname.startsWith('/settings')
              ? 'text-brand bg-brand-container font-semibold'
              : 'text-content-muted'
          )}
        >
          <Menu className="w-4 h-4" />
          <span>Menu</span>
        </button>
      </nav>

      {/* Mobile Full Slide-Over Navigation Drawer (All 8 Routes + Search) */}
      {mobileDrawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end"
          onClick={() => setMobileDrawerOpen(false)}
        >
          <div
            className="w-[min(300px,85vw)] h-full bg-surface-low border-l border-border p-4 flex flex-col justify-between overflow-y-auto shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-brand text-brand-contrast flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-content-primary">{brandName}</div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-brand">
                      Social Planner Pro
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  aria-label="Close menu"
                  className="w-8 h-8 rounded-lg bg-surface-lowest border border-border flex items-center justify-center text-content-secondary"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile Search */}
              <form onSubmit={handleMobileSearch} className="relative">
                <Search className="w-4 h-4 text-content-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={mobileSearch}
                  onChange={(e) => setMobileSearch(e.target.value)}
                  placeholder="Search posts, tags..."
                  className="w-full pl-9 pr-3 py-2 bg-surface-lowest border border-border rounded-xl text-xs text-content-primary"
                />
              </form>

              <div className="space-y-1">
                {PRIMARY_NAV.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileDrawerOpen(false)}
                      className={cn(
                        'flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all',
                        isActive
                          ? 'bg-brand-container text-brand font-semibold border border-brand/20'
                          : 'text-content-secondary hover:bg-surface-high hover:text-content-primary font-medium'
                      )}
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </span>
                    </Link>
                  );
                })}

                <Link
                  href="/settings"
                  onClick={() => setMobileDrawerOpen(false)}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs transition-all',
                    pathname.startsWith('/settings')
                      ? 'bg-brand-container text-brand font-semibold border border-brand/20'
                      : 'text-content-secondary hover:bg-surface-high hover:text-content-primary font-medium'
                  )}
                >
                  <Settings className="w-4 h-4" />
                  <span>Settings &amp; Admin</span>
                </Link>
              </div>
            </div>

            <div className="bg-brand-container/70 border border-brand/15 rounded-xl p-3 mt-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-on-container">
                  Active Plan
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  Studio Tier
                </span>
              </div>
              <p className="text-[11px] text-content-secondary mt-1">
                {connectedCount !== null
                  ? `${connectedCount} / ${totalAccounts} Channels Syncing`
                  : 'Synced & Protected'}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
