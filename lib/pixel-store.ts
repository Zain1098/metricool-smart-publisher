import { readJsonStore, writeJsonStore } from './json-store';

export interface PixelEvent {
  id: string;
  siteId: string;
  sessionId: string;
  event: string;
  url: string;
  path: string;
  title: string;
  referrer: string;
  screen: string;
  ts: string;
}

const PIXEL_FILE = 'pixel-events.json';
const MAX_EVENTS = 5000;

export function listPixelEvents(): PixelEvent[] {
  return readJsonStore<PixelEvent[]>(PIXEL_FILE, []);
}

export function recordPixelEvent(input: Omit<PixelEvent, 'id'>): PixelEvent {
  const events = listPixelEvents();
  const evt: PixelEvent = {
    id: `px_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ...input,
  };
  events.unshift(evt);
  if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
  writeJsonStore(PIXEL_FILE, events);
  return evt;
}

export function clearPixelEvents(): void {
  writeJsonStore<PixelEvent[]>(PIXEL_FILE, []);
}

export function getPixelStats(siteFilter?: string) {
  const all = listPixelEvents();
  const events = siteFilter && siteFilter !== 'all' ? all.filter((e) => e.siteId === siteFilter) : all;

  const sessions = new Set<string>();
  const sites = new Set<string>();
  const pageMap = new Map<string, { path: string; title: string; views: number }>();
  const refMap = new Map<string, number>();
  const dayMap = new Map<string, number>();

  for (const e of all) sites.add(e.siteId);

  for (const e of events) {
    if (e.sessionId) sessions.add(e.sessionId);
    const pKey = e.path || '/';
    const existing = pageMap.get(pKey);
    if (existing) {
      existing.views += 1;
      if (!existing.title && e.title) existing.title = e.title;
    } else {
      pageMap.set(pKey, { path: pKey, title: e.title || pKey, views: 1 });
    }

    let refHost = 'Direct / None';
    if (e.referrer) {
      try {
        refHost = new URL(e.referrer).hostname || e.referrer;
      } catch {
        refHost = e.referrer;
      }
    }
    refMap.set(refHost, (refMap.get(refHost) || 0) + 1);

    const day = (e.ts || new Date().toISOString()).slice(0, 10);
    dayMap.set(day, (dayMap.get(day) || 0) + 1);
  }

  return {
    totalPageviews: events.length,
    uniqueSessions: sessions.size,
    sites: Array.from(sites),
    topPages: Array.from(pageMap.values()).sort((a, b) => b.views - a.views).slice(0, 20),
    topReferrers: Array.from(refMap.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15),
    dailyTraffic: Array.from(dayMap.entries())
      .map(([date, views]) => ({ date, views }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    recentEvents: events.slice(0, 30),
  };
}
