import { NextResponse } from 'next/server';
import {
  startMultipartUpload,
  getMultipartPartUrl,
  finishMultipartUpload,
  cancelMultipartUpload,
  isR2Configured,
} from '@/lib/r2';
import {
  ALLOWED_R2_FOLDERS,
  isAllowedMediaFile,
  safeErrorMessage,
} from '@/lib/validation';

export const dynamic = 'force-dynamic';

function isValidR2Key(key: unknown): key is string {
  if (typeof key !== 'string' || key.length === 0 || key.includes('..')) return false;
  return /^(original|thumbnails|processed)\//.test(key);
}

export async function POST(req: Request) {
  try {
    if (!isR2Configured()) {
      return NextResponse.json(
        { success: false, error: 'R2 storage is not configured for multipart upload.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'start': {
        const { fileName, mimeType, folder } = body;
        const resolvedMime = String(mimeType || 'video/mp4');
        if (!fileName || !isAllowedMediaFile(String(fileName), resolvedMime)) {
          return NextResponse.json(
            { success: false, error: 'Valid media fileName and mimeType are required' },
            { status: 400 }
          );
        }
        const safeFolder: 'original' | 'processed' =
          folder === 'processed' ? 'processed' : 'original';
        const res = await startMultipartUpload({
          fileName: String(fileName),
          mimeType: resolvedMime,
          folder: safeFolder,
        });
        return NextResponse.json({ success: true, ...res });
      }

      case 'get-part-url': {
        const { uploadId, storageKey, partNumber } = body;
        const partNum = Number(partNumber);
        if (
          !uploadId ||
          !isValidR2Key(storageKey) ||
          !Number.isInteger(partNum) ||
          partNum < 1 ||
          partNum > 1000
        ) {
          return NextResponse.json(
            { success: false, error: 'Valid uploadId, storageKey and partNumber (1-1000) are required' },
            { status: 400 }
          );
        }
        const partUrl = await getMultipartPartUrl({
          uploadId: String(uploadId),
          storageKey,
          partNumber: partNum,
        });
        return NextResponse.json({ success: true, partUrl });
      }

      case 'complete': {
        const { uploadId, storageKey, parts } = body;
        if (!uploadId || !isValidR2Key(storageKey) || !Array.isArray(parts) || parts.length === 0) {
          return NextResponse.json(
            { success: false, error: 'Valid uploadId, storageKey and parts array are required' },
            { status: 400 }
          );
        }
        const completed = await finishMultipartUpload({
          uploadId: String(uploadId),
          storageKey,
          parts,
        });
        return NextResponse.json({ success: true, ...completed });
      }

      case 'abort': {
        const { uploadId, storageKey } = body;
        if (uploadId && isValidR2Key(storageKey)) {
          await cancelMultipartUpload({ uploadId: String(uploadId), storageKey });
        }
        return NextResponse.json({ success: true, message: 'Multipart upload aborted.' });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Invalid action "${action}". Allowed: start, get-part-url, complete, abort` },
          { status: 400 }
        );
    }
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Multipart upload error') },
      { status: 500 }
    );
  }
}
