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
} from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/publishing': 'Content Scheduler',
  '/calendar': 'Calendar',
  '/composer': 'Composer',
  '/media': 'Media Library',
  '/analytics': 'Analytics',
  '/connections': 'Connections',
  '/settings': 'Settings',
};

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
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
    <header className="h-[68px] flex-shrink-0 bg-[#FAF6F1] border-b border-[#E7DFD5] px-4 md:px-7 flex items-center justify-between gap-4">
      {/* Left: Page Title & Greeting */}
      <div className="min-w-0 flex items-center gap-3">
        <div className="lg:hidden w-8 h-8 rounded-lg bg-[#F5DFCE] border border-[#EACBB4] flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-[#C27345]" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg md:text-xl font-bold tracking-tight text-[#1E1B18] leading-tight truncate">
            {pageTitle}
          </h1>
          <p className="text-xs text-[#6E655D] truncate">
            Welcome back, <span className="font-medium text-[#4E463F]">{brandName}</span>
          </p>
        </div>
      </div>

      {/* Center: Global Search */}
      <form
        onSubmit={handleSearchSubmit}
        className="hidden md:flex flex-1 max-w-md relative"
      >
        <Search className="w-4 h-4 text-[#8E847A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <Input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search posts, campaigns, channels..."
          className="pl-9 bg-[#F3EDE5] border-[#E2D9CE] focus:bg-white h-9 text-xs"
        />
      </form>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={isSyncing}
          className="hidden sm:inline-flex text-xs"
        >
          {syncDone ? (
            <Check className="w-3.5 h-3.5 text-[#3A8E63]" />
          ) : (
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          )}
          <span>{syncDone ? 'Synced' : isSyncing ? 'Syncing...' : 'Sync'}</span>
        </Button>

        <Button asChild size="sm" className="font-semibold">
          <Link href="/composer">
            <Plus className="w-4 h-4" />
            <span>New Post</span>
          </Link>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          title="Sign out"
          aria-label="Sign out"
          className="text-[#6E655D] hover:text-[#1E1B18]"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
