'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { ToastProvider } from '@/components/ui/Toast';

const FULLSCREEN_ROUTES = ['/login', '/privacy', '/terms'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullscreen = FULLSCREEN_ROUTES.some((route) => pathname === route);

  if (isFullscreen) {
    return (
      <ToastProvider>
        <div className="min-h-screen w-full bg-[#FAF6F1] text-[#1E1B18]">
          {children}
        </div>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="flex h-screen w-full overflow-hidden bg-[#FAF6F1] text-[#1E1B18]">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto px-4 py-5 md:px-7 md:py-6 pb-20 lg:pb-8 bg-[#FAF6F1]">
            <div className="max-w-[1440px] mx-auto w-full">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
