'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Link2,
  Plus,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  MousePointerClick,
  Eye,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/shadcn/card';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Badge } from '@/components/ui/shadcn/badge';
import { useToast } from '@/components/ui';
import type { SmartLinkItem, SmartLinkProfile } from '@/lib/smartlinks-store';

export default function SmartLinksPage() {
  const { pushToast } = useToast();
  const [profiles, setProfiles] = useState<SmartLinkProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newSlug, setNewSlug] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const loadProfiles = useCallback(async () => {
    const res = await fetch('/api/smartlinks');
    const json = await res.json();
    if (json.profiles) {
      setProfiles(json.profiles);
      setSelectedId((prev) => prev || json.profiles[0]?.id || null);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const active = profiles.find((p) => p.id === selectedId) || null;

  const createProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlug.trim()) return;
    const res = await fetch('/api/smartlinks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: newSlug.trim(), title: newSlug.trim() }),
    });
    const json = await res.json();
    if (json.success && json.profile) {
      setProfiles((prev) => [json.profile, ...prev]);
      setSelectedId(json.profile.id);
      setNewSlug('');
      pushToast({ title: 'SmartLink Created', type: 'success' });
    }
  };

  const patchActive = async (patch: Partial<SmartLinkProfile>) => {
    if (!active) return;
    setProfiles((prev) => prev.map((p) => (p.id === active.id ? { ...p, ...patch } : p)));
    await fetch('/api/smartlinks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: active.id, ...patch }),
    });
  };

  const addLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!active || !linkLabel.trim() || !linkUrl.trim()) return;
    const item: SmartLinkItem = {
      id: `lnk_${Date.now()}`,
      label: linkLabel.trim(),
      url: linkUrl.startsWith('http') ? linkUrl.trim() : `https://${linkUrl.trim()}`,
      clicks: 0,
      enabled: true,
    };
    patchActive({ links: [...active.links, item] });
    setLinkLabel('');
    setLinkUrl('');
  };

  const removeLink = (id: string) => {
    if (!active) return;
    patchActive({ links: active.links.filter((l) => l.id !== id) });
  };

  const copyBioUrl = () => {
    if (!active) return;
    const url = `${window.location.origin}/u/${active.slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    pushToast({ title: 'Bio Link Copied', description: url, type: 'success' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-content-primary tracking-tight flex items-center gap-2">
            <Link2 className="w-6 h-6 text-brand" />
            SmartLinks (Link-in-Bio)
          </h1>
          <p className="text-sm text-content-muted">
            Create unlimited custom bio pages with real-time click & view tracking.
          </p>
        </div>
        <form onSubmit={createProfile} className="flex items-center gap-2">
          <Input
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            placeholder="new-slug..."
            className="w-44 h-9 text-xs"
          />
          <Button type="submit" size="sm" disabled={!newSlug.trim()}>
            <Plus className="w-4 h-4" />
            New Bio Page
          </Button>
        </form>
      </div>

      {active && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Builder */}
          <div className="lg:col-span-7 space-y-4">
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Page Profile: /u/{active.slug}</CardTitle>
                  <CardDescription className="flex items-center gap-3 mt-1">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" /> {active.totalViews} page views
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MousePointerClick className="w-3.5 h-3.5" />
                      {active.links.reduce((s, l) => s + (l.clicks || 0), 0)} total clicks
                    </span>
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={copyBioUrl}>
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    Copy URL
                  </Button>
                  <a
                    href={`/u/${active.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs px-3 h-8 rounded-md bg-brand text-white hover:opacity-90 font-medium"
                  >
                    Open <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-content-muted">Display Title</label>
                    <Input
                      value={active.title}
                      onChange={(e) => patchActive({ title: e.target.value })}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-content-muted">Accent Color</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="color"
                        value={active.accentColor}
                        onChange={(e) => patchActive({ accentColor: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer border border-border"
                      />
                      <span className="text-xs font-mono text-content-muted">{active.accentColor}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-content-muted">Bio Description</label>
                  <Input
                    value={active.bio}
                    onChange={(e) => patchActive({ bio: e.target.value })}
                    className="h-8 text-xs mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Links ({active.links.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <form onSubmit={addLink} className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                    placeholder="Button label (e.g. Latest Video)"
                    className="h-8 text-xs"
                  />
                  <Input
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className="h-8 text-xs"
                  />
                  <Button type="submit" size="sm" className="h-8">
                    <Plus className="w-3.5 h-3.5" /> Add
                  </Button>
                </form>

                <div className="space-y-2 pt-2">
                  {active.links.map((lnk) => (
                    <div
                      key={lnk.id}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border bg-surface text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{lnk.label}</div>
                        <div className="text-content-muted truncate text-[11px]">{lnk.url}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="sage" className="tabular-nums text-[10px]">
                          {lnk.clicks} clicks
                        </Badge>
                        <button
                          type="button"
                          onClick={() => removeLink(lnk.id)}
                          className="p-1 text-rose-500 hover:bg-surface-card rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mobile Live Preview */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-[340px] rounded-[32px] border-4 border-content-primary/15 bg-surface-card p-6 shadow-lg space-y-5">
              <div className="text-center space-y-1.5 pt-2">
                <div
                  className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-white text-xl font-bold"
                  style={{ backgroundColor: active.accentColor }}
                >
                  {active.title.slice(0, 2).toUpperCase()}
                </div>
                <h2 className="text-lg font-bold">{active.title}</h2>
                <p className="text-xs text-content-muted">{active.bio}</p>
              </div>
              <div className="space-y-2.5">
                {active.links
                  .filter((l) => l.enabled)
                  .map((l) => (
                    <div
                      key={l.id}
                      className="w-full py-3 px-4 rounded-xl text-center text-xs font-semibold text-white shadow-sm"
                      style={{ backgroundColor: active.accentColor }}
                    >
                      {l.label}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
