'use client';

import { useEffect, useState, useCallback, useMemo, useRef, ChangeEvent } from 'react';
import Link from 'next/link';
import {
  FolderOpen,
  UploadCloud,
  Film,
  Image as ImageIcon,
  Search,
  HardDrive,
  Trash2,
  Plus,
  CheckCircle2,
  Play,
  Copy,
  Check,
  LayoutGrid,
  List as ListIcon,
  ExternalLink,
  X,
  ArrowUpDown,
} from 'lucide-react';
import type { MediaAssetItem } from '@/app/api/media/route';
import { cn, formatTimeSec } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/shadcn/card';
import { Badge } from '@/components/ui/shadcn/badge';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Progress } from '@/components/ui/shadcn/progress';
import { useToast } from '@/components/ui';

interface MediaStats {
  totalCount: number;
  videoCount: number;
  imageCount: number;
  totalSizeMb: number;
  storageProvider: string;
  r2Configured: boolean;
  r2Bucket: string | null;
  supabaseConfigured: boolean;
}

export default function MediaLibraryPage() {
  const { pushToast } = useToast();
  const [assets, setAssets] = useState<MediaAssetItem[]>([]);
  const [stats, setStats] = useState<MediaStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'video' | 'image' | 'in_use'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'largest' | 'name'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewAsset, setPreviewAsset] = useState<MediaAssetItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMedia = useCallback(async () => {
    try {
      const res = await fetch('/api/media');
      const data = await res.json();
      if (data.assets) setAssets(data.assets);
      if (data.stats) setStats(data.stats);
    } catch {
      pushToast({ type: 'error', title: 'Failed to load media library' });
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  const handleUploadFile = async (file: File) => {
    const isValid =
      file.type.startsWith('video/') ||
      file.type.startsWith('image/') ||
      /\.(mp4|mov|webm|mkv|jpg|jpeg|png|webp|gif)$/i.test(file.name);
    if (!isValid) {
      pushToast({
        type: 'error',
        title: 'Unsupported file format',
        description: 'Upload MP4, MOV, WebM, MKV videos or JPG, PNG, WebP images.',
      });
      return;
    }

    setUploading(true);
    setUploadProgress(5);
    try {
      let uploadedViaR2 = false;
      try {
        const presignRes = await fetch('/api/r2/presign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            fileSizeBytes: file.size,
            mimeType: file.type || 'video/mp4',
            folder: 'original',
          }),
        });
        const presignJson = await presignRes.json();
        if (presignJson.success && presignJson.uploadUrl && !presignJson.fallbackLocal) {
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', presignJson.uploadUrl);
            xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
            xhr.upload.onprogress = (ev) => {
              if (ev.lengthComputable) {
                setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
              }
            };
            xhr.onload = () =>
              xhr.status >= 200 && xhr.status < 300
                ? resolve()
                : reject(new Error(`R2 upload HTTP ${xhr.status}`));
            xhr.onerror = () => reject(new Error('R2 network upload error'));
            xhr.send(file);
          });

          await fetch('/api/r2/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              fileSizeBytes: file.size,
              mimeType: file.type || 'video/mp4',
              r2StorageKey: presignJson.storageKey,
              publicUrl: presignJson.publicUrl,
            }),
          });
          uploadedViaR2 = true;
        }
      } catch {
        // Fallback to chunked local upload
      }

      if (!uploadedViaR2) {
        const CHUNK_SIZE = 2 * 1024 * 1024;
        const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
        const safeId = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

        for (let idx = 0; idx < totalChunks; idx++) {
          const start = idx * CHUNK_SIZE;
          const end = Math.min(file.size, start + CHUNK_SIZE);
          const chunk = file.slice(start, end);
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: {
              'x-upload-chunk': 'true',
              'x-file-id': safeId,
              'x-chunk-index': String(idx),
              'x-total-chunks': String(totalChunks),
              'x-original-name': encodeURIComponent(file.name),
            },
            body: chunk,
          });
          if (!res.ok) throw new Error(`Chunk upload HTTP ${res.status}`);
          setUploadProgress(Math.round(((idx + 1) / totalChunks) * 100));
        }
      }

      pushToast({
        type: 'success',
        title: 'Media asset uploaded',
        description: `${file.name} is ready in your library.`,
      });
      await loadMedia();
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Unable to upload file.',
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleUploadFile(f);
    e.target.value = '';
  };

  const handleDeleteAsset = async (asset: MediaAssetItem) => {
    if (!confirm(`Delete "${asset.fileName}" permanently?`)) return;
    setDeletingId(asset.id);
    try {
      const res = await fetch(
        `/api/media?id=${encodeURIComponent(asset.id)}&fileName=${encodeURIComponent(asset.fileName)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Delete failed');
      }
      pushToast({ type: 'success', title: 'Asset deleted' });
      if (previewAsset?.id === asset.id) setPreviewAsset(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(asset.id);
        return next;
      });
      await loadMedia();
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Cannot delete asset',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected asset(s)?`)) return;
    const items = assets
      .filter((a) => selectedIds.has(a.id))
      .map((a) => ({ id: a.id, fileName: a.fileName }));
    try {
      const res = await fetch('/api/media', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok && !data.deletedCount) {
        throw new Error(data.error || 'Bulk delete failed');
      }
      pushToast({
        type: 'success',
        title: data.message || `Deleted ${data.deletedCount} asset(s)`,
      });
      setSelectedIds(new Set());
      await loadMedia();
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Bulk delete failed',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopyUrl = async (asset: MediaAssetItem) => {
    try {
      const fullUrl = asset.url.startsWith('http')
        ? asset.url
        : `${window.location.origin}${asset.url}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopiedId(asset.id);
      setTimeout(() => setCopiedId(null), 2000);
      pushToast({ type: 'success', title: 'Media URL copied' });
    } catch {
      pushToast({ type: 'error', title: 'Could not copy URL' });
    }
  };

  const filteredAssets = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = assets.filter((a) => {
      const matchesType =
        filterType === 'all'
          ? true
          : filterType === 'in_use'
          ? a.usedInPostsCount > 0
          : a.mediaType === filterType;
      const matchesQuery = !q || a.fileName.toLowerCase().includes(q);
      return matchesType && matchesQuery;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'largest') return b.sizeMb - a.sizeMb;
      if (sortBy === 'name') return a.fileName.localeCompare(b.fileName);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [assets, filterType, search, sortBy]);

  const storagePercent = Math.min(
    100,
    Math.round(((stats?.totalSizeMb || 0) / 10240) * 100)
  );

  return (
    <div className="space-y-6">
      {/* Stitch Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-1">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-brand text-xs font-semibold uppercase tracking-wider">
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Studio Asset Vault</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-normal text-content-primary tracking-tight">
            Media Asset Library &amp; Cloud Storage
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary">
            Manage uploaded short-form videos, custom thumbnails, and Cloudflare R2 / local storage assets.
          </p>
        </div>
      </div>

      {/* Row 1: 4 Stitch Editorial KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="p-6 rounded-2xl bg-surface-lowest border border-border shadow-card hover:shadow-elevated transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-content-secondary">
              Total Media Assets
            </span>
            <span className="w-8 h-8 rounded-lg bg-surface-low flex items-center justify-center text-brand">
              <FolderOpen className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-3 gap-2">
            <span className="font-serif text-[2.25rem] leading-none font-medium text-content-primary tabular-nums">
              {loading ? '—' : stats?.totalCount ?? assets.length}
            </span>
            <Badge variant="sage">Library</Badge>
          </div>
          <p className="mt-3 text-xs text-content-muted">Ready for multi-channel posts</p>
        </div>

        <div className="p-6 rounded-2xl bg-surface-lowest border border-border shadow-card hover:shadow-elevated transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-content-secondary">
              Video Clips
            </span>
            <span className="w-8 h-8 rounded-lg bg-brand-container flex items-center justify-center text-brand">
              <Film className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-3 gap-2">
            <span className="font-serif text-[2.25rem] leading-none font-medium text-content-primary tabular-nums">
              {loading ? '—' : stats?.videoCount ?? 0}
            </span>
            <Badge variant="peach">Reels &amp; Shorts</Badge>
          </div>
          <p className="mt-3 text-xs text-content-muted">MP4, MOV, WebM, MKV</p>
        </div>

        <div className="p-6 rounded-2xl bg-surface-lowest border border-border shadow-card hover:shadow-elevated transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-content-secondary">
              Thumbnails &amp; Images
            </span>
            <span className="w-8 h-8 rounded-lg bg-surface-low flex items-center justify-center text-brand">
              <ImageIcon className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-3 gap-2">
            <span className="font-serif text-[2.25rem] leading-none font-medium text-content-primary tabular-nums">
              {loading ? '—' : stats?.imageCount ?? 0}
            </span>
            <Badge variant="rose">Covers</Badge>
          </div>
          <p className="mt-3 text-xs text-content-muted">Custom cover frames</p>
        </div>

        <div className="p-6 rounded-2xl bg-surface-lowest border border-border shadow-card hover:shadow-elevated transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-content-secondary">
              Storage Used
            </span>
            <span className="w-8 h-8 rounded-lg bg-surface-low flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <HardDrive className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-3 gap-2">
            <span className="font-serif text-[2rem] leading-none font-medium text-content-primary tabular-nums">
              {loading ? '—' : `${stats?.totalSizeMb ?? 0} MB`}
            </span>
            <Badge variant="lavender">{stats?.storageProvider || 'Storage'}</Badge>
          </div>
          <div className="mt-3">
            <Progress value={storagePercent} indicatorColor="#C27345" />
          </div>
        </div>
      </section>

      {/* Row 2: Upload Dropzone */}
      <Card
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleUploadFile(f);
        }}
        className={cn(
          'border-2 border-dashed transition-colors cursor-pointer',
          isDragging
            ? 'border-[#C27345] bg-brand-container/40'
            : 'border-border bg-surface-lowest hover:border-[#C27345]'
        )}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-container border border-brand/25 flex items-center justify-center text-[#8D451E] flex-shrink-0">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-content-primary">
                {uploading
                  ? `Uploading asset... ${uploadProgress}%`
                  : 'Drag & drop videos or cover images here'}
              </p>
              <p className="text-xs text-content-muted mt-0.5">
                Supports MP4, MOV, WebM, MKV, JPG, PNG, WebP · Direct to{' '}
                {stats?.r2Configured ? 'Cloudflare R2' : 'Local Storage'}
              </p>
            </div>
          </div>

          <div className="w-full sm:w-auto flex items-center gap-3">
            {uploading ? (
              <div className="w-full sm:w-48">
                <Progress value={uploadProgress} indicatorColor="#C27345" />
              </div>
            ) : (
              <Button type="button" size="sm">
                <Plus className="w-4 h-4" />
                Upload Media
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Row 3: Toolbar (Filters, Search, Sort, View Toggle, Bulk Delete) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'all', label: 'All Media' },
              { id: 'video', label: 'Videos' },
              { id: 'image', label: 'Images' },
              { id: 'in_use', label: 'In Use' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                filterType === tab.id
                  ? 'bg-[#C27345] text-white border-[#C27345]'
                  : 'bg-surface-lowest text-content-secondary border-border hover:bg-surface-container'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.size > 0 && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Selected ({selectedIds.size})
            </Button>
          )}

          <div className="relative w-52">
            <Search className="w-3.5 h-3.5 text-content-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search filename..."
              className="pl-8 h-8 text-xs"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setSortBy((s) => (s === 'newest' ? 'largest' : s === 'largest' ? 'name' : 'newest'))
            }
            className="h-8 text-xs"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="capitalize">Sort: {sortBy}</span>
          </Button>

          <div className="inline-flex rounded-lg bg-surface-high p-0.5 border border-border">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
              className={cn(
                'p-1.5 rounded-md',
                viewMode === 'grid' ? 'bg-surface-lowest text-content-primary shadow-xs' : 'text-content-muted'
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-label="List view"
              className={cn(
                'p-1.5 rounded-md',
                viewMode === 'list' ? 'bg-surface-lowest text-content-primary shadow-xs' : 'text-content-muted'
              )}
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Row 4: Assets Grid or List */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 rounded-2xl bg-surface-high animate-pulse" />
          ))}
        </div>
      ) : filteredAssets.length === 0 ? (
        <Card className="p-10 text-center space-y-3">
          <FolderOpen className="w-10 h-10 text-[#958B81] mx-auto" />
          <p className="text-sm font-semibold text-content-primary">No media assets found</p>
          <p className="text-xs text-content-muted">
            Upload a video or image above to start building your library.
          </p>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAssets.map((asset) => {
            const isSelected = selectedIds.has(asset.id);
            return (
              <Card
                key={asset.id}
                className={cn(
                  'overflow-hidden flex flex-col transition-all',
                  isSelected ? 'ring-2 ring-[#C27345]' : ''
                )}
              >
                {/* Media Preview */}
                <div className="relative aspect-[16/10] bg-[#1E1B18] overflow-hidden group">
                  {asset.mediaType === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={asset.url}
                      alt={asset.fileName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <video
                      src={asset.url}
                      poster={asset.thumbnailUrl || undefined}
                      preload="metadata"
                      muted
                      className="w-full h-full object-cover"
                    />
                  )}

                  {/* Select Checkbox */}
                  <button
                    type="button"
                    onClick={() => toggleSelect(asset.id)}
                    aria-label={`Select ${asset.fileName}`}
                    className={cn(
                      'absolute top-2 left-2 w-6 h-6 rounded-md border flex items-center justify-center transition-colors',
                      isSelected
                        ? 'bg-[#C27345] border-[#C27345] text-white'
                        : 'bg-surface-lowest/90 border-border text-transparent hover:text-content-muted'
                    )}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>

                  {/* Source Badge */}
                  <span className="absolute top-2 right-2 rounded-full bg-surface-lowest/95 px-2 py-0.5 text-[10px] font-semibold text-content-primary shadow-xs uppercase">
                    {asset.source}
                  </span>

                  {/* Center Preview Trigger */}
                  <button
                    type="button"
                    onClick={() => setPreviewAsset(asset)}
                    aria-label={`Preview ${asset.fileName}`}
                    className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
                  >
                    <span className="w-10 h-10 rounded-full bg-surface-lowest text-content-primary flex items-center justify-center shadow-lg">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </span>
                  </button>
                </div>

                {/* Metadata + Actions */}
                <CardContent className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <p
                      className="text-xs font-semibold text-content-primary truncate"
                      title={asset.fileName}
                    >
                      {asset.fileName}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-content-muted">
                      <span>{asset.sizeMb} MB</span>
                      {asset.durationSec ? (
                        <span>{formatTimeSec(asset.durationSec)}</span>
                      ) : (
                        <span>{new Date(asset.createdAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-border-subtle">
                    <Button asChild variant="secondary" size="sm" className="h-7 px-2.5 text-[11px] flex-1">
                      <Link
                        href={`/composer?mediaUrl=${encodeURIComponent(asset.url)}&fileName=${encodeURIComponent(asset.fileName)}&sizeMb=${asset.sizeMb}`}
                      >
                        Use in Post
                      </Link>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleCopyUrl(asset)}
                      title="Copy URL"
                      className="h-7 w-7"
                    >
                      {copiedId === asset.id ? (
                        <Check className="w-3.5 h-3.5 text-[#3A8E63]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleDeleteAsset(asset)}
                      disabled={deletingId === asset.id}
                      title="Delete asset"
                      className="h-7 w-7 text-[#C84B4B] hover:bg-[#FDF2F4] hover:text-[#C84B4B]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-content-muted">
                  <th className="p-3 w-8" />
                  <th className="p-3 font-semibold">File</th>
                  <th className="p-3 font-semibold">Type</th>
                  <th className="p-3 font-semibold">Source</th>
                  <th className="p-3 font-semibold text-right">Size</th>
                  <th className="p-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE9E1]">
                {filteredAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-surface">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(asset.id)}
                        onChange={() => toggleSelect(asset.id)}
                        aria-label={`Select ${asset.fileName}`}
                      />
                    </td>
                    <td className="p-3 font-medium text-content-primary max-w-[260px] truncate">
                      {asset.fileName}
                    </td>
                    <td className="p-3 capitalize text-content-muted">{asset.mediaType}</td>
                    <td className="p-3 uppercase text-content-muted">{asset.source}</td>
                    <td className="p-3 text-right tabular-nums">{asset.sizeMb} MB</td>
                    <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px]"
                        onClick={() => setPreviewAsset(asset)}
                      >
                        Preview
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] text-[#C84B4B]"
                        onClick={() => handleDeleteAsset(asset)}
                        disabled={deletingId === asset.id}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Preview Modal */}
      {previewAsset && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewAsset(null)}
        >
          <Card
            className="w-full max-w-2xl overflow-hidden bg-surface-lowest shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="flex flex-row items-center justify-between p-4 border-b border-border">
              <div className="min-w-0 pr-4">
                <CardTitle className="text-sm font-semibold truncate">
                  {previewAsset.fileName}
                </CardTitle>
                <CardDescription>
                  {previewAsset.sizeMb} MB · {previewAsset.source.toUpperCase()} ·{' '}
                  {new Date(previewAsset.createdAt).toLocaleString()}
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setPreviewAsset(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="aspect-video w-full rounded-xl overflow-hidden bg-[#1E1B18] flex items-center justify-center">
                {previewAsset.mediaType === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewAsset.url}
                    alt={previewAsset.fileName}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <video
                    src={previewAsset.url}
                    poster={previewAsset.thumbnailUrl || undefined}
                    controls
                    autoPlay
                    className="w-full h-full object-contain"
                  />
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button asChild size="sm">
                    <Link
                      href={`/composer?mediaUrl=${encodeURIComponent(previewAsset.url)}&fileName=${encodeURIComponent(previewAsset.fileName)}&sizeMb=${previewAsset.sizeMb}`}
                    >
                      Use in Composer
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyUrl(previewAsset)}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy URL
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <a href={previewAsset.url} target="_blank" rel="noreferrer">
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open Raw
                    </a>
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteAsset(previewAsset)}
                  disabled={deletingId === previewAsset.id}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Asset
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
