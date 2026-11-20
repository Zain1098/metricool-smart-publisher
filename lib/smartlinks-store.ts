import { readJsonStore, writeJsonStore } from './json-store';

export interface SmartLinkItem {
  id: string;
  label: string;
  url: string;
  clicks: number;
  enabled: boolean;
}

export interface SmartLinkProfile {
  id: string;
  slug: string;
  title: string;
  bio: string;
  accentColor: string;
  totalViews: number;
  links: SmartLinkItem[];
  updatedAt: string;
}

const SMARTLINKS_FILE = 'smartlinks.json';

function getInitialSmartLinks(): SmartLinkProfile[] {
  return [
    {
      id: 'sl_zcodedev',
      slug: 'zcodedev',
      title: 'ZCodeDev',
      bio: 'Coding tutorials, AI tools, and full-stack builds.',
      accentColor: '#C27345',
      totalViews: 0,
      links: [
        {
          id: 'lnk_yt',
          label: 'YouTube Channel',
          url: 'https://www.youtube.com/@zcodedev',
          clicks: 0,
          enabled: true,
        },
        {
          id: 'lnk_ig',
          label: 'Instagram @zcodedev',
          url: 'https://www.instagram.com/zcodedev',
          clicks: 0,
          enabled: true,
        },
      ],
      updatedAt: new Date().toISOString(),
    },
  ];
}

export function listSmartLinks(): SmartLinkProfile[] {
  const stored = readJsonStore<SmartLinkProfile[] | null>(SMARTLINKS_FILE, null);
  if (!stored || stored.length === 0) {
    const initial = getInitialSmartLinks();
    writeJsonStore(SMARTLINKS_FILE, initial);
    return initial;
  }
  return stored;
}

export function getSmartLinkBySlug(slug: string): SmartLinkProfile | undefined {
  return listSmartLinks().find((p) => p.slug.toLowerCase() === slug.toLowerCase());
}

export function createSmartLinkProfile(input: {
  slug: string;
  title: string;
  bio?: string;
  accentColor?: string;
}): SmartLinkProfile {
  const list = listSmartLinks();
  const cleanSlug = input.slug
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || `bio-${Date.now()}`;

  const profile: SmartLinkProfile = {
    id: `sl_${Date.now()}`,
    slug: cleanSlug,
    title: input.title.trim() || cleanSlug,
    bio: input.bio?.trim() || '',
    accentColor: input.accentColor || '#C27345',
    totalViews: 0,
    links: [],
    updatedAt: new Date().toISOString(),
  };
  list.unshift(profile);
  writeJsonStore(SMARTLINKS_FILE, list);
  return profile;
}

export function updateSmartLinkProfile(
  id: string,
  patch: Partial<Omit<SmartLinkProfile, 'id'>>
): SmartLinkProfile | null {
  const list = listSmartLinks();
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  list[idx] = {
    ...list[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  writeJsonStore(SMARTLINKS_FILE, list);
  return list[idx];
}

export function deleteSmartLinkProfile(id: string): boolean {
  const list = listSmartLinks();
  const next = list.filter((p) => p.id !== id);
  if (next.length === list.length) return false;
  writeJsonStore(SMARTLINKS_FILE, next);
  return true;
}

export function recordSmartLinkClick(slug: string, linkId?: string): SmartLinkProfile | null {
  const list = listSmartLinks();
  const idx = list.findIndex((p) => p.slug.toLowerCase() === slug.toLowerCase());
  if (idx === -1) return null;
  if (linkId) {
    list[idx].links = list[idx].links.map((l) =>
      l.id === linkId ? { ...l, clicks: (l.clicks || 0) + 1 } : l
    );
  } else {
    list[idx].totalViews = (list[idx].totalViews || 0) + 1;
  }
  writeJsonStore(SMARTLINKS_FILE, list);
  return list[idx];
}
