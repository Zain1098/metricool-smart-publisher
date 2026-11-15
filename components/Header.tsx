'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  RefreshCw,
  Clock,
  Menu,
  X,
  Plus,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  Bell,
} from 'lucide-react';
import { ConnectedAccount } from '@/lib/types';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, getNavItemForPath } from './navigation';
import { useToast } from './ui/Toast';

export default function Header() {
  const pathname = usePathname();
  const { pushToast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [brandName, setBrandName] = useState('ZCodeDev');
  const [timezone, setTimezone] = useState('Asia/Karachi');
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          if (data.settings.brandName) setBrandName(data.settings.brandName);
          if (data.settings.timezone) setTimezone(data.settings.timezone);
        }
      })
      .catch(() => {});

    fetch('/api/accounts')
      .then((res) => res.json())
      .then((data) => {
        if (data.accounts) setAccounts(data.accounts);
      })
      .catch(() => {});

    setMobileMenuOpen(false);
  }, [pathname]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const [cronRes, verifyRes] = await Promise.all([
        fetch('/api/cron').then((r) => r.json()),
        fetch('/api/accounts/auto-connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'sync_vault' }),
        }).then((r) => r.json()),
      ]);
      if (verifyRes.accounts) setAccounts(verifyRes.accounts);
      pushToast({
        type: 'success',
        title: 'Channels & Scheduler Synced',
        description:
          verifyRes.message ||
          cronRes.message ||
          'Connected channels and scheduler queues successfully refreshed.',
      });
    } catch {
      pushToast({
        type: 'info',
        title: 'Sync completed',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const connectedAccounts = accounts.filter((a) => a.isConnected);

  // Top navigation tabs as in Metricool
  const topNavTabs = [
    { href: '/', label: 'Analytics' },
    { href: '/calendar', label: 'Planning' },
    { href: '/composer', label: 'Composer' },
    { href: '/publishing', label: 'Inbox & Queue' },
    { href: '/media', label: 'Media Library' },
    { href: '/connections', label: 'Connections' },
    { href: '/settings', label: 'Settings' },
  ];

  const isCurrentActive = (href: string) => {
    if (href === '/') return pathname === '/' || pathname === '/analytics';
    return pathname.startsWith(href);
  };

  return (
    <>
      <header className="h-[56px] px-4 sm:px-6 bg-[#0D1525] border-b border-[#1C273C] flex items-center justify-between gap-4 flex-shrink-0 z-30 select-none">
        {/* Left: Metricool Brand Logo + Brand Selector */}
        <div className="flex items-center gap-4 lg:gap-6 min-w-0">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0 group">
            {/* Metricool Authentic Stylized Emblem */}
            <div className="w-8 h-8 rounded-full bg-[#00D2B4] flex items-center justify-center text-[#0D1525] font-black text-lg tracking-tighter shadow-sm group-hover:scale-105 transition-transform">
              <span>m</span>
            </div>
            <div className="flex items-center">
              <span className="text-white font-bold text-[17px] tracking-tight">metricool</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#00D2B4] ml-0.5 mb-2.5" />
            </div>
          </Link>

          {/* Brand / Client Selector Dropdown */}
          <div className="relative hidden md:block">
            <button
              type="button"
              onClick={() => setBrandDropdownOpen((p) => !p)}
              className="flex items-center gap-2 h-8 px-2.5 rounded-md bg-[#172236] hover:bg-[#1E2C44] border border-[#25354F] text-slate-200 text-xs font-medium transition-colors"
            >
              <div className="w-4 h-4 rounded-full bg-[#00D2B4]/20 text-[#00D2B4] flex items-center justify-center text-[10px] font-bold">
                {brandName.charAt(0).toUpperCase()}
              </div>
              <span className="truncate max-w-[120px]">{brandName}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {brandDropdownOpen && (
              <div className="absolute top-10 left-0 w-56 rounded-lg bg-[#121A2B] border border-[#25354F] shadow-xl py-1 z-50">
                <div className="px-3 py-1.5 border-b border-[#25354F]/60">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Active Workspace</p>
                  <p className="text-xs font-bold text-white mt-0.5">{brandName} Studio</p>
                </div>
                <div className="p-1">
                  <div className="px-2.5 py-1.5 rounded text-xs text-[#00D2B4] font-medium bg-[#00D2B4]/10 flex items-center justify-between">
                    <span>{brandName}</span>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <Link
                    href="/settings"
                    onClick={() => setBrandDropdownOpen(false)}
                    className="block px-2.5 py-1.5 rounded text-xs text-slate-300 hover:bg-[#1C273C] hover:text-white transition-colors mt-1"
                  >
                    Manage Brands & Settings
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Horizontal Top Navigation Tabs (Metricool Standard) */}
          <nav className="hidden lg:flex items-center gap-1 h-[56px] ml-2">
            {topNavTabs.map((tab) => {
              const active = isCurrentActive(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    'relative h-[56px] px-3.5 flex items-center text-[13px] font-medium transition-colors',
                    active
                      ? 'text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
                  )}
                >
                  {tab.label}
                  {active && (
                    <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#00D2B4] rounded-t-full shadow-[0_0_8px_rgba(0,210,180,0.5)]" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Controls: Sync, Timezone, Pro Badge, and Create Post */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {/* Connected Channels Counter */}
          <Link
            href="/connections"
            className="hidden sm:flex items-center gap-1.5 h-8 px-2.5 rounded-full bg-[#172236] hover:bg-[#1E2C44] border border-[#25354F] text-[11px] text-slate-300 transition-colors"
            title="Connected social profiles"
          >
            <span className="w-2 h-2 rounded-full bg-[#00D2B4]" />
            <span>
              <strong className="text-white font-semibold">{connectedAccounts.length}</strong> / 8 Channels
            </span>
          </Link>

          {/* Timezone pill */}
          <div className="hidden xl:flex items-center gap-1.5 h-8 px-2.5 rounded-full bg-[#172236] border border-[#25354F] text-[11px] text-slate-400 font-mono">
            <Clock className="w-3.5 h-3.5 text-[#00D2B4]" />
            <span>{timezone.split('/')[1] || timezone}</span>
          </div>

          {/* Live Sync button */}
          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            className="h-8 px-2.5 sm:px-3 rounded-lg bg-[#172236] hover:bg-[#1E2C44] border border-[#25354F] text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-60"
            title="Refresh channel statistics & queue"
          >
            <RefreshCw
              className={cn(
                'w-3.5 h-3.5',
                isSyncing ? 'animate-spin text-[#00D2B4]' : 'text-[#00D2B4]'
              )}
            />
            <span className="hidden md:inline">
              {isSyncing ? 'Syncing...' : 'Sync Data'}
            </span>
          </button>

          {/* Metricool Primary Action: Create Post */}
          <Link
            href="/composer"
            className="h-8 px-3.5 rounded-lg bg-[#00D2B4] hover:bg-[#00BFA3] text-[#0D1525] text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all hover:shadow"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Create Post</span>
          </Link>

          {/* Mobile drawer toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="lg:hidden h-8 w-8 rounded-lg bg-[#172236] hover:bg-[#1E2C44] border border-[#25354F] text-slate-200 flex items-center justify-center flex-shrink-0"
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X className="w-4 h-4 text-[#00D2B4]" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-x-0 top-[56px] bottom-0 z-40 bg-[#0D1525]/95 backdrop-blur-md p-4 overflow-y-auto border-b border-[#1C273C]">
          <div className="space-y-1">
            {topNavTabs.map((tab) => {
              const active = isCurrentActive(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    active
                      ? 'bg-[#00D2B4]/15 text-[#00D2B4] font-semibold'
                      : 'text-slate-300 hover:bg-white/[0.05]'
                  )}
                >
                  <span>{tab.label}</span>
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-[#00D2B4]" />}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
