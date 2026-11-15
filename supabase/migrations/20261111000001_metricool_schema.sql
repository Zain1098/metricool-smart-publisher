-- ==============================================================================
-- Metricool Smart Publisher - PostgreSQL Schema for Supabase
-- Tables prefixed with metricool_ for complete isolation in shared projects
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Profiles & User Brand Settings
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.metricool_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE,
    brand_name TEXT NOT NULL DEFAULT 'ZCodeDev',
    timezone TEXT NOT NULL DEFAULT 'Asia/Karachi',
    notification_email TEXT NOT NULL DEFAULT 'zain@zcodedev.com',
    auto_optimal_time BOOLEAN NOT NULL DEFAULT true,
    default_publish_mode TEXT NOT NULL DEFAULT 'native_schedule' CHECK (default_publish_mode IN ('publish_now', 'native_schedule', 'local_queue', 'postiz')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 2. Cloudflare R2 Video Assets (Metadata & Storage References ONLY)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.metricool_video_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.metricool_profiles(id) ON DELETE SET NULL,
    file_name TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    duration_sec NUMERIC(8,2) DEFAULT 0,
    aspect_ratio TEXT DEFAULT '9:16',
    checksum_sha256 TEXT,
    r2_storage_key TEXT NOT NULL UNIQUE,
    r2_thumbnail_key TEXT,
    r2_processed_key TEXT,
    public_url TEXT NOT NULL,
    thumbnail_url TEXT,
    status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('uploading', 'ready', 'processing', 'archived', 'deleted')),
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    retention_days INT DEFAULT 90,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_metricool_video_assets_checksum ON public.metricool_video_assets(checksum_sha256) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_metricool_video_assets_storage_key ON public.metricool_video_assets(r2_storage_key);

