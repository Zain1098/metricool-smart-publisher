import type { Metadata } from 'next';
import './globals.css';
import AppShell from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'ZCodeDev Studio — Social Media Planner & Analytics',
  description:
    'Warm, organized social media management suite: cross-platform analytics, visual content calendar, feed preview, and automated publishing.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#FAF6F1] text-[#1E1B18] antialiased font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
