'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { ToastProvider } from '@/components/ui/Toast';
import { useAntigravityTheme } from '@/lib/useAntigravityTheme';

const FULLSCREEN_ROUTES = ['/login', '/privacy', '/terms'];
const FULLSCREEN_PREFIXES = ['/reports/preview/', '/u/'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Initialize theme on mount across all routes (including fullscreen routes)
  useAntigravityTheme();

  const isFullscreen =
    FULLSCREEN_ROUTES.some((route) => pathname === route) ||
    FULLSCREEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isFullscreen) {
    return (
      <ToastProvider>
        <div className="min-h-screen w-full bg-surface text-content-primary transition-colors duration-200">
          {children}
        </div>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="flex h-screen w-full overflow-hidden bg-surface text-content-primary transition-colors duration-200">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-6 pb-20 lg:pb-8 bg-surface">
            <div className="max-w-[1600px] mx-auto w-full">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
