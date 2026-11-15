import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ScheduledPost, ConnectedAccount, BrandSettings, AnalyticsMetric } from './types';

let cachedServerClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key && url.startsWith('http'));
}

export function getSupabaseServerClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (cachedServerClient) return cachedServerClient;

  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)!;
  // Prefer service role key on server-side for full admin/RLS bypass
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;

  cachedServerClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedServerClient;
}

// ------------------------------------------------------------------------------
// Video Assets Metadata Layer (Never stores binary data in DB)
// ------------------------------------------------------------------------------
export interface VideoAssetRecord {
  id: string;
  userId?: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  durationSec?: number;
  aspectRatio?: string;
  checksumSha256?: string;
  r2StorageKey: string;
  r2ThumbnailKey?: string;
  r2ProcessedKey?: string;
  publicUrl: string;
  thumbnailUrl?: string;
  status: 'uploading' | 'ready' | 'processing' | 'archived' | 'deleted';
  retentionDays?: number;
}

export async function insertVideoAsset(asset: Omit<VideoAssetRecord, 'id'> & { id?: string }): Promise<string | null> {
  const client = getSupabaseServerClient();
  if (!client) return null;

  const { data, error } = await client
    .from('metricool_video_assets')
    .insert({
      file_name: asset.fileName,
      file_size_bytes: asset.fileSizeBytes,
      mime_type: asset.mimeType,
      duration_sec: asset.durationSec || 0,
      aspect_ratio: asset.aspectRatio || '9:16',
      checksum_sha256: asset.checksumSha256,
      r2_storage_key: asset.r2StorageKey,
      r2_thumbnail_key: asset.r2ThumbnailKey,
      r2_processed_key: asset.r2ProcessedKey,
      public_url: asset.publicUrl,
      thumbnail_url: asset.thumbnailUrl,
      status: asset.status || 'ready',
      retention_days: asset.retentionDays || 90,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Supabase] Error inserting video asset:', error.message);
    return null;
  }
  return data?.id || null;
}

export async function findVideoByChecksum(checksum: string): Promise<VideoAssetRecord | null> {
  const client = getSupabaseServerClient();
  if (!client || !checksum) return null;

  const { data, error } = await client
    .from('metricool_video_assets')
    .select('*')
    .eq('checksum_sha256', checksum)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    fileName: data.file_name,
    fileSizeBytes: data.file_size_bytes,
    mimeType: data.mime_type,
    durationSec: data.duration_sec,
    aspectRatio: data.aspect_ratio,
    checksumSha256: data.checksum_sha256,
    r2StorageKey: data.r2_storage_key,
    r2ThumbnailKey: data.r2_thumbnail_key,
    r2ProcessedKey: data.r2_processed_key,
    publicUrl: data.public_url,
    thumbnailUrl: data.thumbnail_url,
    status: data.status,
    retentionDays: data.retention_days,
  };
}

export async function isVideoInActiveUse(videoAssetId: string): Promise<boolean> {
  const client = getSupabaseServerClient();
  if (!client || !videoAssetId) return false;

  const { count, error } = await client
    .from('metricool_posts')
    .select('id', { count: 'exact', head: true })
    .eq('video_asset_id', videoAssetId)
    .in('status', ['scheduled', 'scheduled_on_platform', 'publishing']);

  if (error) {
    console.error('[Supabase] Check video in use error:', error.message);
    return true; // Default to safety
  }

  return (count || 0) > 0;
}

