import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

export const metadata: Metadata = {
  title: 'Metricool — Social Media Analytics, Planning & Management',
  description:
    'Complete Metricool social media management suite: cross-platform analytics, visual content calendar, best hours heatmaps, and automated video publishing.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#F4F6F8] text-slate-900 flex flex-col h-screen overflow-hidden antialiased font-sans">
        {/* Metricool Authentic Dark Navy Top Navigation */}
        <Header />

        {/* Below Header: Metricool Channel Rail + Main Workspace */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 lg:pb-8 bg-[#F4F6F8]">
            <div className="max-w-[1480px] mx-auto">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
