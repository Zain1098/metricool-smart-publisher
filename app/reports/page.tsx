'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FileText,
  Plus,
  Share2,
  Copy,
  Check,
  Trash2,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import ReportPreviewRenderer, {
  ReportAnalyticsPayload,
} from '@/components/ReportPreviewRenderer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/shadcn/card';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Badge } from '@/components/ui/shadcn/badge';
import { useToast } from '@/components/ui';
import type { CustomReport, ReportBlock } from '@/lib/reports-store';

export default function ReportsStudioPage() {
  const { pushToast } = useToast();
  const [reports, setReports] = useState<CustomReport[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<ReportAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [repRes, anaRes] = await Promise.all([
        fetch('/api/reports').then((r) => r.json()),
        fetch('/api/analytics').then((r) => r.json()),
      ]);
      if (repRes.reports) {
        setReports(repRes.reports);
        setSelectedId((prev) => prev || repRes.reports[0]?.id || null);
      }
      setAnalytics(anaRes);
    } catch {
      pushToast({ title: 'Error', description: 'Failed to load Reporting Studio', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedReport = reports.find((r) => r.id === selectedId) || null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      const json = await res.json();
      if (json.success && json.report) {
        setReports((prev) => [json.report, ...prev]);
        setSelectedId(json.report.id);
        setNewTitle('');
        pushToast({ title: 'Report Created', description: json.report.title, type: 'success' });
      }
    } finally {
      setCreating(false);
    }
  };

  const patchReport = async (id: string, patch: Partial<CustomReport>) => {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const res = await fetch(`/api/reports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const json = await res.json();
    if (json.success && json.report) {
      setReports((prev) => prev.map((r) => (r.id === id ? json.report : r)));
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/reports/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setReports((prev) => {
        const next = prev.filter((r) => r.id !== id);
        if (selectedId === id) setSelectedId(next[0]?.id || null);
        return next;
      });
      pushToast({ title: 'Report Deleted', type: 'info' });
    }
  };

  const toggleBlock = (blockId: string) => {
    if (!selectedReport) return;
    const nextBlocks = selectedReport.blocks.map((b) =>
      b.id === blockId ? { ...b, enabled: !b.enabled } : b
    );
    patchReport(selectedReport.id, { blocks: nextBlocks });
  };

  const moveBlock = (idx: number, dir: -1 | 1) => {
    if (!selectedReport) return;
    const target = idx + dir;
    if (target < 0 || target >= selectedReport.blocks.length) return;
    const next = [...selectedReport.blocks];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    patchReport(selectedReport.id, { blocks: next });
  };

  const updateBlockNotes = (blockId: string, notes: string) => {
    if (!selectedReport) return;
    const nextBlocks: ReportBlock[] = selectedReport.blocks.map((b) =>
      b.id === blockId ? { ...b, notes } : b
    );
    patchReport(selectedReport.id, { blocks: nextBlocks });
  };

  const copyShareUrl = (report: CustomReport) => {
    const url = `${window.location.origin}/reports/preview/${report.shareToken}`;
    navigator.clipboard.writeText(url);
    setCopiedId(report.id);
    pushToast({ title: 'Public Link Copied', description: url, type: 'success' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading && !analytics) {
    return (
      <div className="py-16 text-center text-sm text-content-muted flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Loading Reporting Studio...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-content-primary tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-brand" />
            Reporting Studio
          </h1>
          <p className="text-sm text-content-muted">
            Build unlimited white-label reports, export PDF/CSV, and share live public links — zero plan limits.
          </p>
        </div>
        <form onSubmit={handleCreate} className="flex items-center gap-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New report title..."
            className="w-56 h-9 text-xs"
          />
          <Button type="submit" size="sm" disabled={creating || !newTitle.trim()}>
            <Plus className="w-4 h-4" />
            Create Report
          </Button>
        </form>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Sidebar: Saved Reports & Block Controls */}
        <div className="xl:col-span-4 space-y-4 print:hidden">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Saved Reports ({reports.length})</CardTitle>
              <CardDescription>Select a report to customize blocks or share</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {reports.map((rep) => (
                <div
                  key={rep.id}
                  onClick={() => setSelectedId(rep.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    rep.id === selectedId
                      ? 'border-brand bg-brand/5'
                      : 'border-border hover:bg-surface'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{rep.title}</div>
                      <div className="text-xs text-content-muted mt-0.5">
                        {rep.brandName} • {rep.dateRangeLabel}
                      </div>
                    </div>
                    <Badge variant={rep.isPublic ? 'sage' : 'outline'} className="text-[10px]">
                      {rep.isPublic ? 'Public' : 'Private'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 mt-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyShareUrl(rep);
                      }}
                    >
                      {copiedId === rep.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      Copy Link
                    </Button>
                    <a
                      href={`/reports/preview/${rep.shareToken}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[11px] px-2 h-7 rounded-md border border-border hover:bg-surface font-medium"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Preview
                    </a>
                    {reports.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-rose-500 hover:text-rose-600 ml-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(rep.id);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {selectedReport && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Customize Report & Blocks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-content-muted">Brand / Client</label>
                    <Input
                      value={selectedReport.brandName}
                      onChange={(e) => patchReport(selectedReport.id, { brandName: e.target.value })}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-content-muted">Date Range</label>
                    <Input
                      value={selectedReport.dateRangeLabel}
                      onChange={(e) => patchReport(selectedReport.id, { dateRangeLabel: e.target.value })}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-medium text-content-muted">Accent</label>
                    <input
                      type="color"
                      value={selectedReport.accentColor || '#C27345'}
                      onChange={(e) => patchReport(selectedReport.id, { accentColor: e.target.value })}
                      className="w-7 h-7 rounded cursor-pointer border border-border"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => patchReport(selectedReport.id, { isPublic: !selectedReport.isPublic })}
                  >
                    <Share2 className="w-3 h-3" />
                    {selectedReport.isPublic ? 'Public Link Active' : 'Enable Public Link'}
                  </Button>
                </div>

                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="text-xs font-semibold text-content-secondary">Report Blocks</div>
                  {selectedReport.blocks.map((blk, idx) => (
                    <div key={blk.id} className="rounded-lg border border-border p-2.5 bg-surface space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium truncate">{blk.title}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveBlock(idx, -1)}
                            className="p-1 hover:bg-surface-card rounded"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveBlock(idx, 1)}
                            className="p-1 hover:bg-surface-card rounded"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleBlock(blk.id)}
                            className="p-1 hover:bg-surface-card rounded"
                            title={blk.enabled ? 'Hide Block' : 'Show Block'}
                          >
                            {blk.enabled ? (
                              <Eye className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5 text-content-muted" />
                            )}
                          </button>
                        </div>
                      </div>
                      {blk.type === 'executive_notes' && blk.enabled && (
                        <textarea
                          value={blk.notes || ''}
                          onChange={(e) => updateBlockNotes(blk.id, e.target.value)}
                          rows={3}
                          className="w-full text-xs rounded-md border border-border bg-surface-card p-2 focus:outline-none focus:ring-1 focus:ring-brand"
                          placeholder="Add strategist notes..."
                        />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Live Preview */}
        <div className="xl:col-span-8">
          {selectedReport && analytics ? (
            <ReportPreviewRenderer report={selectedReport} analytics={analytics} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-sm text-content-muted">
                Select or create a report to preview it.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
