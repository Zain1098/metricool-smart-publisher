import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  CompletedPart,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  findVideoByChecksum,
  insertVideoAsset,
  isVideoInActiveUse,
  recordAuditLog,
} from './supabase';

let cachedR2Client: S3Client | null = null;

export function isR2Configured(): boolean {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKey = process.env.R2_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME || process.env.S3_BUCKET_NAME;

  return Boolean((accountId || process.env.S3_ENDPOINT) && accessKey && secretKey && bucket);
}

export function getR2Client(): S3Client | null {
  if (!isR2Configured()) return null;
  if (cachedR2Client) return cachedR2Client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const endpoint =
    process.env.S3_ENDPOINT ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);

  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID)!;
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY)!;

  cachedR2Client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return cachedR2Client;
}

export function getR2BucketName(): string {
  return process.env.R2_BUCKET_NAME || process.env.S3_BUCKET_NAME || 'zcodedev-metricool-videos';
}

export function getR2PublicBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_S3_PUBLIC_DOMAIN ||
    ''
  ).replace(/\/$/, '');
}

// ------------------------------------------------------------------------------
// Direct Browser-to-R2 Presigned URL Generation
// ------------------------------------------------------------------------------
export interface PresignedUploadResponse {
  uploadUrl: string;
  storageKey: string;
  publicUrl: string;
  isDuplicate?: boolean;
  existingAssetId?: string;
  expiresInSeconds: number;
}

export async function createPresignedUploadUrl(options: {
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  checksumSha256?: string;
  folder?: 'original' | 'thumbnails' | 'processed';
}): Promise<PresignedUploadResponse> {
  const s3 = getR2Client();
  if (!s3) {
    throw new Error('Cloudflare R2 is not configured. Please set R2 credentials in environment variables.');
  }

  // 1. Duplicate check via Checksum SHA-256 (if supplied)
  if (options.checksumSha256) {
    const existing = await findVideoByChecksum(options.checksumSha256);
    if (existing) {
      return {
        uploadUrl: '',
        storageKey: existing.r2StorageKey,
        publicUrl: existing.publicUrl,
        isDuplicate: true,
        existingAssetId: existing.id,
        expiresInSeconds: 0,
      };
    }
  }

  // 2. Validate MIME type & file extension
  const safeName = options.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const allowedExtensions = ['.mp4', '.mov', '.webm', '.mkv', '.jpg', '.jpeg', '.png', '.webp'];
  const ext = safeName.substring(safeName.lastIndexOf('.')).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    throw new Error(`File format "${ext}" is not supported. Supported: MP4, MOV, WebM, MKV, JPG, PNG, WebP.`);
  }

  const folder = options.folder || 'original';
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 9);
  const storageKey = `videos/${folder}/${timestamp}_${randomSuffix}_${safeName}`;

  const bucket = getR2BucketName();
  const expiresIn = 3600; // 1 hour

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    ContentType: options.mimeType,
    ContentLength: options.fileSizeBytes,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn });

  const publicBase = getR2PublicBaseUrl();
  const publicUrl = publicBase
    ? `${publicBase}/${storageKey}`
    : `/api/r2/stream?key=${encodeURIComponent(storageKey)}`;

  return {
    uploadUrl,
    storageKey,
    publicUrl,
    isDuplicate: false,
    expiresInSeconds: expiresIn,
  };
}

// ------------------------------------------------------------------------------
// Multipart Upload Helpers (For Videos > 50MB)
// ------------------------------------------------------------------------------
export async function startMultipartUpload(options: {
  fileName: string;
  mimeType: string;
  folder?: 'original' | 'processed';
}): Promise<{ uploadId: string; storageKey: string }> {
  const s3 = getR2Client();
  if (!s3) throw new Error('Cloudflare R2 is not configured.');

  const folder = options.folder || 'original';
  const safeName = options.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storageKey = `videos/${folder}/${Date.now()}_mp_${safeName}`;

  const command = new CreateMultipartUploadCommand({
    Bucket: getR2BucketName(),
    Key: storageKey,
    ContentType: options.mimeType,
  });

  const res = await s3.send(command);
  if (!res.UploadId) throw new Error('Failed to initiate R2 multipart upload.');

  return { uploadId: res.UploadId, storageKey };
}

