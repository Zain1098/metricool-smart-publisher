import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { store } from '@/lib/store';
import {
  deleteR2VideoAsset,
  isR2Configured,
  getR2BucketName,
  getR2PublicBaseUrl,
} from '@/lib/r2';
import { getSupabaseServerClient, isSupabaseConfigured } from '@/lib/supabase';
import { safeErrorMessage } from '@/lib/validation';

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
    await store.ensureSynced();
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

async function deleteSingleAsset(params: {
  id?: string | null;
  fileName?: string | null;
}): Promise<{ ok: boolean; status: number; message?: string; error?: string }> {
  const { id, fileName } = params;
  const rawBaseName = fileName ? path.basename(fileName) : '';
  const safeFile = rawBaseName
    ? rawBaseName.replace(/[^a-zA-Z0-9._-]/g, '_')
    : '';
  const localIdFile = id && id.startsWith('local_') ? path.basename(id.slice('local_'.length)) : '';
  const candidateFiles = Array.from(
    new Set([rawBaseName, safeFile, localIdFile].filter((f) => Boolean(f) && !f.includes('..')))
  );

  const posts = store.getPosts();
  const activeRef = posts.some(
    (p) =>
      (p.status === 'scheduled' ||
        p.status === 'scheduled_on_platform' ||
        p.status === 'publishing') &&
      (candidateFiles.some(
        (f) => p.mediaFileName === f || p.mediaUrl.includes(encodeURIComponent(f)) || p.mediaUrl.includes(f)
      ) ||
        (id && p.id && `post_media_${p.id}` === id))
  );
  if (activeRef) {
    return {
      ok: false,
      status: 409,
      error: 'Cannot delete file while it is referenced by an active scheduled post. Cancel or delete the scheduled post first.',
    };
  }

  let deleted = false;

  // 1. Try deleting from Supabase + Cloudflare R2 if configured
  if (isSupabaseConfigured()) {
    const client = getSupabaseServerClient();
    if (client) {
      let query = client
        .from('metricool_video_assets')
        .select('*')
        .eq('is_deleted', false)
        .limit(1);

      if (id && !id.startsWith('local_') && !id.startsWith('post_media_')) {
        query = query.eq('id', id);
      } else if (rawBaseName) {
        query = query.eq('file_name', rawBaseName);
      }

      const { data: rows } = await query;
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row) {
        if (isR2Configured() && row.r2_storage_key) {
          const r2Res = await deleteR2VideoAsset({
            assetId: String(row.id),
            storageKey: String(row.r2_storage_key),
            thumbnailKey: row.r2_thumbnail_key ? String(row.r2_thumbnail_key) : undefined,
            processedKey: row.r2_processed_key ? String(row.r2_processed_key) : undefined,
          });
          if (!r2Res.success) {
            return {
              ok: false,
              status: 400,
              error: r2Res.error || 'Failed to delete from Cloudflare R2.',
            };
          }
        }
        await client
          .from('metricool_video_assets')
          .update({ is_deleted: true })
          .eq('id', row.id);
        deleted = true;
      }
    }
  }

  // 2. Try deleting local upload file if present (supports spaces/special chars in filename)
  for (const dir of getCandidateUploadDirs()) {
    for (const candidate of candidateFiles) {
      const target = path.join(dir, candidate);
      if (fs.existsSync(target)) {
        fs.unlinkSync(target);
        deleted = true;
      }
    }
  }

  // 3. If asset was only referenced on a draft/published/failed post, unlink it from the post
  if (id && id.startsWith('post_media_')) {
    const postId = id.slice('post_media_'.length);
    const targetPost = posts.find((p) => p.id === postId);
    if (targetPost) {
      store.updatePost(postId, { mediaUrl: '', coverUrl: '' });
      deleted = true;
    }
  }

  if (!deleted) {
    return {
      ok: false,
      status: 404,
      error: 'Asset not found or already deleted.',
    };
  }

  return { ok: true, status: 200, message: `${fileName || id} deleted.` };
}

export async function DELETE(req: Request) {
  try {
    await store.ensureSynced();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const fileName = searchParams.get('fileName');

    // Support bulk JSON delete body: { items: [{ id, fileName }] }
    if (!id && !fileName) {
      const body = (await req.json().catch(() => null)) as {
        items?: Array<{ id?: string; fileName?: string }>;
      } | null;
      if (!body?.items || !Array.isArray(body.items) || body.items.length === 0) {
        return NextResponse.json(
          { success: false, error: 'id, fileName, or items[] is required' },
          { status: 400 }
        );
      }

      let deletedCount = 0;
      const errors: string[] = [];
      for (const item of body.items) {
        const res = await deleteSingleAsset(item);
        if (res.ok) deletedCount++;
        else if (res.error) errors.push(res.error);
      }
      return NextResponse.json({
        success: deletedCount > 0,
        deletedCount,
        errors,
        message: `Deleted ${deletedCount} asset(s).`,
      });
    }

    const res = await deleteSingleAsset({ id, fileName });
    if (!res.ok) {
      return NextResponse.json({ success: false, error: res.error }, { status: res.status });
    }
    return NextResponse.json({ success: true, message: res.message });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Delete error') },
      { status: 500 }
    );
  }
}
