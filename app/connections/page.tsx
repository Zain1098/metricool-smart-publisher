'use client';

import { useEffect, useState, useMemo } from 'react';
import { ConnectedAccount, SocialPlatform } from '@/lib/types';
import { cn, PLATFORM_CONFIGS } from '@/lib/utils';
import {
  Check,
  RefreshCw,
  Unplug,
  ShieldCheck,
  Zap,
  Key,
  AlertTriangle,
  ExternalLink,
  Sparkles,
  Activity,
  Users,
  Link2,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { PlatformBadge, useToast } from '@/components/ui';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/shadcn/card';
import { Badge } from '@/components/ui/shadcn/badge';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';

interface PlatformMetaGuide {
  apiBadge: string;
  portalName: string;
  portalUrl: string;
  scopes: string;
  tokenPlaceholder: string;
  idLabel: string;
  quickSteps: string[];
}

const PLATFORM_GUIDES: Record<SocialPlatform, PlatformMetaGuide> = {
  youtube: {
    apiBadge: 'YouTube Data API v3',
    portalName: 'Google OAuth Playground',
    portalUrl: 'https://developers.google.com/oauthplayground/',
    scopes: 'youtube.upload, youtube.readonly',
    tokenPlaceholder: 'Paste ya29... Google OAuth Access Token',
    idLabel: 'YouTube Channel ID',
    quickSteps: [
      'Use "1-Click YouTube OAuth" on local server, or:',
      'Open Google OAuth Playground and select YouTube Data API v3.',
      'Exchange authorization code and paste the Access Token below.',
    ],
  },
  instagram: {
    apiBadge: 'Meta Graph API v22.0',
    portalName: 'Meta Graph Explorer',
    portalUrl: 'https://developers.facebook.com/tools/explorer/',
    scopes: 'pages_show_list, instagram_basic, instagram_content_publish',
    tokenPlaceholder: 'Paste EAAM... Meta Graph Explorer Token',
    idLabel: 'Instagram Business User ID',
    quickSteps: [
      'Open Meta Graph API Explorer and select your Meta App.',
      'Add pages_show_list, instagram_basic, instagram_content_publish.',
      'Generate Access Token and paste below.',
    ],
  },
  facebook: {
    apiBadge: 'Meta Graph API v22.0',
    portalName: 'Meta Graph Explorer',
    portalUrl: 'https://developers.facebook.com/tools/explorer/',
    scopes: 'pages_show_list, pages_read_engagement, pages_manage_posts',
    tokenPlaceholder: 'Paste EAAM... Meta Graph Explorer Token',
    idLabel: 'Facebook Page ID',
    quickSteps: [
      'Open Meta Graph API Explorer and select your Meta App.',
      'Add pages_show_list, pages_read_engagement, pages_manage_posts.',
      'Paste token below to auto-fetch your Page Token.',
    ],
  },
  tiktok: {
    apiBadge: 'TikTok Direct Post v2',
    portalName: 'TikTok Developer Portal',
    portalUrl: 'https://developers.tiktok.com/apps/',
    scopes: 'user.info.basic, video.publish, video.upload',
    tokenPlaceholder: 'Paste act.... TikTok OAuth 2.0 Access Token',
    idLabel: 'TikTok Creator Open ID',
    quickSteps: [
      'Open TikTok Developer Portal -> your App with Content Posting API.',
      'Enable user.info.basic, video.publish, video.upload.',
      'Paste your User Access Token below.',
    ],
  },
  twitter: {
    apiBadge: 'X Official API v2',
    portalName: 'X Developer Portal',
    portalUrl: 'https://developer.x.com/en/portal/dashboard',
    scopes: 'tweet.read, tweet.write, users.read, media.write',
    tokenPlaceholder: 'Paste X OAuth 2.0 User Access Token',
    idLabel: 'X / Twitter User ID',
    quickSteps: [
      'Open X Developer Portal -> Keys and Tokens.',
      'Set App permissions to "Read and Write".',
      'Paste your OAuth 2.0 User Access Token below.',
    ],
  },
  linkedin: {
    apiBadge: 'LinkedIn Posts API v2',
    portalName: 'LinkedIn OAuth Tool',
    portalUrl: 'https://www.linkedin.com/developers/tools/oauth',
    scopes: 'openid, profile, w_member_social',
    tokenPlaceholder: 'Paste AQV... LinkedIn OAuth 2.0 Access Token',
    idLabel: 'LinkedIn Person/Org URN',
    quickSteps: [
      'Open LinkedIn Developer OAuth Token Generator.',
      'Select openid, profile, w_member_social.',
      'Generate token and paste below.',
    ],
  },
  threads: {
    apiBadge: 'Threads Graph API v1.0',
    portalName: 'Meta Threads Explorer',
    portalUrl: 'https://developers.facebook.com/tools/explorer/',
    scopes: 'threads_basic, threads_content_publish',
    tokenPlaceholder: 'Paste THAA... Threads Access Token',
    idLabel: 'Threads User ID',
    quickSteps: [
      'Open Meta Developer Portal -> your App with Threads API.',
      'Generate a token with threads_basic & threads_content_publish.',
      'Paste the token below.',
    ],
  },
  pinterest: {
    apiBadge: 'Pinterest API v5',
    portalName: 'Pinterest Developer Portal',
    portalUrl: 'https://developers.pinterest.com/apps/',
    scopes: 'user_accounts:read, boards:read, pins:write',
    tokenPlaceholder: 'Paste pina_... Pinterest API v5 Access Token',
    idLabel: 'Pinterest Board ID or Username',
    quickSteps: [
      'Open Pinterest Developer Portal -> My Apps.',
      'Generate OAuth Access Token with user_accounts:read & pins:write.',
      'Paste the token below.',
    ],
  },
};

export default function ConnectionsPage() {
  const { pushToast } = useToast();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'all' | 'connected' | 'unlinked'>('all');
  const [loadingPlatform, setLoadingPlatform] = useState<SocialPlatform | 'sync' | null>(null);
  const [verifyingPlatform, setVerifyingPlatform] = useState<SocialPlatform | null>(null);

  const [activeModalAccount, setActiveModalAccount] = useState<ConnectedAccount | null>(null);
  const [accessTokenInput, setAccessTokenInput] = useState('');
  const [accountNameInput, setAccountNameInput] = useState('');
  const [handleInput, setHandleInput] = useState('');
  const [accountIdInput, setAccountIdInput] = useState('');
  const [showManualOverride, setShowManualOverride] = useState(false);

  const [showMetaWizard, setShowMetaWizard] = useState(false);
  const [metaWizardToken, setMetaWizardToken] = useState('');
  const [metaAppId, setMetaAppId] = useState('');
  const [metaAppSecret, setMetaAppSecret] = useState('');
  const [wizardLoading, setWizardLoading] = useState<'youtube' | 'meta' | null>(null);

  const fetchAccounts = () => {
    fetch('/api/accounts')
      .then((res) => res.json())
      .then((data) => {
        if (data.accounts) setAccounts(data.accounts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleSyncAndVerifyVault = async () => {
    setLoadingPlatform('sync');
    try {
      const res = await fetch('/api/accounts/auto-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'sync_vault' }),
      });
      const data = await res.json();
      if (data.accounts) setAccounts(data.accounts);
      pushToast({
        type: data.success ? 'success' : 'error',
        title: data.success ? 'APIs verified' : 'Verification failed',
        description: data.message || data.error,
      });
    } catch {
      pushToast({
        type: 'error',
        title: 'Verification error',
        description: 'Failed to verify live accounts.',
      });
    } finally {
      setLoadingPlatform(null);
    }
  };

  const handleVerifySingleCard = async (platform: SocialPlatform) => {
    setVerifyingPlatform(platform);
    try {
      const res = await fetch('/api/accounts/auto-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'verify_single', platform }),
      });
      const data = await res.json();
      if (data.accounts) setAccounts(data.accounts);
      pushToast({
        type: data.success ? 'success' : 'error',
        title: data.success ? `${PLATFORM_CONFIGS[platform].name} verified` : 'Verification failed',
        description: data.message || data.error,
      });
    } catch {
      pushToast({
        type: 'error',
        title: `Network error verifying ${PLATFORM_CONFIGS[platform].name}`,
      });
    } finally {
      setVerifyingPlatform(null);
    }
  };

  const handleYouTubeOneClickOAuth = async () => {
    setWizardLoading('youtube');
    try {
      const res = await fetch('/api/accounts/auto-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'youtube_browser_oauth' }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.accounts) setAccounts(data.accounts);
        pushToast({ type: 'success', title: data.message || 'YouTube connected' });
      } else {
        pushToast({
          type: 'error',
          title: 'YouTube OAuth notice',
          description: data.error,
        });
      }
    } catch {
      pushToast({ type: 'error', title: 'Could not launch YouTube OAuth listener' });
    } finally {
      setWizardLoading(null);
    }
  };

  const handleMetaAutoDiscover = async (e: React.FormEvent) => {
    e.preventDefault();
    setWizardLoading('meta');
    try {
      const res = await fetch('/api/accounts/auto-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'meta_auto_discover',
          metaToken: metaWizardToken,
          appId: metaAppId,
          appSecret: metaAppSecret,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.accounts) setAccounts(data.accounts);
        setShowMetaWizard(false);
        setMetaWizardToken('');
        pushToast({
          type: 'success',
          title: 'Meta channels connected',
          description: data.message,
        });
      } else {
        pushToast({
          type: 'error',
          title: 'Meta discovery failed',
          description: data.error,
        });
      }
    } catch {
      pushToast({ type: 'error', title: 'Failed to connect Meta Auto-Discovery' });
    } finally {
      setWizardLoading(null);
    }
  };

  const openConfigModal = (acc: ConnectedAccount) => {
    setActiveModalAccount(acc);
    setAccessTokenInput('');
    setAccountNameInput(acc.accountName === 'Not Connected' ? '' : acc.accountName);
    setHandleInput(acc.handle === '—' ? '' : acc.handle);
    setAccountIdInput(acc.credentials?.accountId || '');
    setShowManualOverride(false);
  };

  const handleQuickDisconnect = async (platform: SocialPlatform) => {
    setLoadingPlatform(platform);
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, connect: false }),
      });
      const data = await res.json();
      if (data.accounts) setAccounts(data.accounts);
      pushToast({
        type: 'info',
        title: `${PLATFORM_CONFIGS[platform].name} disconnected`,
      });
    } catch {
      // ignore
    } finally {
      setLoadingPlatform(null);
    }
  };

  const handleSaveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalAccount) return;
    const platform = activeModalAccount.platform;
    setLoadingPlatform(platform);

    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          connect: true,
          accountName: accountNameInput.trim() || undefined,
          handle: handleInput.trim() || undefined,
          appId: metaAppId.trim() || undefined,
          appSecret: metaAppSecret.trim() || undefined,
          authMode: 'api_key',
          credentials: {
            accountId: accountIdInput.trim() || undefined,
            accessToken: accessTokenInput.trim(),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        pushToast({
          type: 'error',
          title: 'Token verification failed',
          description:
            data.error || `Could not verify ${PLATFORM_CONFIGS[platform].name} token.`,
        });
        return;
      }
      if (data.accounts) setAccounts(data.accounts);
      setActiveModalAccount(null);
      pushToast({
        type: 'success',
        title: `${PLATFORM_CONFIGS[platform].name} connected`,
        description: data.message,
      });
    } catch {
      pushToast({ type: 'error', title: 'Failed to save & verify connection' });
    } finally {
      setLoadingPlatform(null);
    }
  };

  const connectedCount = accounts.filter((a) => a.isConnected).length;
  const expiredCount = accounts.filter((a) => a.isConnected && a.tokenStatus === 'expired').length;
  const totalAudience = accounts.reduce(
    (sum, a) => sum + (a.isConnected ? a.followersCount || 0 : 0),
    0
  );

  const visibleAccounts = useMemo(() => {
    if (filterMode === 'connected') return accounts.filter((a) => a.isConnected);
    if (filterMode === 'unlinked') return accounts.filter((a) => !a.isConnected);
    return accounts;
  }, [accounts, filterMode]);

  return (
    <div className="space-y-6">
      {/* Stitch Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-1">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-brand text-xs font-semibold uppercase tracking-wider">
            <Link2 className="w-3.5 h-3.5" />
            <span>OAuth &amp; API Integration Hub</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-normal text-content-primary tracking-tight">
            Connected Channels &amp; Credentials
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary">
            Manage live social network tokens, auto-discovery wizards, and Postiz publishing bridges.
          </p>
        </div>
      </div>

      {/* Row 1: 3 Stitch Editorial Summary KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-6 rounded-2xl bg-surface-lowest border border-border shadow-card hover:shadow-elevated transition-all flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-content-secondary">
              Connected Channels
            </p>
            <p className="font-serif text-3xl sm:text-4xl font-medium text-content-primary mt-2 tabular-nums">
              {loading ? '—' : `${connectedCount} / ${accounts.length || 8}`}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-surface-low border border-border flex items-center justify-center text-brand">
            <Link2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-surface-lowest border border-border shadow-card hover:shadow-elevated transition-all flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-content-secondary">
              Token Health
            </p>
            <p className="font-serif text-2xl sm:text-3xl font-medium text-content-primary mt-2">
              {loading
                ? '—'
                : expiredCount === 0
                ? 'All Healthy'
                : `${expiredCount} Need Refresh`}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-surface-lowest border border-border shadow-card hover:shadow-elevated transition-all flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-content-secondary">
              Combined Audience
            </p>
            <p className="font-serif text-3xl sm:text-4xl font-medium text-content-primary mt-2 tabular-nums">
              {loading ? '—' : totalAudience.toLocaleString()}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-brand-container flex items-center justify-center text-brand">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </section>

      {/* Row 2: Express Wizards & Filter Toolbar */}
      <Card>
        <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: `All (${accounts.length || 8})` },
                { id: 'connected', label: `Connected (${connectedCount})` },
                {
                  id: 'unlinked',
                  label: `Not Connected (${Math.max(0, (accounts.length || 8) - connectedCount)})`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterMode(tab.id)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  filterMode === tab.id
                    ? 'bg-[#C27345] text-white border-[#C27345]'
                    : 'bg-surface text-content-secondary border-border hover:bg-surface-high'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loadingPlatform === 'sync'}
              onClick={handleSyncAndVerifyVault}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loadingPlatform === 'sync' ? 'animate-spin' : ''}`}
              />
              <span>{loadingPlatform === 'sync' ? 'Verifying...' : 'Verify All APIs'}</span>
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={wizardLoading !== null}
              onClick={handleYouTubeOneClickOAuth}
            >
              <Zap className="w-3.5 h-3.5 text-[#D94343]" />
              <span>1-Click YouTube</span>
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={wizardLoading !== null}
              onClick={() => setShowMetaWizard(true)}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Meta (FB + IG) Wizard</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Row 3: 8-Platform Clean Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-60 rounded-2xl bg-surface-high animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {visibleAccounts.map((acc) => {
            const cfg = PLATFORM_CONFIGS[acc.platform];
            const guide = PLATFORM_GUIDES[acc.platform];
            if (!cfg || !guide) return null;
            const isLoading = loadingPlatform === acc.platform;
            const isVerifying = verifyingPlatform === acc.platform;

            return (
              <Card
                key={acc.id}
                style={{ borderTopColor: cfg.color, borderTopWidth: '3px' }}
                className="flex flex-col justify-between overflow-hidden"
              >
                <CardContent className="p-4 space-y-4">
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PlatformBadge
                        platform={acc.platform}
                        size="md"
                        muted={!acc.isConnected}
                      />
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-content-primary truncate">
                          {cfg.name}
                        </h3>
                        <p className="text-[11px] text-content-muted truncate">{guide.apiBadge}</p>
                      </div>
                    </div>

                    <Badge
                      variant={
                        acc.isConnected
                          ? acc.tokenStatus === 'expired'
                            ? 'peach'
                            : 'sage'
                          : 'outline'
                      }
                      className="text-[10px] flex-shrink-0"
                    >
                      {acc.isConnected
                        ? acc.tokenStatus === 'expired'
                          ? 'Expired'
                          : 'Active'
                        : 'Unlinked'}
                    </Badge>
                  </div>

                  {/* Identity Block */}
                  <div className="flex items-center gap-3 rounded-xl bg-surface border border-border-subtle p-3">
                    {acc.isConnected && acc.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={acc.avatarUrl}
                        alt={acc.accountName}
                        className="w-10 h-10 rounded-full object-cover border border-[#C5DDD0] flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-surface-lowest border border-border flex items-center justify-center flex-shrink-0">
                        <PlatformBadge
                          platform={acc.platform}
                          size="sm"
                          muted={!acc.isConnected}
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-content-primary truncate">
                        {acc.isConnected ? acc.accountName : `Connect ${cfg.name}`}
                      </p>
                      <p className="text-[11px] text-content-muted truncate">
                        {acc.isConnected ? acc.handle : 'Paste OAuth token to link'}
                      </p>
                    </div>
                  </div>

                  {/* Clean Stat Pills (instead of text wall) */}
                  {acc.isConnected ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-surface border border-border-subtle px-2.5 py-1.5">
                        <span className="text-[10px] text-content-muted block">
                          {acc.platform === 'youtube' ? 'Subscribers' : 'Followers'}
                        </span>
                        <span className="text-xs font-bold text-content-primary tabular-nums">
                          {(acc.followersCount || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="rounded-lg bg-surface border border-border-subtle px-2.5 py-1.5">
                        <span className="text-[10px] text-content-muted block">Posts</span>
                        <span className="text-xs font-bold text-content-primary tabular-nums">
                          {(acc.postsCount || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-surface border border-border-subtle px-3 py-2 text-[11px] text-content-muted">
                      Ready for auto-discovery via OAuth token.
                    </div>
                  )}

                  {/* Status Note */}
                  {acc.isConnected && acc.tokenStatusNote && (
                    <p
                      className={cn(
                        'text-[11px] font-medium truncate flex items-center gap-1',
                        acc.tokenStatus === 'expired' ? 'text-[#A8582B]' : 'text-[#24503B]'
                      )}
                      title={acc.tokenStatusNote}
                    >
                      {acc.tokenStatus === 'expired' ? (
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      ) : (
                        <Check className="w-3.5 h-3.5 flex-shrink-0" />
                      )}
                      <span className="truncate">{acc.tokenStatusNote}</span>
                    </p>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-2 border-t border-border-subtle space-y-2">
                    {acc.isConnected ? (
                      <>
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="flex-1 h-8 text-xs"
                            disabled={isVerifying}
                            onClick={() => handleVerifySingleCard(acc.platform)}
                          >
                            <Activity className="w-3.5 h-3.5 text-[#3A8E63]" />
                            {isVerifying ? 'Checking...' : 'Test API'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="flex-1 h-8 text-xs"
                            disabled={isLoading}
                            onClick={() => openConfigModal(acc)}
                          >
                            <Key className="w-3.5 h-3.5 text-[#8D451E]" />
                            Update Token
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            disabled={isLoading}
                            onClick={() => handleQuickDisconnect(acc.platform)}
                            title={`Disconnect ${cfg.name}`}
                            className="h-8 w-8 text-[#C84B4B] hover:bg-[#FDF2F4]"
                          >
                            <Unplug className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <a
                          href={guide.portalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full h-7 rounded-lg bg-surface hover:bg-surface-high border border-border text-[11px] font-medium text-content-secondary flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <span>Open {guide.portalName}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </>
                    ) : (
                      <div className="space-y-1.5">
                        <Button
                          type="button"
                          size="sm"
                          className="w-full h-8 text-xs font-semibold"
                          onClick={() => openConfigModal(acc)}
                        >
                          <Key className="w-3.5 h-3.5" />
                          Connect {cfg.name}
                        </Button>
                        <a
                          href={guide.portalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full h-7 rounded-lg bg-surface hover:bg-surface-high border border-border text-[11px] font-medium text-content-secondary flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <span>Get Token at {guide.portalName}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Meta Auto-Discovery Modal */}
      {showMetaWizard && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowMetaWizard(false)}
        >
          <Card className="w-full max-w-lg bg-surface-lowest" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="flex flex-row items-center justify-between border-b border-border p-4">
              <div>
                <CardTitle className="text-base">Meta (Facebook + Instagram) Wizard</CardTitle>
                <CardDescription>
                  Paste a Meta Graph Explorer token to auto-connect both channels
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowMetaWizard(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleMetaAutoDiscover} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-content-secondary">
                    Meta Graph User Access Token *
                  </label>
                  <Input
                    type="password"
                    required
                    value={metaWizardToken}
                    onChange={(e) => setMetaWizardToken(e.target.value)}
                    placeholder="Paste EAAM... token from Meta Graph Explorer"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-content-secondary">
                      Meta App ID (optional)
                    </label>
                    <Input
                      value={metaAppId}
                      onChange={(e) => setMetaAppId(e.target.value)}
                      placeholder="1605..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-content-secondary">
                      Meta App Secret (optional)
                    </label>
                    <Input
                      type="password"
                      value={metaAppSecret}
                      onChange={(e) => setMetaAppSecret(e.target.value)}
                      placeholder="Optional for 60-day token"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowMetaWizard(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={wizardLoading === 'meta'}>
                    {wizardLoading === 'meta' ? 'Connecting...' : 'Auto-Discover & Connect'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Single Platform Token Modal */}
      {activeModalAccount && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setActiveModalAccount(null)}
        >
          <Card className="w-full max-w-lg bg-surface-lowest" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="flex flex-row items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2.5">
                <PlatformBadge platform={activeModalAccount.platform} size="md" />
                <div>
                  <CardTitle className="text-base">
                    Configure {PLATFORM_CONFIGS[activeModalAccount.platform]?.name}
                  </CardTitle>
                  <CardDescription>
                    {PLATFORM_GUIDES[activeModalAccount.platform]?.apiBadge}
                  </CardDescription>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setActiveModalAccount(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="rounded-xl bg-surface border border-border p-3 space-y-1.5">
                <p className="text-xs font-semibold text-content-primary">Quick Steps:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs text-content-muted">
                  {PLATFORM_GUIDES[activeModalAccount.platform]?.quickSteps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </div>

              <form onSubmit={handleSaveConnection} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-content-secondary">
                    OAuth Access Token *
                  </label>
                  <Input
                    type="password"
                    required
                    value={accessTokenInput}
                    onChange={(e) => setAccessTokenInput(e.target.value)}
                    placeholder={PLATFORM_GUIDES[activeModalAccount.platform]?.tokenPlaceholder}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowManualOverride(!showManualOverride)}
                  className="text-xs font-medium text-[#8D451E] inline-flex items-center gap-1 hover:underline"
                >
                  {showManualOverride ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                  Optional Manual Account Overrides
                </button>

                {showManualOverride && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <Input
                      value={accountNameInput}
                      onChange={(e) => setAccountNameInput(e.target.value)}
                      placeholder="Account Display Name"
                    />
                    <Input
                      value={handleInput}
                      onChange={(e) => setHandleInput(e.target.value)}
                      placeholder="@handle"
                    />
                    <Input
                      value={accountIdInput}
                      onChange={(e) => setAccountIdInput(e.target.value)}
                      placeholder={PLATFORM_GUIDES[activeModalAccount.platform]?.idLabel}
                      className="sm:col-span-2"
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveModalAccount(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loadingPlatform === activeModalAccount.platform}
                  >
                    {loadingPlatform === activeModalAccount.platform
                      ? 'Verifying...'
                      : 'Verify & Save'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
