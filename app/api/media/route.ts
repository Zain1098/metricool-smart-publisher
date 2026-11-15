import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { store } from '@/lib/store';
import { isR2Configured, getR2BucketName, getR2PublicBaseUrl } from '@/lib/r2';
import { getSupabaseServerClient, isSupabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export interface MediaAssetItem {
  id: string;
  fileName: string;
  url: string;
  thumbnailUrl?: string;
  mediaType: 'video' | 'image';
  sizeMb: number;
  durationSec?: number;
  aspectRatio?: string;
  source: 'local' | 'r2' | 'post';
  status: 'ready' | 'processing' | 'in_use';
  createdAt: string;
  usedInPostsCount: number;
}

function getCandidateUploadDirs(): string[] {
  const dirs: string[] = [];
  const localDir = path.join(process.cwd(), 'public', 'uploads');
  const tmpDir = path.join(os.tmpdir(), 'metricool-uploads');
  if (fs.existsSync(localDir)) dirs.push(localDir);
  if (fs.existsSync(tmpDir) && tmpDir !== localDir) dirs.push(tmpDir);
  return dirs;
}

export async function GET() {
  try {
    const posts = store.getPosts();
    const assetMap = new Map<string, MediaAssetItem>();

    // Count how many posts reference each URL
    const usageCounts = new Map<string, number>();
    for (const post of posts) {
      if (post.mediaUrl) {
        usageCounts.set(post.mediaUrl, (usageCounts.get(post.mediaUrl) || 0) + 1);
      }
      if (post.coverUrl) {
        usageCounts.set(post.coverUrl, (usageCounts.get(post.coverUrl) || 0) + 1);
      }
    }

    // 1. Scan local upload directories (videos + images)
    for (const dir of getCandidateUploadDirs()) {
      try {
        const entries = fs.readdirSync(dir);
        for (const f of entries) {
          if (f.endsWith('.part')) continue;
          const isVideo = /\.(mp4|mov|webm|mkv)$/i.test(f);
          const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(f);
          if (!isVideo && !isImage) continue;

          const full = path.join(dir, f);
          const stat = fs.statSync(full);
          const url = `/api/upload?file=${encodeURIComponent(f)}`;
          const usedCount = usageCounts.get(url) || 0;

          if (!assetMap.has(url)) {
            assetMap.set(url, {
              id: `local_${f}`,
              fileName: f,
              url,
              thumbnailUrl: isImage ? url : undefined,
              mediaType: isVideo ? 'video' : 'image',
              sizeMb: Number((stat.size / (1024 * 1024)).toFixed(2)),
              source: 'local',
              status: usedCount > 0 ? 'in_use' : 'ready',
              createdAt: stat.mtime.toISOString(),
              usedInPostsCount: usedCount,
            });
          }
        }
      } catch {
        // ignore read error for individual directory
      }
    }

    // 2. Include Supabase metricool_video_assets if configured
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseServerClient();
        if (client) {
          const { data } = await client
            .from('metricool_video_assets')
            .select('*')
            .eq('is_deleted', false)
            .order('created_at', { ascending: false })
            .limit(100);

          if (Array.isArray(data)) {
            for (const row of data) {
              const url = row.public_url as string;
              if (!url) continue;
              const usedCount = usageCounts.get(url) || 0;
              const isImg = String(row.mime_type || '').startsWith('image/');
              assetMap.set(url, {
                id: String(row.id),
                fileName: String(row.file_name || 'asset'),
                url,
                thumbnailUrl: row.thumbnail_url || undefined,
                mediaType: isImg ? 'image' : 'video',
                sizeMb: Number((Number(row.file_size_bytes || 0) / (1024 * 1024)).toFixed(2)),
                durationSec: row.duration_sec ? Number(row.duration_sec) : undefined,
                aspectRatio: row.aspect_ratio || undefined,
                source: 'r2',
                status:
                  row.status === 'processing'
                    ? 'processing'
                    : usedCount > 0
                    ? 'in_use'
                    : 'ready',
                createdAt: row.created_at || new Date().toISOString(),
                usedInPostsCount: usedCount,
              });
            }
          }
        }
      } catch {
        // Supabase assets table might not exist yet
      }
    }

    // 3. Include media referenced on scheduled/published posts that aren't already listed
    for (const post of posts) {
      if (post.mediaUrl && !post.mediaUrl.startsWith('blob:') && !assetMap.has(post.mediaUrl)) {
        const usedCount = usageCounts.get(post.mediaUrl) || 1;
        assetMap.set(post.mediaUrl, {
          id: `post_media_${post.id}`,
          fileName: post.mediaFileName || 'post_media.mp4',
          url: post.mediaUrl,
          thumbnailUrl: post.coverUrl,
          mediaType: post.mediaType === 'image' ? 'image' : 'video',
          sizeMb: Number(post.mediaSizeMb || 0),
          durationSec: post.mediaDurationSec,
          aspectRatio: post.mediaAspectRatio,
          source: post.mediaUrl.includes('/api/upload') ? 'local' : 'post',
          status: 'in_use',
          createdAt: post.createdAt,
          usedInPostsCount: usedCount,
        });
      }
    }

    const assets = Array.from(assetMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const totalSizeMb = Number(
      assets.reduce((sum, a) => sum + (a.sizeMb || 0), 0).toFixed(2)
    );

    return NextResponse.json({
      success: true,
      assets,
      stats: {
        totalCount: assets.length,
        videoCount: assets.filter((a) => a.mediaType === 'video').length,
        imageCount: assets.filter((a) => a.mediaType === 'image').length,
        totalSizeMb,
        storageProvider: isR2Configured() ? 'Cloudflare R2' : 'Local / Temp Storage',
        r2Configured: isR2Configured(),
        r2Bucket: isR2Configured() ? getR2BucketName() : null,
        r2PublicBaseUrl: getR2PublicBaseUrl() || null,
        supabaseConfigured: isSupabaseConfigured(),
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to list media assets';
    return NextResponse.json({ success: false, error: errorMsg, assets: [] }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fileName = searchParams.get('fileName');
    if (!fileName) {
      return NextResponse.json({ success: false, error: 'fileName is required' }, { status: 400 });
    }
    const safeFile = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');

    const posts = store.getPosts();
    const activeRef = posts.some(
      (p) =>
        (p.status === 'scheduled' || p.status === 'scheduled_on_platform' || p.status === 'publishing') &&
        (p.mediaFileName === safeFile || p.mediaUrl.includes(encodeURIComponent(safeFile)))
    );
    if (activeRef) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot delete file while it is referenced by an active scheduled post.',
        },
        { status: 409 }
      );
    }

    let deleted = false;
    for (const dir of getCandidateUploadDirs()) {
      const target = path.join(dir, safeFile);
      if (fs.existsSync(target)) {
        fs.unlinkSync(target);
        deleted = true;
      }
    }

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Local file not found or stored externally.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: `${safeFile} deleted.` });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Delete error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