-- ------------------------------------------------------------------------------
-- 3. Social Media Connected Accounts (OAuth & Postiz Metadata)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.metricool_social_accounts (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES public.metricool_profiles(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('youtube', 'instagram', 'facebook', 'tiktok', 'twitter', 'linkedin', 'threads', 'pinterest')),
    account_name TEXT NOT NULL,
    handle TEXT NOT NULL,
    avatar_url TEXT,
    is_connected BOOLEAN NOT NULL DEFAULT false,
    connected_at TIMESTAMPTZ,
    token_status TEXT NOT NULL DEFAULT 'valid' CHECK (token_status IN ('valid', 'expired', 'revoked', 'pending')),
    token_status_note TEXT,
    followers_count BIGINT NOT NULL DEFAULT 0,
    posts_count BIGINT NOT NULL DEFAULT 0,
    views_count BIGINT NOT NULL DEFAULT 0,
    postiz_integration_id TEXT,
    postiz_channel_name TEXT,
    auth_mode TEXT NOT NULL DEFAULT 'api_key',
    has_custom_credentials BOOLEAN NOT NULL DEFAULT false,
    credentials_encrypted JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_metricool_social_accounts_platform ON public.metricool_social_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_metricool_social_accounts_postiz ON public.metricool_social_accounts(postiz_integration_id);

-- ------------------------------------------------------------------------------
-- 4. Scheduled Posts & Content Metadata
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.metricool_posts (
    id TEXT PRIMARY KEY DEFAULT ('post_' || substr(md5(random()::text), 1, 12)),
    user_id UUID REFERENCES public.metricool_profiles(id) ON DELETE CASCADE,
    publish_mode TEXT NOT NULL DEFAULT 'native_schedule' CHECK (publish_mode IN ('publish_now', 'native_schedule', 'local_queue', 'postiz')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'scheduled_on_platform', 'publishing', 'published', 'failed', 'cancelled')),
    scheduled_at TIMESTAMPTZ NOT NULL,
    published_at TIMESTAMPTZ,
    video_asset_id UUID REFERENCES public.metricool_video_assets(id) ON DELETE RESTRICT,
    media_url TEXT NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'video',
    media_file_name TEXT NOT NULL,
    media_duration_sec NUMERIC(8,2) DEFAULT 30,
    media_aspect_ratio TEXT DEFAULT '9:16',
    media_size_mb NUMERIC(8,2) DEFAULT 0,
    cover_url TEXT,
    thumb_offset_ms INT DEFAULT 0,
    global_caption TEXT NOT NULL DEFAULT '',
    shortener_enabled BOOLEAN NOT NULL DEFAULT false,
    target_platforms JSONB NOT NULL DEFAULT '[]'::jsonb,
    platform_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
    published_urls JSONB NOT NULL DEFAULT '{}'::jsonb,
    platform_status_notes JSONB NOT NULL DEFAULT '{}'::jsonb,
    postiz_post_id TEXT,
    postiz_status TEXT,
    error_message TEXT,
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    next_retry_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_metricool_posts_status_scheduled ON public.metricool_posts(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_metricool_posts_postiz_id ON public.metricool_posts(postiz_post_id);

-- ------------------------------------------------------------------------------
-- 5. Publishing Jobs & Retry History
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.metricool_publishing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id TEXT NOT NULL REFERENCES public.metricool_posts(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    adapter TEXT NOT NULL DEFAULT 'postiz' CHECK (adapter IN ('postiz', 'native_direct', 'vault_fallback')),
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'retrying', 'cancelled')),
    attempt_number INT NOT NULL DEFAULT 1,
    remote_job_id TEXT,
    remote_url TEXT,
    error_message TEXT,
    error_details JSONB,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_metricool_jobs_post_id ON public.metricool_publishing_jobs(post_id);
CREATE INDEX IF NOT EXISTS idx_metricool_jobs_status ON public.metricool_publishing_jobs(status);

-- ------------------------------------------------------------------------------
-- 6. Analytics Snapshots
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.metricool_analytics_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.metricool_profiles(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    account_id TEXT REFERENCES public.metricool_social_accounts(id) ON DELETE SET NULL,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    followers_count BIGINT NOT NULL DEFAULT 0,
    total_views BIGINT NOT NULL DEFAULT 0,
    total_likes BIGINT NOT NULL DEFAULT 0,
    total_comments BIGINT NOT NULL DEFAULT 0,
    total_shares BIGINT NOT NULL DEFAULT 0,
    engagement_rate NUMERIC(6,3) NOT NULL DEFAULT 0,
    raw_metrics JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(platform, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_metricool_analytics_date ON public.metricool_analytics_snapshots(snapshot_date);

-- ------------------------------------------------------------------------------
-- 7. Audit Logs
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.metricool_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.metricool_profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_metricool_audit_created ON public.metricool_audit_logs(created_at DESC);

-- ------------------------------------------------------------------------------
-- 8. Safety Constraint: Prevent deleting videos in use by scheduled or active posts
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_metricool_video_deletion_safety()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.metricool_posts
        WHERE video_asset_id = OLD.id
          AND status IN ('scheduled', 'scheduled_on_platform', 'publishing')
    ) THEN
        RAISE EXCEPTION 'Cannot delete video asset %: it is currently referenced by an active scheduled post.', OLD.id;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_metricool_active_video ON public.metricool_video_assets;
DROP TRIGGER IF EXISTS trg_protect_metricool_active_video_delete ON public.metricool_video_assets;
DROP TRIGGER IF EXISTS trg_protect_metricool_active_video_soft_delete ON public.metricool_video_assets;

CREATE TRIGGER trg_protect_metricool_active_video_delete
    BEFORE DELETE ON public.metricool_video_assets
    FOR EACH ROW
    EXECUTE FUNCTION public.check_metricool_video_deletion_safety();

CREATE TRIGGER trg_protect_metricool_active_video_soft_delete
    BEFORE UPDATE ON public.metricool_video_assets
    FOR EACH ROW
    WHEN (NEW.is_deleted = true AND OLD.is_deleted = false)
    EXECUTE FUNCTION public.check_metricool_video_deletion_safety();

-- ------------------------------------------------------------------------------
-- 9. Automatic Updated At Timestamp Function
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_metricool_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_metricool_profiles_updated_at ON public.metricool_profiles;
CREATE TRIGGER trg_metricool_profiles_updated_at BEFORE UPDATE ON public.metricool_profiles FOR EACH ROW EXECUTE FUNCTION public.set_metricool_updated_at();

DROP TRIGGER IF EXISTS trg_metricool_video_assets_updated_at ON public.metricool_video_assets;
CREATE TRIGGER trg_metricool_video_assets_updated_at BEFORE UPDATE ON public.metricool_video_assets FOR EACH ROW EXECUTE FUNCTION public.set_metricool_updated_at();

DROP TRIGGER IF EXISTS trg_metricool_social_accounts_updated_at ON public.metricool_social_accounts;
CREATE TRIGGER trg_metricool_social_accounts_updated_at BEFORE UPDATE ON public.metricool_social_accounts FOR EACH ROW EXECUTE FUNCTION public.set_metricool_updated_at();

DROP TRIGGER IF EXISTS trg_metricool_posts_updated_at ON public.metricool_posts;
CREATE TRIGGER trg_metricool_posts_updated_at BEFORE UPDATE ON public.metricool_posts FOR EACH ROW EXECUTE FUNCTION public.set_metricool_updated_at();

-- ------------------------------------------------------------------------------
-- 10. Row Level Security (RLS) Setup
-- ------------------------------------------------------------------------------
ALTER TABLE public.metricool_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metricool_video_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metricool_social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metricool_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metricool_publishing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metricool_analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metricool_audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow server service role & anon full access
DO $$
BEGIN
    EXECUTE 'CREATE POLICY "Service role full access on metricool_profiles" ON public.metricool_profiles FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Service role full access on metricool_video_assets" ON public.metricool_video_assets FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Service role full access on metricool_social_accounts" ON public.metricool_social_accounts FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Service role full access on metricool_posts" ON public.metricool_posts FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Service role full access on metricool_publishing_jobs" ON public.metricool_publishing_jobs FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Service role full access on metricool_analytics_snapshots" ON public.metricool_analytics_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Service role full access on metricool_audit_logs" ON public.metricool_audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true)';
EXCEPTION WHEN OTHERS THEN
    -- Policies already exist
END $$;
