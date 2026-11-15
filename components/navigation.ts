import {
  LayoutDashboard,
  BarChart3,
  Calendar,
  Send,
  PlusSquare,
  FolderOpen,
  Share2,
  Settings,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  description: string;
  group: 'workspace' | 'studio' | 'system';
  icon: typeof LayoutDashboard;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: '/',
    label: 'Overview',
    shortLabel: 'Overview',
    description: 'Performance summary, channel health, and publishing pulse',
    group: 'workspace',
    icon: LayoutDashboard,
  },
  {
    href: '/analytics',
    label: 'Analytics',
    shortLabel: 'Analytics',
    description: 'Channel growth, video metrics, and topic timing intelligence',
    group: 'workspace',
    icon: BarChart3,
  },
  {
    href: '/calendar',
    label: 'Content Calendar',
    shortLabel: 'Calendar',
    description: 'Monthly, weekly, and daily schedule with drag-and-drop',
    group: 'workspace',
    icon: Calendar,
  },
  {
    href: '/publishing',
    label: 'Publishing Queue',
    shortLabel: 'Queue',
    description: 'Scheduled holds, live executions, retries, and history',
    group: 'workspace',
    icon: Send,
  },
  {
    href: '/composer',
    label: 'Post Composer',
    shortLabel: 'Composer',
    description: 'Multi-network video editor, previews, and cloud scheduling',
    group: 'studio',
    icon: PlusSquare,
  },
  {
    href: '/media',
    label: 'Media Library',
    shortLabel: 'Media',
    description: 'Uploaded videos, thumbnails, storage usage, and asset status',
    group: 'studio',
    icon: FolderOpen,
  },
  {
    href: '/connections',
    label: 'Connections',
    shortLabel: 'Channels',
    description: 'OAuth credentials, token verification, and auto-discovery',
    group: 'system',
    icon: Share2,
  },
  {
    href: '/settings',
    label: 'Settings',
    shortLabel: 'Settings',
    description: 'Brand profile, storage, notifications, security, and API config',
    group: 'system',
    icon: Settings,
  },
];

export function getNavItemForPath(pathname: string): NavItem {
  const exact = NAV_ITEMS.find((item) => item.href === pathname);
  if (exact) return exact;
  const prefix = NAV_ITEMS.find(
    (item) => item.href !== '/' && pathname.startsWith(item.href)
  );
  if (prefix) return prefix;
  if (pathname === '/privacy') {
    return {
      href: '/privacy',
      label: 'Privacy Policy',
      shortLabel: 'Privacy',
      description: 'Data collection, Google API compliance, and credential security',
      group: 'system',
      icon: Settings,
    };
  }
  if (pathname === '/terms') {
    return {
      href: '/terms',
      label: 'Terms & Conditions',
      shortLabel: 'Terms',
      description: 'Service terms, API policies, and AI disclosure compliance',
      group: 'system',
      icon: Settings,
    };
  }
  return NAV_ITEMS[0];
}
