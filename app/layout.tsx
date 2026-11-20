import type { Metadata } from 'next';
import { Newsreader, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import AppShell from '@/components/AppShell';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});

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
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${newsreader.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-surface text-content-primary antialiased font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
