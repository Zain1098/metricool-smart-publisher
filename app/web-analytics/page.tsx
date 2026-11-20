'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Globe,
  Copy,
  Check,
  RefreshCw,
  Send,
  Users,
  Eye,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/shadcn/card';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Badge } from '@/components/ui/shadcn/badge';
import { useToast } from '@/components/ui';

interface PixelStatsResponse {
  totalPageviews: number;
  uniqueSessions: number;
  sites: string[];
  topPages: Array<{ path: string; title: string; views: number }>;
  topReferrers: Array<{ source: string; count: number }>;
  dailyTraffic: Array<{ date: string; views: number }>;
  recentEvents: Array<{
    id: string;
    siteId: string;
    path: string;
    title: string;
    referrer: string;
    screen: string;
    ts: string;
  }>;
}

export default function WebAnalyticsPage() {
  const { pushToast } = useToast();
  const [stats, setStats] = useState<PixelStatsResponse | null>(null);
  const [siteId, setSiteId] = useState('zcodedev-web');
  const [selectedSite, setSelectedSite] = useState('all');
  const [origin, setOrigin] = useState('https://your-domain.com');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin);
  }, []);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pixel/stats?site=${encodeURIComponent(selectedSite)}`);
      const json = await res.json();
      setStats(json);
    } finally {
      setLoading(false);
    }
  }, [selectedSite]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const snippet = `<script src="${origin}/pixel.js" data-site="${siteId}" defer></script>`;

  const copySnippet = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    pushToast({ title: 'Tracking Pixel Copied', description: 'Paste inside <head> of any website', type: 'success' });
    setTimeout(() => setCopied(false), 2000);
  };

  const sendTestBeacon = async () => {
    await fetch('/api/pixel/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId,
        sessionId: 's_test_' + Math.floor(Math.random() * 1000),
        event: 'pageview',
        url: `${origin}/blog/metricool-alternative`,
        path: '/blog/metricool-alternative',
        title: 'Metricool Alternative Test Hit',
        referrer: 'https://google.com/',
        screen: '1440x900',
      }),
    });
    pushToast({ title: 'Test Pageview Recorded', type: 'success' });
    loadStats();
  };

  const clearLogs = async () => {
    await fetch('/api/pixel/stats', { method: 'DELETE' });
    pushToast({ title: 'Pixel Events Cleared', type: 'info' });
    loadStats();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-content-primary tracking-tight flex items-center gap-2">
            <Globe className="w-6 h-6 text-brand" />
            Web & Blog Analytics Pixel
          </h1>
          <p className="text-sm text-content-muted">
            Self-hosted tracking pixel (like Metricool&apos;s apus.metricool.com/js/web.js) for any website or WordPress blog.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={sendTestBeacon}>
            <Send className="w-4 h-4" />
            Send Test Hit
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={loadStats} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={clearLogs} className="text-rose-500">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Embed Snippet Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Install Tracking Pixel on Any Website</CardTitle>
          <CardDescription>
            Paste this single script tag into your website&apos;s &lt;head&gt; to track pageviews, sessions, and referrers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              placeholder="Site ID (e.g. my-blog)"
              className="sm:w-52 text-xs"
            />
            <code className="flex-1 px-3 py-2 rounded-lg bg-surface border border-border text-xs font-mono overflow-x-auto whitespace-nowrap">
              {snippet}
            </code>
            <Button type="button" size="sm" onClick={copySnippet}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              Copy
            </Button>
          </div>
          {stats && stats.sites.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="text-xs text-content-muted">Filter site:</span>
              <Badge
                variant={selectedSite === 'all' ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                onClick={() => setSelectedSite('all')}
              >
                All Sites
              </Badge>
              {stats.sites.map((s) => (
                <Badge
                  key={s}
                  variant={selectedSite === s ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                  onClick={() => setSelectedSite(s)}
                >
                  {s}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs text-content-muted mb-1">
              <span>Total Pageviews</span>
              <Eye className="w-4 h-4" />
            </div>
            <div className="text-3xl font-bold tabular-nums">{stats?.totalPageviews ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs text-content-muted mb-1">
              <span>Unique Sessions</span>
              <Users className="w-4 h-4" />
            </div>
            <div className="text-3xl font-bold tabular-nums">{stats?.uniqueSessions ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs text-content-muted mb-1">
              <span>Tracked Sites</span>
              <Globe className="w-4 h-4" />
            </div>
            <div className="text-3xl font-bold tabular-nums">{stats?.sites.length ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Top Pages & Referrers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Top Pages</CardTitle>
          </CardHeader>
          <CardContent>
            {!stats?.topPages.length ? (
              <p className="text-xs text-content-muted py-6 text-center">
                No pageviews recorded yet. Click &quot;Send Test Hit&quot; or embed the pixel.
              </p>
            ) : (
              <div className="space-y-2">
                {stats.topPages.map((p) => (
                  <div key={p.path} className="flex items-center justify-between text-xs py-1.5 border-b border-border/50 last:border-0">
                    <div className="min-w-0 pr-3">
                      <div className="font-medium truncate">{p.path}</div>
                      <div className="text-content-muted truncate text-[11px]">{p.title}</div>
                    </div>
                    <Badge variant="sage" className="tabular-nums">{p.views} views</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Top Traffic Sources / Referrers</CardTitle>
          </CardHeader>
          <CardContent>
            {!stats?.topReferrers.length ? (
              <p className="text-xs text-content-muted py-6 text-center">No referrer data yet.</p>
            ) : (
              <div className="space-y-2">
                {stats.topReferrers.map((r) => (
                  <div key={r.source} className="flex items-center justify-between text-xs py-1.5 border-b border-border/50 last:border-0">
                    <span className="font-medium flex items-center gap-1.5 truncate">
                      <ExternalLink className="w-3 h-3 text-content-muted" />
                      {r.source}
                    </span>
                    <Badge variant="outline" className="tabular-nums">{r.count}</Badge>
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
