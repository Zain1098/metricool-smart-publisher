import { NextResponse } from 'next/server';
import {
  startMultipartUpload,
  getMultipartPartUrl,
  finishMultipartUpload,
  cancelMultipartUpload,
  isR2Configured,
} from '@/lib/r2';

export const dynamic = 'force-dynamic';

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
        if (!fileName) {
          return NextResponse.json({ success: false, error: 'fileName is required' }, { status: 400 });
        }
        const res = await startMultipartUpload({
          fileName,
          mimeType: mimeType || 'video/mp4',
          folder: folder || 'original',
        });
        return NextResponse.json({ success: true, ...res });
      }

      case 'get-part-url': {
        const { uploadId, storageKey, partNumber } = body;
        if (!uploadId || !storageKey || !partNumber) {
          return NextResponse.json(
            { success: false, error: 'uploadId, storageKey and partNumber are required' },
            { status: 400 }
          );
        }
        const partUrl = await getMultipartPartUrl({
          uploadId,
          storageKey,
          partNumber: Number(partNumber),
        });
        return NextResponse.json({ success: true, partUrl });
      }

      case 'complete': {
        const { uploadId, storageKey, parts } = body;
        if (!uploadId || !storageKey || !Array.isArray(parts)) {
          return NextResponse.json(
            { success: false, error: 'uploadId, storageKey and parts array are required' },
            { status: 400 }
          );
        }
        const completed = await finishMultipartUpload({
          uploadId,
          storageKey,
          parts,
        });
        return NextResponse.json({ success: true, ...completed });
      }

      case 'abort': {
        const { uploadId, storageKey } = body;
        if (uploadId && storageKey) {
          await cancelMultipartUpload({ uploadId, storageKey });
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
    const errorMsg = err instanceof Error ? err.message : 'Multipart upload error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
