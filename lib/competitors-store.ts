import { readJsonStore, writeJsonStore } from './json-store';

export interface CompetitorProfile {
  id: string;
  platform: 'youtube' | 'instagram' | 'tiktok';
  handle: string;
  name: string;
  followers: number;
  totalViews: number;
  postsCount: number;
  avgEngagementPct: number;
  lastSyncedAt: string;
  source: 'live_api' | 'manual';
}

export interface TrackedHashtag {
  id: string;
  tag: string;
  matchingVideos: number;
  sampleTitles: string[];
  lastCheckedAt: string;
}

interface CompetitorsStoreData {
  competitors: CompetitorProfile[];
  hashtags: TrackedHashtag[];
}

const COMPETITORS_FILE = 'competitors.json';

function readData(): CompetitorsStoreData {
  return readJsonStore<CompetitorsStoreData>(COMPETITORS_FILE, {
    competitors: [],
    hashtags: [],
  });
}

export function listCompetitorsData(): CompetitorsStoreData {
  return readData();
}

export function addCompetitorProfile(profile: Omit<CompetitorProfile, 'id'>): CompetitorProfile {
  const data = readData();
  const item: CompetitorProfile = {
    id: `comp_${Date.now()}`,
    ...profile,
  };
  data.competitors.unshift(item);
  writeJsonStore(COMPETITORS_FILE, data);
  return item;
}

export function removeCompetitorProfile(id: string): void {
  const data = readData();
  data.competitors = data.competitors.filter((c) => c.id !== id);
  writeJsonStore(COMPETITORS_FILE, data);
}

export function addTrackedHashtag(tag: Omit<TrackedHashtag, 'id'>): TrackedHashtag {
  const data = readData();
  const cleanTag = tag.tag.startsWith('#') ? tag.tag : `#${tag.tag}`;
  const item: TrackedHashtag = {
    id: `tag_${Date.now()}`,
    ...tag,
    tag: cleanTag,
  };
  data.hashtags = [item, ...data.hashtags.filter((h) => h.tag.toLowerCase() !== cleanTag.toLowerCase())];
  writeJsonStore(COMPETITORS_FILE, data);
  return item;
}

export function removeTrackedHashtag(id: string): void {
  const data = readData();
  data.hashtags = data.hashtags.filter((h) => h.id !== id);
  writeJsonStore(COMPETITORS_FILE, data);
}
