'use client';

import { useState, useRef, useEffect, ChangeEvent } from 'react';
import Link from 'next/link';
import {
  UploadCloud,
  Film,
  CheckCircle2,
  X,
  Loader2,
  Image as ImageIcon,
  Camera,
  FolderOpen,
  ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button, Card, CardHeader } from './ui';

interface LocalUploadedFile {
  fileName: string;
  url: string;
  sizeMb: number;
  createdAt: string;
}

interface VideoDropzoneProps {
  videoUrl: string;
  videoPreviewUrl?: string;
  videoFileName: string;
  videoDuration: number;
  videoAspectRatio: string;
  videoSizeMb: number;
  coverUrl: string;
  thumbOffsetMs: number;
  onVideoSelected: (data: {
    url: string;
    previewUrl?: string;
    fileName: string;
    duration: number;
    aspectRatio: string;
    sizeMb: number;
  }) => void;
  onCoverUpdated: (coverUrl: string, thumbOffsetMs: number) => void;
  onClearVideo: () => void;
}

async function safeParseJson(res: Response): Promise<{
  ok: boolean;
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
}> {
  try {
    const text = await res.text();
    if (!text || !text.trim()) {
      return { ok: false, status: res.status, data: { success: false } };
    }
    const parsed = JSON.parse(text);
    return { ok: res.ok, status: res.status, data: parsed };
  } catch {
    return {
      ok: false,
      status: res.status,
      data: { success: false, error: `HTTP ${res.status}` },
    };
  }
}

