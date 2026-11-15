import { NextResponse } from 'next/server';
import { insertVideoAsset, recordAuditLog } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      fileName,
      fileSizeBytes,
      mimeType,
      durationSec,
      aspectRatio,
      checksumSha256,
      r2StorageKey,
      r2ThumbnailKey,
      r2ProcessedKey,
      publicUrl,
      thumbnailUrl,
    } = body;

    if (!fileName || !r2StorageKey || !publicUrl) {
      return NextResponse.json(
        { success: false, error: 'Missing mandatory fields: fileName, r2StorageKey, publicUrl' },
        { status: 400 }
      );
    }

    const assetId = await insertVideoAsset({
      fileName,
      fileSizeBytes: Number(fileSizeBytes || 0),
      mimeType: mimeType || 'video/mp4',
      durationSec: Number(durationSec || 0),
      aspectRatio: aspectRatio || '9:16',
      checksumSha256: checksumSha256 || undefined,
      r2StorageKey,
      r2ThumbnailKey,
      r2ProcessedKey,
      publicUrl,
      thumbnailUrl,
      status: 'ready',
    });

    await recordAuditLog({
      action: 'VIDEO_REGISTERED',
      entityType: 'video',
      entityId: assetId || r2StorageKey,
      metadata: { fileName, fileSizeBytes, publicUrl },
    });

    return NextResponse.json({
      success: true,
      assetId,
      publicUrl,
      storageKey: r2StorageKey,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error finalizing video asset in database';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
