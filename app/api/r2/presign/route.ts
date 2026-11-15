import { NextResponse } from 'next/server';
import { createPresignedUploadUrl, isR2Configured } from '@/lib/r2';
import {
  ALLOWED_R2_FOLDERS,
  isAllowedMediaFile,
  safeErrorMessage,
} from '@/lib/validation';

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

    if (!isAllowedMediaFile(String(fileName), String(mimeType))) {
      return NextResponse.json(
        { success: false, error: 'Unsupported media file type or MIME type.' },
        { status: 400 }
      );
    }

    const sizeNum = Number(fileSizeBytes);
    const MAX_SIZE = 500 * 1024 * 1024;
    if (!Number.isFinite(sizeNum) || sizeNum <= 0 || sizeNum > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File size must be between 1 byte and 500MB.' },
        { status: 400 }
      );
    }

    const safeFolder = ALLOWED_R2_FOLDERS.has(String(folder || 'original'))
      ? (folder as 'original' | 'thumbnails' | 'processed')
      : 'original';

    const presigned = await createPresignedUploadUrl({
      fileName: String(fileName),
      fileSizeBytes: sizeNum,
      mimeType: String(mimeType),
      checksumSha256: typeof checksumSha256 === 'string' ? checksumSha256 : undefined,
      folder: safeFolder,
    });

    return NextResponse.json({
      success: true,
      fallbackLocal: false,
      ...presigned,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Presigned URL generation error') },
      { status: 500 }
    );
  }
}
