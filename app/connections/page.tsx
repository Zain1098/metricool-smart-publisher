'use client';

import { useEffect, useState } from 'react';
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
  ChevronDown,
  ChevronUp,
  Sparkles,
  Activity,
  PlugZap,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  FieldLabel,
  Input,
  Modal,
  PlatformBadge,
  Skeleton,
  useToast,
} from '@/components/ui';

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
    idLabel: 'YouTube Channel ID (e.g. UCFZg0QShW2TMQv7bMTyW-xQ)',
    quickSteps: [
      'Click "1-Click Google OAuth" on local server for automatic login, or:',
      'Open Google OAuth Playground and select YouTube Data API v3 (youtube.upload & youtube.readonly).',
      'Click "Exchange authorization code for tokens" and paste the Access Token below.',
    ],
  },
  instagram: {
    apiBadge: 'Meta Graph API v22.0',
    portalName: 'Meta Graph API Explorer',
    portalUrl: 'https://developers.facebook.com/tools/explorer/',
    scopes:
      'pages_show_list, pages_read_engagement, instagram_basic, instagram_content_publish',
    tokenPlaceholder: 'Paste EAAM... Meta Graph Explorer Token',
    idLabel: 'Instagram Business User ID (e.g. 17841448708660067)',
    quickSteps: [
      'Open Meta Graph API Explorer and select your Meta App.',
      'Add permissions: pages_show_list, instagram_basic, instagram_content_publish.',
      'Click "Generate Access Token" and paste it below — Instagram & Facebook Page IDs auto-connect.',
    ],
  },
  facebook: {
    apiBadge: 'Meta Graph API v22.0',
    portalName: 'Meta Graph API Explorer',
    portalUrl: 'https://developers.facebook.com/tools/explorer/',
    scopes:
      'pages_show_list, pages_read_engagement, pages_manage_posts, instagram_basic',
    tokenPlaceholder: 'Paste EAAM... Meta Graph Explorer Token',
    idLabel: 'Facebook Page ID (e.g. 442234252298250)',
    quickSteps: [
      'Open Meta Graph API Explorer and select your Meta App.',
      'Add permissions: pages_show_list, pages_read_engagement, pages_manage_posts.',
      'Paste the token below to auto-fetch your Page Token & linked Instagram Business ID.',
    ],
  },
  tiktok: {
    apiBadge: 'TikTok Direct Post API v2',
    portalName: 'TikTok Developer Portal',
    portalUrl: 'https://developers.tiktok.com/apps/',
    scopes: 'user.info.basic, video.publish, video.upload',
    tokenPlaceholder: 'Paste act.... TikTok OAuth 2.0 Access Token',
    idLabel: 'TikTok Creator Open ID (Auto-detected)',
    quickSteps: [
      'Open TikTok Developer Portal and select your App with Content Posting API enabled.',
      'Enable scopes: user.info.basic, video.publish, video.upload.',
      'Paste your User Access Token below to auto-detect your TikTok @handle and Open ID.',
    ],
  },
  twitter: {
    apiBadge: 'X Official API v2',
    portalName: 'X Developer Portal',
    portalUrl: 'https://developer.x.com/en/portal/dashboard',
    scopes: 'tweet.read, tweet.write, users.read, media.write',
    tokenPlaceholder: 'Paste X OAuth 2.0 User Access Token',
    idLabel: 'X / Twitter User ID (Auto-detected)',
    quickSteps: [
      'Open X Developer Portal -> Projects & Apps -> Keys and Tokens.',
      'Ensure App permissions are set to "Read and Write".',
      'Paste your OAuth 2.0 User Access Token below to auto-detect your @username and User ID.',
    ],
  },
  linkedin: {
    apiBadge: 'LinkedIn Posts API v2',
    portalName: 'LinkedIn OAuth Token Tool',
    portalUrl: 'https://www.linkedin.com/developers/tools/oauth',
    scopes: 'openid, profile, w_member_social',
    tokenPlaceholder: 'Paste AQV... LinkedIn OAuth 2.0 Access Token',
    idLabel: 'LinkedIn Person/Org URN (e.g. urn:li:person:...)',
    quickSteps: [
      'Open LinkedIn Developer OAuth Token Generator tool.',
      'Select scopes: openid, profile, w_member_social.',
      'Generate token and paste below to auto-discover your LinkedIn Person URN.',
    ],
  },
  threads: {
    apiBadge: 'Threads Graph API v1.0',
    portalName: 'Meta Threads Graph Explorer',
    portalUrl: 'https://developers.facebook.com/tools/explorer/',
    scopes: 'threads_basic, threads_content_publish',
    tokenPlaceholder: 'Paste THQ... Threads Access Token',
    idLabel: 'Threads User ID (Auto-detected)',
    quickSteps: [
      'Open Meta Developer Portal -> your App with Threads API use case.',
      'Generate a Threads User Access Token with threads_basic & threads_content_publish.',
      'Paste the token below to auto-detect your Threads User ID and @handle.',
    ],
  },
  pinterest: {
    apiBadge: 'Pinterest API v5',
    portalName: 'Pinterest Developer Portal',
    portalUrl: 'https://developers.pinterest.com/apps/',
    scopes: 'user_accounts:read, boards:read, pins:read, pins:write',
    tokenPlaceholder: 'Paste pina_... Pinterest API v5 Access Token',
    idLabel: 'Pinterest Board ID or Username (Auto-detected)',
    quickSteps: [
      'Open Pinterest Developer Portal -> My Apps.',
      'Generate an OAuth Access Token with user_accounts:read, boards:read, and pins:write.',
      'Paste the token below to link your Pinterest account and boards.',
    ],
  },
};

