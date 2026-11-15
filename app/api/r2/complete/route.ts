import { NextResponse } from 'next/server';
import { insertVideoAsset, recordAuditLog } from '@/lib/supabase';
import { isAllowedMediaFile, isSafeMediaUrl, safeErrorMessage } from '@/lib/validation';

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

    if (
      typeof r2StorageKey !== 'string' ||
      r2StorageKey.includes('..') ||
      !/^(original|thumbnails|processed)\//.test(r2StorageKey)
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid r2StorageKey' },
        { status: 400 }
      );
    }

    if (!isAllowedMediaFile(String(fileName), mimeType ? String(mimeType) : undefined)) {
      return NextResponse.json(
        { success: false, error: 'Invalid media file type' },
        { status: 400 }
      );
    }

    if (!isSafeMediaUrl(String(publicUrl)) || (thumbnailUrl && !isSafeMediaUrl(String(thumbnailUrl)))) {
      return NextResponse.json(
        { success: false, error: 'Invalid media URL' },
        { status: 400 }
      );
    }

    const assetId = await insertVideoAsset({
      fileName: String(fileName),
      fileSizeBytes: Number(fileSizeBytes || 0),
      mimeType: String(mimeType || 'video/mp4'),
      durationSec: Number(durationSec || 0),
      aspectRatio: String(aspectRatio || '9:16'),
      checksumSha256: typeof checksumSha256 === 'string' ? checksumSha256 : undefined,
      r2StorageKey,
      r2ThumbnailKey,
      r2ProcessedKey,
      publicUrl: String(publicUrl),
      thumbnailUrl: thumbnailUrl ? String(thumbnailUrl) : undefined,
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
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Error finalizing video asset in database') },
      { status: 500 }
    );
  }
}
