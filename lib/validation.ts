export const ALLOWED_MEDIA_EXTENSIONS = new Set([
  '.mp4',
  '.mov',
  '.webm',
  '.mkv',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
]);

export const ALLOWED_MEDIA_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-matroska',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export const ALLOWED_R2_FOLDERS = new Set(['original', 'thumbnails', 'processed']);

export function isAllowedMediaFile(fileName: string, mimeType?: string): boolean {
  const dotIdx = fileName.lastIndexOf('.');
  if (dotIdx === -1) return false;
  const ext = fileName.slice(dotIdx).toLowerCase();
  if (!ALLOWED_MEDIA_EXTENSIONS.has(ext)) return false;
  if (mimeType && !ALLOWED_MEDIA_MIME_TYPES.has(mimeType.toLowerCase())) {
    return false;
  }
  return true;
}

export function isSafeMediaUrl(url: string): boolean {
  if (!url) return true;
  if (url.startsWith('/api/upload?file=')) return true;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:') return true;
    if (
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function safeErrorMessage(err: unknown, fallback: string): string {
  if (process.env.NODE_ENV === 'production') {
    return fallback;
  }
  return err instanceof Error ? err.message : fallback;
}
