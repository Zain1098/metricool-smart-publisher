import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Readable } from 'stream';
import { isAllowedMediaFile, safeErrorMessage } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const MAX_LOCAL_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB
const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_CHUNKS = 200;

function getUploadsDir(): string {
  const isServerless = Boolean(
    process.env.VERCEL ||
      process.env.NETLIFY ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.cwd().startsWith('/var/task')
  );

  if (!isServerless) {
    try {
      const localDir = path.join(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }
      return localDir;
    } catch {
      // Fall back to os.tmpdir() if local dir is read-only
    }
  }

  const tmpDir = path.join(os.tmpdir(), 'metricool-uploads');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  return tmpDir;
}

function findUploadedFile(safeFile: string): string | null {
  const localCandidate = path.join(process.cwd(), 'public', 'uploads', safeFile);
  if (fs.existsSync(localCandidate)) return localCandidate;

  const tmpCandidate = path.join(os.tmpdir(), 'metricool-uploads', safeFile);
  if (fs.existsSync(tmpCandidate)) return tmpCandidate;

  return null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedFile = searchParams.get('file');

    if (requestedFile) {
      const safeFile = path.basename(requestedFile).replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = findUploadedFile(safeFile);
      if (!filePath) {
        return NextResponse.json(
          { success: false, error: 'File not found' },
          { status: 404 }
        );
      }

      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const ext = path.extname(safeFile).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.mp4': 'video/mp4',
        '.mov': 'video/quicktime',
        '.webm': 'video/webm',
        '.mkv': 'video/x-matroska',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
      };
      const contentType = mimeMap[ext] || 'application/octet-stream';
      const range = req.headers.get('range');

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const safeStart = Number.isFinite(start) ? start : 0;
        const maxChunk = 4 * 1024 * 1024; // 4MB max per range response
        const requestedEnd = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const safeReqEnd = Number.isFinite(requestedEnd) ? requestedEnd : fileSize - 1;
        const end = Math.min(safeReqEnd, safeStart + maxChunk - 1, fileSize - 1);

        if (safeStart < 0 || safeStart >= fileSize || end < safeStart) {
          return new NextResponse(null, {
            status: 416,
            headers: { 'Content-Range': `bytes */${fileSize}` },
          });
        }

        const chunkLength = end - safeStart + 1;
        const buf = Buffer.alloc(chunkLength);
        const fd = fs.openSync(filePath, 'r');
        try {
          fs.readSync(fd, buf, 0, chunkLength, safeStart);
        } finally {
          fs.closeSync(fd);
        }

        return new NextResponse(buf, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${safeStart}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunkLength),
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }

      const nodeStream = fs.createReadStream(filePath);
      const webStream = Readable.toWeb(nodeStream) as ReadableStream;
      return new NextResponse(webStream, {
        status: 200,
        headers: {
          'Accept-Ranges': 'bytes',
          'Content-Length': String(fileSize),
          'Content-Type': contentType,
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }

    const uploadsDir = getUploadsDir();
    if (!fs.existsSync(uploadsDir)) {
      return NextResponse.json({ success: true, files: [] });
    }
    const entries = fs.readdirSync(uploadsDir);
    const videoFiles = entries
      .filter((f) => /\.(mp4|mov|webm|mkv)$/i.test(f) && !f.endsWith('.part'))
      .map((f) => {
        const full = path.join(uploadsDir, f);
        const stat = fs.statSync(full);
        return {
          fileName: f,
          url: `/api/upload?file=${encodeURIComponent(f)}`,
          sizeMb: Number((stat.size / (1024 * 1024)).toFixed(1)),
          createdAt: stat.mtime.toISOString(),
        };
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    return NextResponse.json({ success: true, files: videoFiles });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Read error';
    return NextResponse.json({ success: true, files: [], note: errorMsg });
  }
}

export async function POST(req: Request) {
  try {
    const uploadsDir = getUploadsDir();
    const isChunkUpload = req.headers.get('x-upload-chunk') === 'true';

    // 1. Chunked binary upload (handles large MP4/MOV files with strict validation)
    if (isChunkUpload) {
      const rawFileId = req.headers.get('x-file-id') || `video_${Date.now()}.mp4`;
      const safeFileId = path.basename(rawFileId).replace(/[^a-zA-Z0-9._-]/g, '_');
      if (!isAllowedMediaFile(safeFileId)) {
        return NextResponse.json(
          { success: false, error: 'Unsupported media file extension.' },
          { status: 400 }
        );
      }

      const chunkIndex = parseInt(req.headers.get('x-chunk-index') || '0', 10);
      const totalChunks = parseInt(req.headers.get('x-total-chunks') || '1', 10);
      if (
        !Number.isInteger(chunkIndex) ||
        !Number.isInteger(totalChunks) ||
        chunkIndex < 0 ||
        totalChunks < 1 ||
        totalChunks > MAX_CHUNKS ||
        chunkIndex >= totalChunks
      ) {
        return NextResponse.json(
          { success: false, error: 'Invalid chunk index or total chunks.' },
          { status: 400 }
        );
      }

      const originalName = decodeURIComponent(
        req.headers.get('x-original-name') || safeFileId
      );

      const arrayBuffer = await req.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const destinationPath = path.join(uploadsDir, safeFileId);

      const currentSize =
        chunkIndex > 0 && fs.existsSync(destinationPath)
          ? fs.statSync(destinationPath).size
          : 0;
      if (currentSize + buffer.length > MAX_LOCAL_UPLOAD_BYTES) {
        return NextResponse.json(
          { success: false, error: 'Upload exceeds 100MB local fallback limit.' },
          { status: 413 }
        );
      }

      if (chunkIndex === 0) {
        fs.writeFileSync(destinationPath, buffer);
      } else {
        fs.appendFileSync(destinationPath, buffer);
      }

      const isDone = chunkIndex + 1 >= totalChunks;
      let totalSizeMb = 0;
      if (isDone && fs.existsSync(destinationPath)) {
        const stat = fs.statSync(destinationPath);
        totalSizeMb = Number((stat.size / (1024 * 1024)).toFixed(1));
      }

      return NextResponse.json({
        success: true,
        chunkIndex,
        totalChunks,
        done: isDone,
        url: `/api/upload?file=${encodeURIComponent(safeFileId)}`,
        fileName: originalName,
        sizeMb: totalSizeMb,
      });
    }

    const contentType = req.headers.get('content-type') || '';

    // 2. Base64 frame capture upload (from video thumbnail scrubber)
    if (contentType.includes('application/json')) {
      const body = await req.json();
      if (!body.dataUrl || typeof body.dataUrl !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Missing dataUrl for frame thumbnail' },
          { status: 400 }
        );
      }
      const matches = body.dataUrl.match(
        /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/
      );
      if (!matches) {
        return NextResponse.json(
          { success: false, error: 'Invalid image dataUrl format' },
          { status: 400 }
        );
      }
      const ext = matches[1] === 'png' ? 'png' : 'jpg';
      const buffer = Buffer.from(matches[2], 'base64');
      if (buffer.length > MAX_THUMBNAIL_BYTES) {
        return NextResponse.json(
          { success: false, error: 'Thumbnail exceeds 5MB limit' },
          { status: 413 }
        );
      }
      const uniqueFileName = `thumb_${Date.now()}.${ext}`;
      const destinationPath = path.join(uploadsDir, uniqueFileName);
      fs.writeFileSync(destinationPath, buffer);

      return NextResponse.json({
        success: true,
        url: `/api/upload?file=${encodeURIComponent(uniqueFileName)}`,
        fileName: uniqueFileName,
        sizeMb: Number((buffer.length / (1024 * 1024)).toFixed(2)),
      });
    }

    // 3. Standard multipart form upload (custom cover image or small video)
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!isAllowedMediaFile(file.name, file.type || undefined)) {
      return NextResponse.json(
        { success: false, error: 'Unsupported file type or MIME type.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_LOCAL_UPLOAD_BYTES) {
      return NextResponse.json(
        { success: false, error: 'File exceeds 100MB local fallback limit.' },
        { status: 413 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueFileName = `${Date.now()}_${safeName}`;
    const destinationPath = path.join(uploadsDir, uniqueFileName);

    fs.writeFileSync(destinationPath, buffer);

    const publicUrl = `/api/upload?file=${encodeURIComponent(uniqueFileName)}`;
    const sizeMb = Number((file.size / (1024 * 1024)).toFixed(1));

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName: file.name,
      sizeMb,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err, 'Upload failed') },
      { status: 500 }
    );
  }
}
