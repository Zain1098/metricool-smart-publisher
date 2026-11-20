'use client';

import { useEffect, useState, useCallback } from 'react';
import { Radar, Plus, Trash2, Hash, Users, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/shadcn/card';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Badge } from '@/components/ui/shadcn/badge';
import { useToast } from '@/components/ui';
import type { CompetitorProfile, TrackedHashtag } from '@/lib/competitors-store';

export default function CompetitorsPage() {
  const { pushToast } = useToast();
  const [competitors, setCompetitors] = useState<CompetitorProfile[]>([]);
  const [hashtags, setHashtags] = useState<TrackedHashtag[]>([]);
  const [handleInput, setHandleInput] = useState('');
  const [platformInput, setPlatformInput] = useState<'youtube' | 'instagram' | 'tiktok'>('youtube');
  const [tagInput, setTagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    const res = await fetch('/api/competitors');
    const json = await res.json();
    if (json.competitors) setCompetitors(json.competitors);
    if (json.hashtags) setHashtags(json.hashtags);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addCompetitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handleInput.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: handleInput.trim(), platform: platformInput }),
      });
      const json = await res.json();
      if (json.success && json.competitor) {
        setCompetitors((prev) => [json.competitor, ...prev]);
        setHandleInput('');
        pushToast({
          title: 'Competitor Added',
          description:
            json.competitor.source === 'live_api'
              ? 'Synced live stats from YouTube API'
              : 'Saved competitor profile',
          type: 'success',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const addHashtag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagInput.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'hashtag', tag: tagInput.trim() }),
      });
      const json = await res.json();
      if (json.success && json.hashtag) {
        setHashtags((prev) => [
          json.hashtag,
          ...prev.filter((h) => h.tag.toLowerCase() !== json.hashtag.tag.toLowerCase()),
        ]);
        setTagInput('');
        pushToast({ title: 'Hashtag Tracked', description: json.hashtag.tag, type: 'success' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const removeItem = async (kind: 'competitor' | 'hashtag', id: string) => {
    await fetch(`/api/competitors?kind=${kind}&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (kind === 'competitor') setCompetitors((p) => p.filter((c) => c.id !== id));
    else setHashtags((p) => p.filter((h) => h.id !== id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-content-primary tracking-tight flex items-center gap-2">
          <Radar className="w-6 h-6 text-brand" />
          Competitors & Hashtag Tracker
        </h1>
        <p className="text-sm text-content-muted">
          Benchmark competitor channels and track hashtag volume across YouTube & social networks.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Competitors */}
        <Card className="lg:col-span-7">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Competitor Benchmarking</CardTitle>
            <CardDescription>
              Enter a YouTube @handle to auto-fetch live subscribers, views, and video count.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={addCompetitor} className="flex flex-col sm:flex-row gap-2">
              <select
                value={platformInput}
                onChange={(e) => setPlatformInput(e.target.value as any)}
                className="h-9 rounded-md border border-border bg-surface px-2.5 text-xs"
              >
                <option value="youtube">YouTube</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
              </select>
              <Input
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value)}
                placeholder="@handle (e.g. @mkbhd)"
                className="h-9 text-xs"
              />
              <Button type="submit" size="sm" disabled={submitting || !handleInput.trim()}>
                <Plus className="w-4 h-4" /> Track
              </Button>
            </form>

            {competitors.length === 0 ? (
              <p className="text-xs text-content-muted py-8 text-center">
                No competitors tracked yet. Add a @handle above to benchmark.
              </p>
            ) : (
              <div className="space-y-2">
                {competitors.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-surface text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold truncate">{c.name}</span>
                        <Badge variant="outline" className="capitalize text-[10px]">{c.platform}</Badge>
                        {c.source === 'live_api' && (
                          <Badge variant="sage" className="text-[10px]">Live Synced</Badge>
                        )}
                      </div>
                      <div className="text-content-muted mt-0.5">{c.handle}</div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right">
                        <div className="font-bold tabular-nums flex items-center gap-1 justify-end">
                          <Users className="w-3 h-3 text-content-muted" />
                          {c.followers.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-content-muted">Followers</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold tabular-nums flex items-center gap-1 justify-end">
                          <Eye className="w-3 h-3 text-content-muted" />
                          {c.totalViews.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-content-muted">{c.postsCount} posts</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem('competitor', c.id)}
                        className="p-1.5 text-rose-500 hover:bg-surface-card rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hashtag Tracker */}
        <Card className="lg:col-span-5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Hash className="w-4 h-4 text-brand" /> Hashtag Tracker
            </CardTitle>
            <CardDescription>Search & monitor hashtag volume and top matching videos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={addHashtag} className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="#nextjs, #coding..."
                className="h-9 text-xs"
              />
              <Button type="submit" size="sm" disabled={submitting || !tagInput.trim()}>
                <Plus className="w-4 h-4" /> Track
              </Button>
            </form>

            {hashtags.length === 0 ? (
              <p className="text-xs text-content-muted py-8 text-center">No hashtags tracked yet.</p>
            ) : (
              <div className="space-y-2.5">
                {hashtags.map((h) => (
                  <div key={h.id} className="p-3 rounded-xl border border-border bg-surface text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-brand">{h.tag}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="sage" className="tabular-nums text-[10px]">
                          {h.matchingVideos.toLocaleString()} results
                        </Badge>
                        <button
                          type="button"
                          onClick={() => removeItem('hashtag', h.id)}
                          className="p-1 text-rose-500 hover:bg-surface-card rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {h.sampleTitles.length > 0 && (
                      <ul className="text-[11px] text-content-muted list-disc pl-4 space-y-0.5">
                        {h.sampleTitles.slice(0, 3).map((t, i) => (
                          <li key={i} className="truncate">{t}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
