'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Plus,
  RefreshCw,
  Search,
  LogOut,
  Check,
  Sparkles,
  Sun,
  Moon,
  User,
} from 'lucide-react';
import { useAntigravityTheme } from '@/lib/useAntigravityTheme';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Studio Dashboard',
  '/publishing': 'Content Scheduler',
  '/calendar': 'Social Calendar',
  '/composer': 'Post Composer',
  '/media': 'Media Library',
  '/analytics': 'Analytics & Insights',
  '/reports': 'Reporting Studio',
  '/web-analytics': 'Web & Blog Pixel',
  '/competitors': 'Competitors & Hashtags',
  '/flows': 'Evergreen Flows',
  '/smartlinks': 'SmartLinks (Link-in-Bio)',
  '/connections': 'Connected Channels',
  '/settings': 'Settings & Admin',
};

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { isDark, toggleTheme } = useAntigravityTheme();
  const [brandName, setBrandName] = useState('ZCodeDev');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data?.settings?.brandName) setBrandName(data.settings.brandName);
      })
      .catch(() => {});
  }, [pathname]);

  const pageTitle = PAGE_TITLES[pathname] || 'Studio';

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncDone(false);
    try {
      await Promise.all([
        fetch('/api/accounts/auto-connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'sync_vault' }),
        }),
        fetch('/api/analytics', { method: 'POST' }),
      ]);
      setSyncDone(true);
      setTimeout(() => setSyncDone(false), 2500);
      router.refresh();
    } catch {
      // ignore
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/login');
    router.refresh();
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/publishing?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="h-[72px] flex-shrink-0 bg-surface/85 backdrop-blur-xl border-b border-border px-4 md:px-8 flex items-center justify-between gap-4 z-30 transition-colors duration-200">
      {/* Left: Page Title & Brand Badge */}
      <div className="min-w-0 flex items-center gap-3">
        <div className="lg:hidden w-8 h-8 rounded-xl bg-brand text-brand-contrast flex items-center justify-center shadow-soft">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex items-center gap-2.5">
          <h1 className="text-base md:text-lg font-bold tracking-tight text-content-primary leading-tight truncate">
            {pageTitle}
          </h1>
          <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full bg-brand-container text-brand text-[11px] font-semibold">
            Studio
          </span>
        </div>
      </div>

      {/* Center: Global Search */}
      <form
        onSubmit={handleSearchSubmit}
        className="hidden md:flex flex-1 max-w-md relative"
      >
        <Search className="w-4 h-4 text-content-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search posts, campaigns, tags..."
          className="w-full pl-10 pr-4 py-2 bg-surface-lowest border border-border rounded-xl text-xs text-content-primary placeholder:text-content-muted shadow-card focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all"
        />
      </form>

      {/* Right: Actions */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <button
          type="button"
          onClick={handleSync}
          disabled={isSyncing}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-lowest border border-border text-xs font-semibold text-content-primary hover:bg-surface-high transition-colors shadow-card disabled:opacity-60"
        >
          {syncDone ? (
            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <RefreshCw className={`w-3.5 h-3.5 text-content-secondary ${isSyncing ? 'animate-spin' : ''}`} />
          )}
          <span>{syncDone ? 'Synced' : isSyncing ? 'Syncing...' : 'Sync'}</span>
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="w-9 h-9 rounded-xl bg-surface-lowest border border-border flex items-center justify-center text-content-secondary hover:text-content-primary hover:bg-surface-high transition-colors shadow-card"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        <Link
          href="/composer"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand hover:bg-brand-hover active:bg-brand-active text-brand-contrast text-xs font-semibold shadow-soft transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Create Post</span>
        </Link>

        <div className="hidden xl:block h-6 w-px bg-border mx-0.5" />

        <div className="hidden xl:flex items-center gap-2">
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-brand text-brand-contrast flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-surface" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-content-primary leading-tight max-w-[100px] truncate">
              {brandName}
            </span>
            <span className="text-[10px] text-content-muted leading-tight">Online</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          title="Sign out"
          aria-label="Sign out"
          className="w-9 h-9 rounded-xl bg-surface-lowest border border-border flex items-center justify-center text-content-secondary hover:text-content-primary hover:bg-surface-high transition-colors shadow-card"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
