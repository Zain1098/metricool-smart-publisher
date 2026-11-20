import { readJsonStore, writeJsonStore } from './json-store';
import type { SocialPlatform } from './types';

export interface FlowItem {
  id: string;
  title: string;
  caption: string;
  mediaUrl?: string;
}

export interface EvergreenFlow {
  id: string;
  name: string;
  platforms: SocialPlatform[];
  frequencyHours: number;
  repeatLoop: boolean;
  enabled: boolean;
  cursorIndex: number;
  lastRunAt?: string;
  items: FlowItem[];
  createdAt: string;
}

const FLOWS_FILE = 'flows.json';

function getInitialFlows(): EvergreenFlow[] {
  return [
    {
      id: 'flow_evergreen_tips',
      name: 'Evergreen Coding Tips',
      platforms: ['youtube', 'instagram'],
      frequencyHours: 24,
      repeatLoop: true,
      enabled: true,
      cursorIndex: 0,
      items: [
        {
          id: 'fi_1',
          title: '5 VS Code Shortcuts You Need',
          caption: 'Save hours every week with these 5 shortcuts. #coding #vscode #devtips',
        },
        {
          id: 'fi_2',
          title: 'Next.js App Router Caching Explained',
          caption: 'Stop guessing how Next.js caching works. #nextjs #webdev #typescript',
        },
      ],
      createdAt: new Date().toISOString(),
    },
  ];
}

export function listFlows(): EvergreenFlow[] {
  const stored = readJsonStore<EvergreenFlow[] | null>(FLOWS_FILE, null);
  if (!stored || stored.length === 0) {
    const initial = getInitialFlows();
    writeJsonStore(FLOWS_FILE, initial);
    return initial;
  }
  return stored;
}

export function createFlow(input: {
  name: string;
  platforms?: SocialPlatform[];
  frequencyHours?: number;
  repeatLoop?: boolean;
}): EvergreenFlow {
  const flows = listFlows();
  const flow: EvergreenFlow = {
    id: `flow_${Date.now()}`,
    name: input.name.trim() || 'Untitled Flow',
    platforms: input.platforms && input.platforms.length ? input.platforms : ['instagram'],
    frequencyHours: input.frequencyHours || 24,
    repeatLoop: input.repeatLoop ?? true,
    enabled: true,
    cursorIndex: 0,
    items: [],
    createdAt: new Date().toISOString(),
  };
  flows.unshift(flow);
  writeJsonStore(FLOWS_FILE, flows);
  return flow;
}

export function updateFlow(
  id: string,
  patch: Partial<Omit<EvergreenFlow, 'id' | 'createdAt'>>
): EvergreenFlow | null {
  const flows = listFlows();
  const idx = flows.findIndex((f) => f.id === id);
  if (idx === -1) return null;
  flows[idx] = { ...flows[idx], ...patch };
  writeJsonStore(FLOWS_FILE, flows);
  return flows[idx];
}

export function deleteFlow(id: string): boolean {
  const flows = listFlows();
  const next = flows.filter((f) => f.id !== id);
  if (next.length === flows.length) return false;
  writeJsonStore(FLOWS_FILE, next);
  return true;
}