// ------------------------------------------------------------------------------
// Social Accounts Repository
// ------------------------------------------------------------------------------
export async function getAccountsFromSupabase(): Promise<ConnectedAccount[] | null> {
  const client = getSupabaseServerClient();
  if (!client) return null;

  const { data, error } = await client.from('metricool_social_accounts').select('*');
  if (error || !data) {
    console.warn('[Supabase] Could not fetch social_accounts:', error?.message);
    return null;
  }

  return data.map((row) => ({
    id: row.id,
    platform: row.platform,
    accountName: row.account_name,
    handle: row.handle,
    avatarUrl: row.avatar_url || '',
    isConnected: row.is_connected,
    connectedAt: row.connected_at || undefined,
    tokenStatus: row.token_status,
    tokenStatusNote: row.token_status_note || undefined,
    followersCount: Number(row.followers_count || 0),
    postsCount: Number(row.posts_count || 0),
    viewsCount: Number(row.views_count || 0),
    postizIntegrationId: row.postiz_integration_id || undefined,
    authMode: row.auth_mode || 'api_key',
    hasCustomCredentials: row.has_custom_credentials,
    credentials: row.credentials_encrypted || undefined,
  }));
}

export async function upsertAccountInSupabase(account: ConnectedAccount): Promise<boolean> {
  const client = getSupabaseServerClient();
  if (!client) return false;

  const { error } = await client.from('metricool_social_accounts').upsert({
    id: account.id,
    platform: account.platform,
    account_name: account.accountName,
    handle: account.handle,
    avatar_url: account.avatarUrl,
    is_connected: account.isConnected,
    connected_at: account.connectedAt || new Date().toISOString(),
    token_status: account.tokenStatus,
    token_status_note: account.tokenStatusNote,
    followers_count: account.followersCount || 0,
    posts_count: account.postsCount || 0,
    views_count: account.viewsCount || 0,
    postiz_integration_id: account.postizIntegrationId,
    auth_mode: account.authMode || 'api_key',
    has_custom_credentials: account.hasCustomCredentials,
    credentials_encrypted: account.credentials || null,
  });

  if (error) {
    console.error('[Supabase] Failed to upsert social_account:', error.message);
    return false;
  }
  return true;
}

