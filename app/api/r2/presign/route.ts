import { NextResponse } from 'next/server';
import { createPresignedUploadUrl, isR2Configured } from '@/lib/r2';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    if (!isR2Configured()) {
      return NextResponse.json(
        {
          success: false,
          fallbackLocal: true,
          error: 'Cloudflare R2 is not configured. Falling back to local upload.',
        },
        { status: 200 }
      );
    }

    const body = await req.json();
    const { fileName, fileSizeBytes, mimeType, checksumSha256, folder } = body;

    if (!fileName || !fileSizeBytes || !mimeType) {
      return NextResponse.json(
        { success: false, error: 'Missing required file metadata: fileName, fileSizeBytes, mimeType' },
        { status: 400 }
      );
    }

    // Max upload size limit: 500MB
    const MAX_SIZE = 500 * 1024 * 1024;
    if (fileSizeBytes > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds maximum limit of 500MB.' },
        { status: 400 }
      );
    }

    const presigned = await createPresignedUploadUrl({
      fileName,
      fileSizeBytes: Number(fileSizeBytes),
      mimeType,
      checksumSha256,
      folder: folder || 'original',
    });

    return NextResponse.json({
      success: true,
      fallbackLocal: false,
      ...presigned,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Presigned URL generation error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
