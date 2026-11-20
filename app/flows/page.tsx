'use client';

import { useEffect, useState, useCallback } from 'react';
import { Repeat, Plus, Play, Trash2, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/shadcn/card';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Badge } from '@/components/ui/shadcn/badge';
import { useToast } from '@/components/ui';
import type { EvergreenFlow, FlowItem } from '@/lib/flows-store';
import type { SocialPlatform } from '@/lib/types';

const ALL_PLATFORMS: SocialPlatform[] = ['youtube', 'instagram', 'facebook', 'tiktok', 'twitter', 'linkedin'];

export default function FlowsPage() {
  const { pushToast } = useToast();
  const [flows, setFlows] = useState<EvergreenFlow[]>([]);
  const [newName, setNewName] = useState('');
  const [itemTitle, setItemTitle] = useState<Record<string, string>>({});
  const [itemCaption, setItemCaption] = useState<Record<string, string>>({});

  const loadFlows = useCallback(async () => {
    const res = await fetch('/api/flows');
    const json = await res.json();
    if (json.flows) setFlows(json.flows);
  }, []);

  useEffect(() => {
    loadFlows();
  }, [loadFlows]);

  const createNewFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const res = await fetch('/api/flows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const json = await res.json();
    if (json.success && json.flow) {
      setFlows((prev) => [json.flow, ...prev]);
      setNewName('');
      pushToast({ title: 'Evergreen Flow Created', type: 'success' });
    }
  };

  const patchFlow = async (id: string, patch: Partial<EvergreenFlow>) => {
    setFlows((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    await fetch('/api/flows', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    });
  };

  const togglePlatform = (flow: EvergreenFlow, platform: SocialPlatform) => {
    const exists = flow.platforms.includes(platform);
    const next = exists
      ? flow.platforms.filter((p) => p !== platform)
      : [...flow.platforms, platform];
    if (next.length === 0) return;
    patchFlow(flow.id, { platforms: next });
  };

  const addItem = (flow: EvergreenFlow) => {
    const title = (itemTitle[flow.id] || '').trim();
    const caption = (itemCaption[flow.id] || '').trim();
    if (!title || !caption) return;
    const nextItem: FlowItem = { id: `fi_${Date.now()}`, title, caption };
    patchFlow(flow.id, { items: [...flow.items, nextItem] });
    setItemTitle((p) => ({ ...p, [flow.id]: '' }));
    setItemCaption((p) => ({ ...p, [flow.id]: '' }));
  };

  const runNow = async (flowId: string) => {
    const res = await fetch('/api/flows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'run_now', id: flowId }),
    });
    const json = await res.json();
    if (json.success) {
      pushToast({
        title: 'Post Queued from Flow',
        description: 'Added next evergreen item to Publishing Queue (+5 min).',
        type: 'success',
      });
      loadFlows();
    } else {
      pushToast({ title: 'Cannot Run Flow', description: json.error, type: 'error' });
    }
  };

  const removeFlow = async (id: string) => {
    await fetch(`/api/flows?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    setFlows((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-content-primary tracking-tight flex items-center gap-2">
            <Repeat className="w-6 h-6 text-brand" />
            Evergreen Flows (Autolists)
          </h1>
          <p className="text-sm text-content-muted">
            Build recurring content queues (like Metricool Autolists) that loop and feed your Publishing Queue automatically.
          </p>
        </div>
        <form onSubmit={createNewFlow} className="flex items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New autolist name..."
            className="w-52 h-9 text-xs"
          />
          <Button type="submit" size="sm" disabled={!newName.trim()}>
            <Plus className="w-4 h-4" /> Create Flow
          </Button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {flows.map((flow) => (
          <Card key={flow.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{flow.name}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <Clock className="w-3.5 h-3.5" /> Every {flow.frequencyHours}h •{' '}
                    {flow.repeatLoop ? 'Loop Enabled' : 'Run Once'}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => runNow(flow.id)}>
                    <Play className="w-3.5 h-3.5" /> Queue Next
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-rose-500" onClick={() => removeFlow(flow.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-2">
                {ALL_PLATFORMS.map((p) => (
                  <Badge
                    key={p}
                    variant={flow.platforms.includes(p) ? 'default' : 'outline'}
                    className="cursor-pointer capitalize text-[11px]"
                    onClick={() => togglePlatform(flow, p)}
                  >
                    {p}
                  </Badge>
                ))}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {flow.items.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`p-2.5 rounded-lg border text-xs ${
                      idx === flow.cursorIndex % Math.max(flow.items.length, 1)
                        ? 'border-brand bg-brand/5'
                        : 'border-border bg-surface'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{item.title}</span>
                      {idx === flow.cursorIndex % Math.max(flow.items.length, 1) && (
                        <Badge variant="sage" className="text-[10px]">Next Up</Badge>
                      )}
                    </div>
                    <p className="text-content-muted mt-1">{item.caption}</p>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-border space-y-2">
                <Input
                  value={itemTitle[flow.id] || ''}
                  onChange={(e) => setItemTitle((p) => ({ ...p, [flow.id]: e.target.value }))}
                  placeholder="Post title..."
                  className="h-8 text-xs"
                />
                <div className="flex gap-2">
                  <Input
                    value={itemCaption[flow.id] || ''}
                    onChange={(e) => setItemCaption((p) => ({ ...p, [flow.id]: e.target.value }))}
                    placeholder="Caption & hashtags..."
                    className="h-8 text-xs"
                  />
                  <Button type="button" size="sm" className="h-8" onClick={() => addItem(flow)}>
                    <Plus className="w-3.5 h-3.5" /> Add
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