export async function getMultipartPartUrl(options: {
  uploadId: string;
  storageKey: string;
  partNumber: number;
}): Promise<string> {
  const s3 = getR2Client();
  if (!s3) throw new Error('Cloudflare R2 is not configured.');

  const command = new UploadPartCommand({
    Bucket: getR2BucketName(),
    Key: options.storageKey,
    UploadId: options.uploadId,
    PartNumber: options.partNumber,
  });

  return await getSignedUrl(s3, command, { expiresIn: 3600 });
}

export async function finishMultipartUpload(options: {
  uploadId: string;
  storageKey: string;
  parts: CompletedPart[];
}): Promise<{ storageKey: string; publicUrl: string }> {
  const s3 = getR2Client();
  if (!s3) throw new Error('Cloudflare R2 is not configured.');

  const command = new CompleteMultipartUploadCommand({
    Bucket: getR2BucketName(),
    Key: options.storageKey,
    UploadId: options.uploadId,
    MultipartUpload: {
      Parts: options.parts.sort((a, b) => (a.PartNumber || 0) - (b.PartNumber || 0)),
    },
  });

  await s3.send(command);

  const publicBase = getR2PublicBaseUrl();
  const publicUrl = publicBase
    ? `${publicBase}/${options.storageKey}`
    : `/api/r2/stream?key=${encodeURIComponent(options.storageKey)}`;

  return { storageKey: options.storageKey, publicUrl };
}

export async function cancelMultipartUpload(options: {
  uploadId: string;
  storageKey: string;
}): Promise<void> {
  const s3 = getR2Client();
  if (!s3) return;

  const command = new AbortMultipartUploadCommand({
    Bucket: getR2BucketName(),
    Key: options.storageKey,
    UploadId: options.uploadId,
  });

  await s3.send(command).catch((err) => console.warn('[R2] Cancel multipart warning:', err));
}

// ------------------------------------------------------------------------------
// Secure Access & Streaming URLs
// ------------------------------------------------------------------------------
export async function getSecurePresignedReadUrl(storageKey: string, expiresIn = 86400): Promise<string> {
  const s3 = getR2Client();
  if (!s3) {
    return `/api/upload?file=${encodeURIComponent(storageKey)}`;
  }

  const command = new GetObjectCommand({
    Bucket: getR2BucketName(),
    Key: storageKey,
  });

  return await getSignedUrl(s3, command, { expiresIn });
}

// ------------------------------------------------------------------------------
// Safe Video Deletion & Retention Enforcer
// Rule: NEVER delete a video while referenced by an active scheduled post.
// ------------------------------------------------------------------------------
export async function deleteR2VideoAsset(options: {
  assetId: string;
  storageKey: string;
  thumbnailKey?: string;
  processedKey?: string;
}): Promise<{ success: boolean; error?: string }> {
  // 1. Active Post Dependency Check
  const inUse = await isVideoInActiveUse(options.assetId);
  if (inUse) {
    return {
      success: false,
      error: 'Cannot delete video: it is currently referenced by a scheduled or unpublished post.',
    };
  }

  const s3 = getR2Client();
  if (!s3) {
    return { success: false, error: 'R2 storage client is not configured.' };
  }

  const bucket = getR2BucketName();

  try {
    // Delete original video from R2
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: options.storageKey }));

    // Delete thumbnail if present
    if (options.thumbnailKey) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: options.thumbnailKey })).catch(() => {});
    }

    // Delete processed video if present
    if (options.processedKey) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: options.processedKey })).catch(() => {});
    }

    await recordAuditLog({
      action: 'VIDEO_DELETED',
      entityType: 'video',
      entityId: options.assetId,
      metadata: { storageKey: options.storageKey },
    });

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'R2 delete error';
    return { success: false, error: errorMsg };
  }
}