export default function ConnectionsPage() {
  const { pushToast } = useToast();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPlatform, setLoadingPlatform] = useState<
    SocialPlatform | 'sync' | null
  >(null);
  const [verifyingPlatform, setVerifyingPlatform] =
    useState<SocialPlatform | null>(null);

  const [activeModalAccount, setActiveModalAccount] =
    useState<ConnectedAccount | null>(null);
  const [accessTokenInput, setAccessTokenInput] = useState('');
  const [accountNameInput, setAccountNameInput] = useState('');
  const [handleInput, setHandleInput] = useState('');
  const [accountIdInput, setAccountIdInput] = useState('');
  const [showManualOverride, setShowManualOverride] = useState(false);

  const [showMetaWizard, setShowMetaWizard] = useState(false);
  const [metaWizardToken, setMetaWizardToken] = useState('');
  const [metaAppId, setMetaAppId] = useState('');
  const [metaAppSecret, setMetaAppSecret] = useState('');
  const [wizardLoading, setWizardLoading] = useState<'youtube' | 'meta' | null>(
    null
  );

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
        title: data.success
          ? `${PLATFORM_CONFIGS[platform].name} verified`
          : 'Verification failed',
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
    pushToast({
      type: 'info',
      title: 'Opening Google OAuth',
      description: 'Select your YouTube channel and approve access.',
    });
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
          title: 'YouTube login failed',
          description: data.error,
        });
      }
    } catch {
      pushToast({
        type: 'error',
        title: 'Could not launch YouTube OAuth listener',
      });
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
      pushToast({
        type: 'error',
        title: 'Failed to connect Meta Auto-Discovery',
      });
    } finally {
      setWizardLoading(null);
    }
  };

  const openConfigModal = (acc: ConnectedAccount) => {
    setActiveModalAccount(acc);
    setAccessTokenInput('');
    setAccountNameInput(
      acc.accountName === 'Not Connected' ? '' : acc.accountName
    );
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
            data.error ||
            `Could not verify ${PLATFORM_CONFIGS[platform].name} token.`,
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
      pushToast({
        type: 'error',
        title: 'Failed to save & verify connection',
      });
    } finally {
      setLoadingPlatform(null);
    }
  };

  const connectedCount = accounts.filter((a) => a.isConnected).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-studio-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold text-ink-primary tracking-[-0.02em]">
              Social Connections
            </h1>
            <Badge tone="success" className="font-mono">
              {connectedCount}/{accounts.length || 8} Active
            </Badge>
          </div>
          <p className="text-xs text-ink-muted">
            Paste any platform token for automatic Channel/Page ID, @handle, avatar, and follower discovery.
          </p>
        </div>

        <Button
          variant="success"
          size="sm"
          loading={loadingPlatform === 'sync'}
          onClick={handleSyncAndVerifyVault}
          icon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Verify All APIs
        </Button>
      </div>

      {/* Express Wizards Bar */}
      <Card className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-status-success" />
            <h2 className="text-sm font-semibold text-ink-primary">
              Express Connection Wizards
            </h2>
          </div>
          <p className="text-xs text-ink-secondary">
            Connect YouTube via browser OAuth or paste a Meta Graph token to link both your Facebook Page and Instagram Business account together.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto flex-shrink-0">
          <Button
            variant="secondary"
            size="sm"
            loading={wizardLoading === 'youtube'}
            disabled={wizardLoading !== null}
            onClick={handleYouTubeOneClickOAuth}
            icon={<Zap className="w-3.5 h-3.5 text-[#FF0033]" />}
          >
            1-Click YouTube OAuth
          </Button>

          <Button
            variant="primary"
            size="sm"
            disabled={wizardLoading !== null}
            onClick={() => setShowMetaWizard(true)}
            icon={<Sparkles className="w-3.5 h-3.5" />}
          >
            Meta (FB + IG) Auto-Connect
          </Button>
        </div>
      </Card>

      {/* 8-Platform Connections Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {accounts.map((acc) => {
            const cfg = PLATFORM_CONFIGS[acc.platform];
            const guide = PLATFORM_GUIDES[acc.platform];
            if (!cfg || !guide) return null;
            const isLoading = loadingPlatform === acc.platform;
            const isVerifying = verifyingPlatform === acc.platform;

            return (
              <Card
                key={acc.id}
                padding="sm"
                style={{ borderTopColor: cfg.color, borderTopWidth: '2px' }}
                className="flex flex-col justify-between space-y-3.5"
              >
                <div className="space-y-3">
                  {/* Top Header */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-studio-border">
                    <div className="flex items-center gap-2 min-w-0">
                      <PlatformBadge
                        platform={acc.platform}
                        size="md"
                        muted={!acc.isConnected}
                      />
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-ink-primary truncate">
                          {cfg.name}
                        </p>
                        <p className="text-[10px] text-ink-muted font-mono truncate">
                          {guide.apiBadge}
                        </p>
                      </div>
                    </div>

                    <Badge
                      tone={
                        acc.isConnected
                          ? acc.tokenStatus === 'expired'
                            ? 'warning'
                            : 'success'
                          : 'neutral'
                      }
                    >
                      <span
                        className={cn(
                          'w-1.5 h-1.5 rounded-full',
                          acc.isConnected
                            ? acc.tokenStatus === 'expired'
                              ? 'bg-status-warning'
                              : 'bg-status-success'
                            : 'bg-ink-muted'
                        )}
                      />
                      <span>
                        {acc.isConnected
                          ? acc.tokenStatus === 'expired'
                            ? 'Expired'
                            : 'Connected'
                          : 'Unlinked'}
                      </span>
                    </Badge>
                  </div>

                  {/* Account Identity */}
                  <div className="flex items-center gap-3">
                    {acc.isConnected && acc.avatarUrl ? (
                      <img
                        src={acc.avatarUrl}
                        alt={acc.accountName}
                        className="w-10 h-10 rounded-lg object-cover border border-status-success/40 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-studio-subtle border border-studio-border flex items-center justify-center flex-shrink-0">
                        <PlatformBadge
                          platform={acc.platform}
                          size="md"
                          muted={!acc.isConnected}
                        />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-ink-primary truncate">
                        {acc.isConnected
                          ? acc.accountName
                          : `Link ${cfg.name}`}
                      </p>
                      <p className="text-[11px] text-ink-muted font-mono truncate">
                        {acc.isConnected ? acc.handle : 'OAuth / Token discovery'}
                      </p>
                      {acc.isConnected && (
                        <p className="text-[11px] font-mono text-status-success mt-0.5">
                          {acc.followersCount.toLocaleString()}{' '}
                          {acc.platform === 'youtube' ? 'subs' : 'followers'}
                          {acc.postsCount ? ` · ${acc.postsCount} posts` : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Health / Scope Box */}
                  {acc.isConnected ? (
                    <div className="p-2.5 rounded-lg bg-studio-subtle border border-studio-border text-[11px] space-y-1">
                      {acc.credentials?.accountId && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-ink-muted">ID</span>
                          <span className="font-mono text-ink-primary truncate max-w-[155px]">
                            {acc.credentials.accountId}
                          </span>
                        </div>
                      )}
                      {acc.tokenStatusNote && (
                        <p
                          className={cn(
                            'truncate font-medium',
                            acc.tokenStatus === 'expired'
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                          )}
                          title={acc.tokenStatusNote}
                        >
                          {acc.tokenStatus === 'expired' ? (
                            <AlertTriangle className="w-3 h-3 inline mr-1" />
                          ) : (
                            <Check className="w-3 h-3 inline mr-1" />
                          )}
                          {acc.tokenStatusNote}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-studio-subtle border border-studio-border text-[11px] space-y-1">
                      <div className="flex items-center justify-between text-ink-secondary">
                        <span>Auth Mode</span>
                        <span className="font-mono text-ink-primary">OAuth 2.0</span>
                      </div>
                      <p className="text-ink-muted truncate" title={guide.scopes}>
                        Scopes: <span className="font-mono">{guide.scopes}</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2.5 border-t border-studio-border">
                  {acc.isConnected ? (
                    <>
                      <div className="flex items-center gap-1.5">
                        {(acc.platform === 'facebook' ||
                          acc.platform === 'instagram') && (
                          <Button
                            size="xs"
                            variant="secondary"
                            className="flex-1"
                            onClick={() => setShowMetaWizard(true)}
                            icon={<Sparkles className="w-3 h-3 text-accent-soft" />}
                          >
                            Meta Wizard
                          </Button>
                        )}
                        {acc.platform === 'youtube' && (
                          <Button
                            size="xs"
                            variant="secondary"
                            className="flex-1"
                            loading={wizardLoading === 'youtube'}
                            onClick={handleYouTubeOneClickOAuth}
                            icon={<Zap className="w-3 h-3 text-[#FF0033]" />}
                          >
                            OAuth
                          </Button>
                        )}
                        <Button
                          size="xs"
                          variant="secondary"
                          className="flex-1"
                          disabled={isLoading}
                          onClick={() => openConfigModal(acc)}
                          icon={<Key className="w-3 h-3 text-status-success" />}
                        >
                          Token
                        </Button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          size="xs"
                          variant="success"
                          className="flex-1"
                          loading={isVerifying}
                          onClick={() => handleVerifySingleCard(acc.platform)}
                          icon={<Activity className="w-3 h-3" />}
                        >
                          Test API
                        </Button>
                        <a
                          href={guide.portalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="h-7 px-2.5 rounded-md bg-studio-subtle hover:bg-studio-hover border border-studio-border text-ink-secondary hover:text-ink-primary text-[11px] inline-flex items-center gap-1"
                        >
                          <span>Portal</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleQuickDisconnect(acc.platform)}
                          disabled={isLoading}
                          title={`Disconnect ${cfg.name}`}
                          className="h-7 w-7 rounded-md bg-studio-subtle hover:bg-status-danger/15 border border-studio-border text-ink-muted hover:text-status-danger flex items-center justify-center transition-colors"
                        >
                          <Unplug className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="primary"
                        className="w-full"
                        disabled={isLoading}
                        onClick={() => openConfigModal(acc)}
                        icon={<PlugZap className="w-3.5 h-3.5" />}
                      >
                        Connect {cfg.name}
                      </Button>

                      <div className="flex items-center gap-1.5">
                        <a
                          href={guide.portalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 h-7 px-2.5 rounded-md bg-studio-subtle hover:bg-studio-hover border border-studio-border text-ink-secondary hover:text-ink-primary text-[11px] font-medium inline-flex items-center justify-center gap-1"
                        >
                          <span>Get Token</span>
                          <ExternalLink className="w-2.5 h-2.5 text-status-success" />
                        </a>
                        <Button
                          size="xs"
                          variant="secondary"
                          onClick={() => openConfigModal(acc)}
                        >
                          Setup Guide
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Meta Auto-Discovery Modal */}
      <Modal
        open={showMetaWizard}
        onClose={() => setShowMetaWizard(false)}
        title="Meta (Facebook + Instagram) Auto-Connect"
        subtitle="Paste a Meta Graph API token to discover your Page and Instagram Business account"
      >
        <form onSubmit={handleMetaAutoDiscover} className="space-y-4">
          <div className="p-3.5 rounded-lg bg-studio-subtle border border-studio-border text-xs text-ink-secondary space-y-2">
            <ol className="list-decimal list-inside space-y-1 text-ink-muted">
              <li>Open Meta Graph API Explorer and select your app.</li>
              <li>
                Add permissions:{' '}
                <code className="text-status-success font-mono">
                  pages_show_list, instagram_basic, instagram_content_publish
                </code>
              </li>
              <li>Generate your token and paste it below.</li>
            </ol>
            <a
              href="https://developers.facebook.com/tools/explorer/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-status-success hover:underline font-medium"
            >
              <span>Open Meta Graph API Explorer</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div>
            <FieldLabel>Meta Access Token (Required)</FieldLabel>
            <Input
              type="password"
              value={metaWizardToken}
              onChange={(e) => setMetaWizardToken(e.target.value)}
              placeholder="Paste EAAM... token here"
              className="font-mono"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel>Meta App ID (Optional)</FieldLabel>
              <Input
                type="text"
                value={metaAppId}
                onChange={(e) => setMetaAppId(e.target.value)}
                placeholder="App ID"
                className="font-mono"
              />
            </div>
            <div>
              <FieldLabel>Meta App Secret (Optional)</FieldLabel>
              <Input
                type="password"
                value={metaAppSecret}
                onChange={(e) => setMetaAppSecret(e.target.value)}
                placeholder="App Secret"
                className="font-mono"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowMetaWizard(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={wizardLoading === 'meta'}
              icon={<Check className="w-3.5 h-3.5" />}
            >
              Verify &amp; Connect Both
            </Button>
          </div>
        </form>
      </Modal>

      {/* Platform Token Modal */}
      <Modal
        open={Boolean(activeModalAccount)}
        onClose={() => setActiveModalAccount(null)}
        badge={
          activeModalAccount ? (
            <PlatformBadge platform={activeModalAccount.platform} size="sm" />
          ) : null
        }
        title={
          activeModalAccount
            ? `Connect ${PLATFORM_CONFIGS[activeModalAccount.platform].name}`
            : ''
        }
        subtitle={
          activeModalAccount
            ? PLATFORM_GUIDES[activeModalAccount.platform].apiBadge
            : undefined
        }
      >
        {activeModalAccount && (
          <form onSubmit={handleSaveConnection} className="space-y-4">
            <div className="p-3.5 rounded-lg bg-studio-subtle border border-studio-border text-xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-ink-primary">
                  How to obtain your token
                </span>
                <a
                  href={PLATFORM_GUIDES[activeModalAccount.platform].portalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-status-success hover:underline font-medium inline-flex items-center gap-1"
                >
                  <span>
                    {PLATFORM_GUIDES[activeModalAccount.platform].portalName}
                  </span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-ink-secondary">
                {PLATFORM_GUIDES[activeModalAccount.platform].quickSteps.map(
                  (step, i) => (
                    <li key={i}>{step}</li>
                  )
                )}
              </ol>
              <p className="text-[11px] text-ink-muted pt-1.5 border-t border-studio-border">
                Scopes:{' '}
                <code className="text-status-success font-mono">
                  {PLATFORM_GUIDES[activeModalAccount.platform].scopes}
                </code>
              </p>
            </div>

            <div>
              <FieldLabel>OAuth / API Access Token (Required)</FieldLabel>
              <Input
                type="password"
                value={accessTokenInput}
                onChange={(e) => setAccessTokenInput(e.target.value)}
                placeholder={
                  PLATFORM_GUIDES[activeModalAccount.platform].tokenPlaceholder
                }
                className="font-mono"
                required
              />
              <p className="text-[11px] text-ink-muted mt-1">
                Account ID, Display Name, @handle, and follower counts are discovered automatically.
              </p>
            </div>

            <div className="border border-studio-border rounded-lg overflow-hidden bg-studio-subtle">
              <button
                type="button"
                onClick={() => setShowManualOverride(!showManualOverride)}
                className="w-full p-3 flex items-center justify-between text-left text-xs font-medium text-ink-secondary hover:text-ink-primary"
              >
                <span>Optional Manual Override</span>
                {showManualOverride ? (
                  <ChevronUp className="w-4 h-4 text-ink-muted" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-ink-muted" />
                )}
              </button>

              {showManualOverride && (
                <div className="p-3.5 pt-0 space-y-3 border-t border-studio-border">
                  <div className="pt-3">
                    <FieldLabel>
                      {PLATFORM_GUIDES[activeModalAccount.platform].idLabel}
                    </FieldLabel>
                    <Input
                      type="text"
                      value={accountIdInput}
                      onChange={(e) => setAccountIdInput(e.target.value)}
                      placeholder="Leave blank to auto-detect"
                      className="font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <FieldLabel>Display Name (Optional)</FieldLabel>
                      <Input
                        type="text"
                        value={accountNameInput}
                        onChange={(e) => setAccountNameInput(e.target.value)}
                        placeholder="e.g. ZCodeDev"
                      />
                    </div>
                    <div>
                      <FieldLabel>Handle (Optional)</FieldLabel>
                      <Input
                        type="text"
                        value={handleInput}
                        onChange={(e) => setHandleInput(e.target.value)}
                        placeholder="e.g. @zcodedev"
                        className="font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActiveModalAccount(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={loadingPlatform === activeModalAccount.platform}
                icon={<Check className="w-3.5 h-3.5" />}
              >
                Verify &amp; Connect
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