// ------------------------------------------------------------------------------
// Posts & Schedules Repository
// ------------------------------------------------------------------------------
export async function getPostsFromSupabase(): Promise<ScheduledPost[] | null> {
  const client = getSupabaseServerClient();
  if (!client) return null;

  const { data, error } = await client
    .from('metricool_posts')
    .select('*')
    .order('scheduled_at', { ascending: true });

  if (error || !data) {
    console.warn('[Supabase] Could not fetch posts:', error?.message);
    return null;
  }

  return data.map((row) => ({
    id: row.id,
    userId: row.user_id || 'user_1',
    publishMode: row.publish_mode,
    status: row.status,
    scheduledAt: row.scheduled_at,
    publishedAt: row.published_at || undefined,
    mediaUrl: row.media_url,
    mediaType: row.media_type,
    mediaFileName: row.media_file_name,
    mediaDurationSec: Number(row.media_duration_sec || 30),
    mediaAspectRatio: row.media_aspect_ratio || '9:16',
    mediaSizeMb: Number(row.media_size_mb || 0),
    coverUrl: row.cover_url || undefined,
    thumbOffsetMs: row.thumb_offset_ms || 0,
    globalCaption: row.global_caption || '',
    shortenerEnabled: row.shortener_enabled,
    targetPlatforms: row.target_platforms || [],
    platformOverrides: row.platform_overrides || {},
    publishedUrls: row.published_urls || {},
    platformStatusNotes: row.platform_status_notes || {},
    postizPostId: row.postiz_post_id || undefined,
    errorMessage: row.error_message || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function upsertPostInSupabase(post: ScheduledPost): Promise<boolean> {
  const client = getSupabaseServerClient();
  if (!client) return false;

  const { error } = await client.from('metricool_posts').upsert({
    id: post.id,
    publish_mode: post.publishMode,
    status: post.status,
    scheduled_at: post.scheduledAt,
    published_at: post.publishedAt || null,
    media_url: post.mediaUrl,
    media_type: post.mediaType,
    media_file_name: post.mediaFileName,
    media_duration_sec: post.mediaDurationSec,
    media_aspect_ratio: post.mediaAspectRatio,
    media_size_mb: post.mediaSizeMb,
    cover_url: post.coverUrl || null,
    thumb_offset_ms: post.thumbOffsetMs || 0,
    global_caption: post.globalCaption || '',
    shortener_enabled: post.shortenerEnabled,
    target_platforms: post.targetPlatforms || [],
    platform_overrides: post.platformOverrides || {},
    published_urls: post.publishedUrls || {},
    platform_status_notes: post.platformStatusNotes || {},
    postiz_post_id: post.postizPostId || null,
    error_message: post.errorMessage || null,
  });

  if (error) {
    console.error('[Supabase] Failed to upsert post:', error.message);
    return false;
  }
  return true;
}

export async function deletePostFromSupabase(postId: string): Promise<boolean> {
  const client = getSupabaseServerClient();
  if (!client) return false;

  const { error } = await client.from('metricool_posts').delete().eq('id', postId);
  if (error) {
    console.error('[Supabase] Failed to delete post:', error.message);
    return false;
  }
  return true;
}

// ------------------------------------------------------------------------------
// Publishing Jobs & Retry History
// ------------------------------------------------------------------------------
export async function recordPublishingJob(job: {
  postId: string;
  platform: string;
  adapter?: 'postiz' | 'native_direct' | 'vault_fallback';
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'retrying' | 'cancelled';
  attemptNumber?: number;
  remoteJobId?: string;
  remoteUrl?: string;
  errorMessage?: string;
  errorDetails?: Record<string, unknown>;
}): Promise<string | null> {
  const client = getSupabaseServerClient();
  if (!client) return null;

  const { data, error } = await client
    .from('metricool_publishing_jobs')
    .insert({
      post_id: job.postId,
      platform: job.platform,
      adapter: job.adapter || 'postiz',
      status: job.status,
      attempt_number: job.attemptNumber || 1,
      remote_job_id: job.remoteJobId || null,
      remote_url: job.remoteUrl || null,
      error_message: job.errorMessage || null,
      error_details: job.errorDetails || null,
      completed_at: job.status === 'completed' || job.status === 'failed' ? new Date().toISOString() : null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Supabase] Error logging publishing job:', error.message);
    return null;
  }
  return data?.id || null;
}

// ------------------------------------------------------------------------------
// Analytics Snapshots
// ------------------------------------------------------------------------------
export async function saveAnalyticsSnapshot(snapshot: {
  platform: string;
  accountId?: string;
  followersCount: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares?: number;
  engagementRate?: number;
  rawMetrics?: Record<string, unknown>;
}): Promise<boolean> {
  const client = getSupabaseServerClient();
  if (!client) return false;

  const todayStr = new Date().toISOString().split('T')[0];

  const { error } = await client.from('metricool_analytics_snapshots').upsert(
    {
      platform: snapshot.platform,
      account_id: snapshot.accountId || null,
      snapshot_date: todayStr,
      followers_count: snapshot.followersCount || 0,
      total_views: snapshot.totalViews || 0,
      total_likes: snapshot.totalLikes || 0,
      total_comments: snapshot.totalComments || 0,
      total_shares: snapshot.totalShares || 0,
      engagement_rate: snapshot.engagementRate || 0,
      raw_metrics: snapshot.rawMetrics || {},
    },
    { onConflict: 'platform,snapshot_date' }
  );

  if (error) {
    console.warn('[Supabase] Failed to save analytics snapshot:', error.message);
    return false;
  }
  return true;
}

// ------------------------------------------------------------------------------
// Audit Logs
// ------------------------------------------------------------------------------
export async function recordAuditLog(log: {
  action: string;
  entityType: 'post' | 'account' | 'video' | 'settings';
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  const client = getSupabaseServerClient();
  if (!client) return;

  try {
    const { error } = await client.from('metricool_audit_logs').insert({
      action: log.action,
      entity_type: log.entityType,
      entity_id: log.entityId || null,
      metadata: log.metadata || {},
      ip_address: log.ipAddress || null,
    });
    if (error) {
      console.warn('[Supabase] Audit log write warning:', error.message);
    }
  } catch (err) {
    console.warn('[Supabase] Audit log write failed:', err);
  }
}