export default function VideoDropzone({
  videoUrl,
  videoPreviewUrl,
  videoFileName,
  videoDuration,
  videoAspectRatio,
  videoSizeMb,
  coverUrl,
  thumbOffsetMs,
  onVideoSelected,
  onCoverUpdated,
  onClearVideo,
}: VideoDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isCapturingThumb, setIsCapturingThumb] = useState(false);
  const [localCoverPreview, setLocalCoverPreview] = useState<string>('');
  const [seekSec, setSeekSec] = useState<number>(
    Math.round((thumbOffsetMs || 1000) / 1000)
  );
  const [localFiles, setLocalFiles] = useState<LocalUploadedFile[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const videoPlayerRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    fetch('/api/upload')
      .then((r) => safeParseJson(r))
      .then(({ data }) => {
        if (Array.isArray(data.files)) setLocalFiles(data.files);
      })
      .catch(() => {});
  }, [videoUrl]);

  const handleFile = async (file: File) => {
    if (
      !file.type.startsWith('video/') &&
      !/\.(mp4|mov|webm|mkv)$/i.test(file.name)
    ) {
      alert('Please select a valid video file (MP4, MOV, WebM).');
      return;
    }

    setIsUploading(true);
    setUploadProgress(5);

    try {
      const blobUrl = URL.createObjectURL(file);
      const sizeMb = Number((file.size / (1024 * 1024)).toFixed(1));

      const tempVideo = document.createElement('video');
      tempVideo.preload = 'metadata';
      tempVideo.src = blobUrl;

      const meta = await new Promise<{
        duration: number;
        aspectRatio: string;
      }>((resolve) => {
        const timeoutId = setTimeout(() => {
          resolve({ duration: 30, aspectRatio: '9:16 (Vertical)' });
        }, 2500);

        tempVideo.onloadedmetadata = () => {
          clearTimeout(timeoutId);
          const dur = Math.round(tempVideo.duration) || 30;
          const ratio =
            tempVideo.videoHeight >= tempVideo.videoWidth
              ? '9:16 (Vertical)'
              : '16:9 (Landscape)';
          resolve({ duration: dur, aspectRatio: ratio });
        };
        tempVideo.onerror = () => {
          clearTimeout(timeoutId);
          resolve({ duration: 30, aspectRatio: '9:16 (Vertical)' });
        };
      });

      let directR2Success = false;
      let finalFileUrl = '';

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
        if (
          presignJson.success &&
          presignJson.uploadUrl &&
          !presignJson.fallbackLocal
        ) {
          if (presignJson.isDuplicate) {
            finalFileUrl = presignJson.publicUrl;
            directR2Success = true;
          } else {
            await new Promise<void>((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open('PUT', presignJson.uploadUrl);
              xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');

              xhr.upload.onprogress = (ev) => {
                if (ev.lengthComputable) {
                  setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
                }
              };

              xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                  resolve();
                } else {
                  reject(new Error(`R2 direct upload returned HTTP ${xhr.status}`));
                }
              };

              xhr.onerror = () =>
                reject(new Error('Network error during R2 upload'));
              xhr.send(file);
            });

            await fetch('/api/r2/complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileName: file.name,
                fileSizeBytes: file.size,
                mimeType: file.type || 'video/mp4',
                durationSec: meta.duration,
                aspectRatio: meta.aspectRatio,
                r2StorageKey: presignJson.storageKey,
                publicUrl: presignJson.publicUrl,
              }),
            }).catch(() => {});

            finalFileUrl = presignJson.publicUrl;
            directR2Success = true;
          }
        }
      } catch (r2Err) {
        console.warn('R2 direct upload unavailable, falling back to local chunked upload:', r2Err);
      }

      if (!directR2Success) {
        const CHUNK_SIZE = 2 * 1024 * 1024;
        const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const uniqueFileId = `${Date.now()}_${safeName}`;

        let chunkSuccess = true;

        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(file.size, start + CHUNK_SIZE);
          const chunkBlob = file.slice(start, end);
          const chunkBuffer = await chunkBlob.arrayBuffer();

          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/octet-stream',
              'x-upload-chunk': 'true',
              'x-file-id': uniqueFileId,
              'x-chunk-index': String(i),
              'x-total-chunks': String(totalChunks),
              'x-original-name': encodeURIComponent(file.name),
            },
            body: chunkBuffer,
          });

          const { ok, data } = await safeParseJson(res);
          if (!ok || !data.success) {
            chunkSuccess = false;
            break;
          }

          if (data.url) {
            finalFileUrl = data.url;
          }
          setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
        }

        if (!chunkSuccess) {
          finalFileUrl = blobUrl;
        }
      }

      onVideoSelected({
        url: finalFileUrl || blobUrl,
        previewUrl: blobUrl,
        fileName: file.name,
        duration: meta.duration,
        aspectRatio: meta.aspectRatio,
        sizeMb,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      alert(`Upload error: ${msg}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleCaptureFrameAt = async (targetSeconds?: number) => {
    const vid = videoPlayerRef.current;
    if (!vid) return;

    setIsCapturingThumb(true);
    try {
      if (vid.readyState < 2) {
        await new Promise<void>((resolve) => {
          const onLoaded = () => {
            vid.removeEventListener('loadeddata', onLoaded);
            resolve();
          };
          vid.addEventListener('loadeddata', onLoaded);
          setTimeout(resolve, 800);
        });
      }

      if (typeof targetSeconds === 'number' && !isNaN(targetSeconds)) {
        setSeekSec(targetSeconds);
        if (Math.abs(vid.currentTime - targetSeconds) > 0.05) {
          vid.currentTime = targetSeconds;
          await new Promise<void>((resolve) => {
            const onSeeked = () => {
              vid.removeEventListener('seeked', onSeeked);
              resolve();
            };
            vid.addEventListener('seeked', onSeeked);
            setTimeout(resolve, 600);
          });
        }
      }

      const w = vid.videoWidth || 720;
      const h = vid.videoHeight || 1280;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');
      ctx.drawImage(vid, 0, 0, w, h);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      const offsetMs = Math.round((vid.currentTime || 0) * 1000);

      if (dataUrl && dataUrl.startsWith('data:image/') && dataUrl.length > 200) {
        setLocalCoverPreview(dataUrl);
        onCoverUpdated(dataUrl, offsetMs);

        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl }),
        });
        const { ok, data } = await safeParseJson(res);
        if (ok && data.success && data.url) {
          onCoverUpdated(data.url, offsetMs);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsCapturingThumb(false);
    }
  };

  const handleCustomThumbUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (.jpg, .png, .webp) for the thumbnail.');
      return;
    }
    setIsCapturingThumb(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
      });

      if (dataUrl.startsWith('data:image/')) {
        setLocalCoverPreview(dataUrl);
        onCoverUpdated(dataUrl, thumbOffsetMs);

        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl }),
        });
        const { ok, data } = await safeParseJson(res);
        if (ok && data.success && data.url) {
          onCoverUpdated(data.url, thumbOffsetMs);
        }
      }
    } catch {
      alert('Failed to upload custom thumbnail image.');
    } finally {
      setIsCapturingThumb(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const activeVideoSrc = videoPreviewUrl || videoUrl;
  const activeCoverSrc = localCoverPreview || coverUrl;

  return (
    <Card padding="sm" className="space-y-3.5">
      <CardHeader
        icon={<Film className="w-4 h-4 text-accent-soft" />}
        title="Video Asset &amp; Cover Studio"
        subtitle="Upload MP4/MOV or pick an existing file from your media library"
        className="pb-2.5"
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/media"
              className="text-xs font-medium text-ink-secondary hover:text-ink-primary inline-flex items-center gap-1"
            >
              <span>Media Library</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
            {videoUrl && (
              <Button
                size="xs"
                variant="danger"
                onClick={() => {
                  setLocalCoverPreview('');
                  onClearVideo();
                }}
                icon={<X className="w-3 h-3" />}
              >
                Remove
              </Button>
            )}
          </div>
        }
      />

      {!videoUrl ? (
        <div className="space-y-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
              isDragging
                ? 'border-accent bg-accent/10'
                : 'border-studio-border hover:border-studio-borderStrong bg-studio-subtle'
            )}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="video/*,.mp4,.mov,.webm,.mkv"
              className="hidden"
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                if (e.target.files && e.target.files[0]) {
                  handleFile(e.target.files[0]);
                }
              }}
            />

            <div className="w-10 h-10 rounded-xl bg-accent/12 border border-accent/25 text-accent-soft flex items-center justify-center mx-auto mb-2.5">
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UploadCloud className="w-4 h-4" />
              )}
            </div>

            <p className="text-[13px] font-semibold text-ink-primary">
              {isUploading
                ? `Uploading video... ${uploadProgress}%`
                : 'Drop MP4 / MOV here or click to browse'}
            </p>
            <p className="text-xs text-ink-muted mt-1">
              Supports 9:16 vertical Shorts/Reels/TikTok and 16:9 landscape video via R2 or chunked upload
            </p>

            {isUploading && (
              <div className="w-56 h-1.5 bg-studio-canvas rounded-full overflow-hidden mx-auto mt-3">
                <div
                  className="h-full bg-accent transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </div>

          {localFiles.length > 0 && (
            <div className="p-3 rounded-lg bg-studio-subtle border border-studio-border space-y-2">
              <div className="flex items-center justify-between text-[11px] font-medium text-ink-secondary">
                <span className="inline-flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5 text-status-success" />
                  <span>Recent Library Videos ({localFiles.length})</span>
                </span>
                <Link href="/media" className="text-accent-soft hover:underline">
                  View all
                </Link>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {localFiles.slice(0, 6).map((lf) => (
                  <button
                    key={lf.url}
                    type="button"
                    onClick={() =>
                      onVideoSelected({
                        url: lf.url,
                        previewUrl: lf.url,
                        fileName: lf.fileName,
                        duration: 40,
                        aspectRatio: '9:16 (Vertical)',
                        sizeMb: lf.sizeMb,
                      })
                    }
                    className="h-8 px-2.5 rounded-lg bg-studio-surface hover:bg-studio-hover border border-studio-border text-xs text-ink-primary flex items-center gap-1.5 transition-colors"
                  >
                    <Film className="w-3 h-3 text-accent-soft" />
                    <span className="truncate max-w-[180px]">{lf.fileName}</span>
                    <span className="text-[10px] text-ink-muted font-mono">
                      {lf.sizeMb} MB
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          <div className="md:col-span-5 bg-black rounded-lg overflow-hidden border border-studio-border">
            <video
              ref={videoPlayerRef}
              src={activeVideoSrc}
              controls
              playsInline
              preload="auto"
              onLoadedData={(e) => {
                const v = e.currentTarget;
                if (v.currentTime === 0) {
                  v.currentTime = 1.0;
                }
              }}
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                if (v.duration && Math.round(v.duration) !== videoDuration) {
                  onVideoSelected({
                    url: videoUrl,
                    previewUrl: activeVideoSrc,
                    fileName: videoFileName,
                    duration: Math.round(v.duration),
                    aspectRatio:
                      v.videoHeight >= v.videoWidth
                        ? '9:16 (Vertical)'
                        : '16:9 (Landscape)',
                    sizeMb: videoSizeMb,
                  });
                }
              }}
              className="w-full max-h-[250px] object-contain bg-black"
            />
          </div>

          <div className="md:col-span-7 space-y-3">
            <div className="p-3 rounded-lg bg-studio-subtle border border-studio-border space-y-2">
              <p className="text-xs font-semibold text-ink-primary truncate">
                {videoFileName}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge className="font-mono">{videoDuration}s</Badge>
                <Badge>{videoAspectRatio}</Badge>
                <Badge className="font-mono">{videoSizeMb} MB</Badge>
                <Badge tone="success">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Ready</span>
                </Badge>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-studio-subtle border border-studio-border space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-primary flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-accent-soft" />
                  <span>Thumbnail / Cover Frame</span>
                </span>
                <span className="text-[11px] font-mono text-ink-muted">
                  Offset {(thumbOffsetMs / 1000).toFixed(1)}s
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={Math.max(1, videoDuration)}
                  step={0.5}
                  value={seekSec}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setSeekSec(val);
                    if (videoPlayerRef.current) {
                      videoPlayerRef.current.currentTime = val;
                    }
                  }}
                  className="flex-1 accent-accent h-1.5 bg-studio-canvas rounded-lg cursor-pointer"
                />
                <Button
                  size="xs"
                  variant="primary"
                  loading={isCapturingThumb}
                  onClick={() => handleCaptureFrameAt(seekSec)}
                  icon={<Camera className="w-3 h-3" />}
                >
                  Capture ({seekSec}s)
                </Button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1">
                  {[
                    { label: '1.0s', sec: 1.0 },
                    {
                      label: '25%',
                      sec: Math.round(videoDuration * 0.25 * 10) / 10,
                    },
                    {
                      label: '50%',
                      sec: Math.round(videoDuration * 0.5 * 10) / 10,
                    },
                    {
                      label: '75%',
                      sec: Math.round(videoDuration * 0.75 * 10) / 10,
                    },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleCaptureFrameAt(preset.sec)}
                      className="px-2 py-1 rounded-md bg-studio-surface hover:bg-studio-hover border border-studio-border text-[11px] text-ink-secondary font-mono"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div>
                  <input
                    type="file"
                    ref={thumbInputRef}
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleCustomThumbUpload(e.target.files[0]);
                      }
                    }}
                  />
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={() => thumbInputRef.current?.click()}
                    icon={<ImageIcon className="w-3 h-3 text-status-success" />}
                  >
                    Upload Cover
                  </Button>
                </div>
              </div>

              {activeCoverSrc && (
                <div className="pt-2 border-t border-studio-border flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={activeCoverSrc}
                      alt="Selected cover"
                      className="w-10 h-14 rounded-md object-cover border border-accent/50"
                    />
                    <div>
                      <p className="text-xs font-medium text-status-success">
                        Custom Cover Active
                      </p>
                      <p className="text-[11px] text-ink-muted">
                        Applied to YouTube thumbnail &amp; Reels cover
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLocalCoverPreview('');
                      onCoverUpdated('', 0);
                    }}
                    className="text-[11px] text-ink-muted hover:text-status-danger"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
