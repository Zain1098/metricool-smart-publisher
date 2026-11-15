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
  Clock,
  CheckCircle2,
  Loader2,
  Play,
} from 'lucide-react';
import type { MediaAssetItem } from '@/app/api/media/route';
import { cn, formatTimeSec } from '@/lib/utils';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  Modal,
  SegmentedTabs,
  Skeleton,
  useToast,
} from '@/components/ui';

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
  const [search, setSearch] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewAsset, setPreviewAsset] = useState<MediaAssetItem | null>(null);

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
      /\.(mp4|mov|webm|mkv|jpg|jpeg|png|webp)$/i.test(file.name);
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
      // 1. Try Cloudflare R2 presigned upload first
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

      // 2. Fallback: chunked local binary upload
      if (!uploadedViaR2) {
        const CHUNK_SIZE = 2 * 1024 * 1024;
        const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
        const uploadId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        for (let idx = 0; idx < totalChunks; idx++) {
          const start = idx * CHUNK_SIZE;
          const end = Math.min(file.size, start + CHUNK_SIZE);
          const chunk = file.slice(start, end);
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: {
              'x-upload-chunk': 'true',
              'x-upload-id': uploadId,
              'x-chunk-index': String(idx),
              'x-total-chunks': String(totalChunks),
              'x-file-name': encodeURIComponent(file.name),
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
    if (!confirm(`Delete ${asset.fileName}?`)) return;
    try {
      const res = await fetch(
        `/api/media?fileName=${encodeURIComponent(asset.fileName)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Delete failed');
      }
      pushToast({ type: 'success', title: 'Asset deleted' });
      loadMedia();
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Cannot delete asset',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const filteredAssets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((a) => {
      const matchesType =
        filterType === 'all'
          ? true
          : filterType === 'in_use'
          ? a.status === 'in_use'
          : a.mediaType === filterType;
      const matchesSearch =
        !q || a.fileName.toLowerCase().includes(q);
      return matchesType && matchesSearch;
    });
  }, [assets, filterType, search]);

  const storageCapMb = stats?.r2Configured ? 10240 : 1024;
  const storagePct = Math.min(
    100,
    Math.round(((stats?.totalSizeMb || 0) / storageCapMb) * 100)
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-studio-border">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-ink-primary tracking-[-0.02em]">
            Media Library
          </h1>
          <p className="text-xs text-ink-muted">
            Manage uploaded videos, cover thumbnails, file dimensions, and cloud storage capacity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            variant="primary"
            size="sm"
            loading={uploading}
            onClick={() => fileInputRef.current?.click()}
            icon={<UploadCloud className="w-3.5 h-3.5" />}
          >
            {uploading ? `Uploading ${uploadProgress}%` : 'Upload Asset'}
          </Button>
        </div>
      </div>

      {/* Storage Usage & Upload Dropzone Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Card className="lg:col-span-5 space-y-3.5">
          <CardHeader
            icon={<HardDrive className="w-4 h-4 text-status-cloud" />}
            title="Storage Overview"
            subtitle={stats?.storageProvider || 'Checking storage provider...'}
            action={
              <Badge tone={stats?.r2Configured ? 'cloud' : 'neutral'}>
                {stats?.r2Configured ? 'Cloudflare R2' : 'Local Storage'}
              </Badge>
            }
          />

          <div className="grid grid-cols-3 gap-3 text-xs font-mono tabular-nums">
            <div className="p-2.5 rounded-lg bg-studio-subtle border border-studio-border">
              <p className="text-[10px] text-ink-muted font-sans">Total Assets</p>
              <p className="text-base font-semibold text-ink-primary mt-0.5">
                {stats?.totalCount ?? 0}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-studio-subtle border border-studio-border">
              <p className="text-[10px] text-ink-muted font-sans">Videos</p>
              <p className="text-base font-semibold text-ink-primary mt-0.5">
                {stats?.videoCount ?? 0}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-studio-subtle border border-studio-border">
              <p className="text-[10px] text-ink-muted font-sans">Total Size</p>
              <p className="text-base font-semibold text-status-success mt-0.5">
                {stats?.totalSizeMb ?? 0} MB
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-ink-muted font-mono">
              <span>Allocated usage</span>
              <span>
                {stats?.totalSizeMb ?? 0} MB / {storageCapMb} MB
              </span>
            </div>
            <div className="h-2 rounded-full bg-studio-subtle overflow-hidden border border-studio-border">
              <div
                className="h-full bg-status-cloud transition-all duration-300"
                style={{ width: `${Math.max(storagePct, (stats?.totalSizeMb || 0) > 0 ? 3 : 0)}%` }}
              />
            </div>
          </div>
        </Card>

        {/* Dropzone */}
        <div
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
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={cn(
            'lg:col-span-7 rounded-xl border-2 border-dashed p-6 flex flex-col items-center justify-center text-center gap-2.5 cursor-pointer transition-colors',
            isDragging
              ? 'border-[#00D2B4] bg-[#E6FAF7]'
              : 'border-slate-300 bg-white hover:border-[#00D2B4] hover:bg-slate-50'
          )}
        >
          <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#00BFA3]">
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <UploadCloud className="w-5 h-5" />
            )}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-ink-primary">
              {uploading
                ? `Uploading media asset (${uploadProgress}%)...`
                : 'Drop video or image files here to upload'}
            </p>
            <p className="text-xs text-ink-muted">
              Supports MP4, MOV, WebM, MKV, JPG, PNG, and WebP up to 500 MB
            </p>
          </div>
          {uploading && (
            <div className="w-full max-w-xs h-1.5 rounded-full bg-studio-subtle overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-150"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Asset Browser */}
      <Card className="space-y-4">
        <CardHeader
          icon={<FolderOpen className="w-4 h-4 text-accent-soft" />}
          title={`Media Assets (${filteredAssets.length})`}
          subtitle="Click any asset to inspect playback or send directly to Post Composer"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search file name..."
                leftIcon={<Search className="w-3.5 h-3.5" />}
                className="w-full sm:w-52 h-8 text-xs"
              />
              <SegmentedTabs
                size="xs"
                value={filterType}
                onChange={setFilterType}
                items={[
                  { id: 'all', label: 'All', count: assets.length },
                  {
                    id: 'video',
                    label: 'Videos',
                    count: assets.filter((a) => a.mediaType === 'video').length,
                  },
                  {
                    id: 'image',
                    label: 'Images',
                    count: assets.filter((a) => a.mediaType === 'image').length,
                  },
                  {
                    id: 'in_use',
                    label: 'In Posts',
                    count: assets.filter((a) => a.status === 'in_use').length,
                  },
                ]}
              />
            </div>
          }
        />

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-56 w-full" />
            ))}
          </div>
        ) : filteredAssets.length === 0 ? (
          <EmptyState
            icon={<Film className="w-5 h-5" />}
            title="No media assets found"
            description="Upload a video or image above, or create a post in Composer to populate your media vault."
            action={
              <Button
                size="sm"
                variant="primary"
                onClick={() => fileInputRef.current?.click()}
                icon={<UploadCloud className="w-3.5 h-3.5" />}
              >
                Upload First Asset
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {filteredAssets.map((asset) => (
              <div
                key={asset.id}
                className="rounded-xl bg-studio-subtle border border-studio-border hover:border-studio-borderStrong overflow-hidden flex flex-col justify-between transition-colors"
              >
                {/* Preview Thumbnail */}
                <button
                  type="button"
                  onClick={() => setPreviewAsset(asset)}
                  className="relative aspect-video bg-black overflow-hidden group text-left"
                >
                  {asset.mediaType === 'image' || asset.thumbnailUrl ? (
                    <img
                      src={asset.thumbnailUrl || asset.url}
                      alt={asset.fileName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <video
                      src={asset.url}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  )}

                  <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="w-9 h-9 rounded-full bg-studio-canvas/85 border border-white/20 flex items-center justify-center text-white">
                      {asset.mediaType === 'video' ? (
                        <Play className="w-4 h-4 ml-0.5" />
                      ) : (
                        <ImageIcon className="w-4 h-4" />
                      )}
                    </span>
                  </div>

                  <div className="absolute top-2 left-2 flex items-center gap-1">
                    <Badge
                      tone={asset.source === 'r2' ? 'cloud' : 'neutral'}
                      className="bg-studio-canvas/85 backdrop-blur-sm text-[10px]"
                    >
                      {asset.source === 'r2'
                        ? 'R2'
                        : asset.source === 'local'
                        ? 'Local'
                        : 'Post'}
                    </Badge>
                  </div>

                  {asset.durationSec && asset.durationSec > 0 ? (
                    <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white">
                      {formatTimeSec(asset.durationSec)}
                    </span>
                  ) : null}
                </button>

                {/* Metadata & Actions */}
                <div className="p-3 space-y-2.5">
                  <div className="space-y-1">
                    <p
                      className="text-xs font-semibold text-ink-primary truncate"
                      title={asset.fileName}
                    >
                      {asset.fileName}
                    </p>
                    <div className="flex items-center justify-between text-[11px] font-mono text-ink-muted">
                      <span>{asset.sizeMb} MB</span>
                      <span className="flex items-center gap-1">
                        {asset.status === 'in_use' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-status-success" />
                            <span>{asset.usedInPostsCount} post(s)</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" />
                            <span>Ready</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-studio-border">
                    <Link
                      href={`/composer?mediaUrl=${encodeURIComponent(
                        asset.url
                      )}&mediaName=${encodeURIComponent(asset.fileName)}`}
                      className="flex-1"
                    >
                      <Button
                        size="xs"
                        variant="secondary"
                        className="w-full"
                        icon={<Plus className="w-3 h-3 text-accent-soft" />}
                      >
                        Use in Post
                      </Button>
                    </Link>

                    {asset.source === 'local' && asset.usedInPostsCount === 0 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteAsset(asset)}
                        aria-label={`Delete ${asset.fileName}`}
                        className="h-7 w-7 rounded-md hover:bg-status-danger/15 text-ink-muted hover:text-status-danger flex items-center justify-center transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Asset Preview Modal */}
      <Modal
        open={Boolean(previewAsset)}
        onClose={() => setPreviewAsset(null)}
        title={previewAsset?.fileName || 'Media Preview'}
        subtitle={
          previewAsset
            ? `${previewAsset.sizeMb} MB · ${
                previewAsset.aspectRatio || previewAsset.mediaType.toUpperCase()
              }`
            : undefined
        }
        footer={
          previewAsset ? (
            <>
              <span className="text-[11px] font-mono text-ink-muted">
                Uploaded {new Date(previewAsset.createdAt).toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                <Link
                  href={`/composer?mediaUrl=${encodeURIComponent(
                    previewAsset.url
                  )}&mediaName=${encodeURIComponent(previewAsset.fileName)}`}
                >
                  <Button
                    size="xs"
                    variant="primary"
                    icon={<Plus className="w-3 h-3" />}
                  >
                    Use in Composer
                  </Button>
                </Link>
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() => setPreviewAsset(null)}
                >
                  Close
                </Button>
              </div>
            </>
          ) : undefined
        }
      >
        {previewAsset && (
          <div className="w-full max-h-[60vh] bg-black rounded-lg overflow-hidden border border-studio-border flex items-center justify-center">
            {previewAsset.mediaType === 'image' ? (
              <img
                src={previewAsset.url}
                alt={previewAsset.fileName}
                className="max-h-[60vh] w-auto object-contain"
              />
            ) : (
              <video
                src={previewAsset.url}
                poster={previewAsset.thumbnailUrl}
                controls
                autoPlay
                playsInline
                className="max-h-[60vh] w-full object-contain"
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
