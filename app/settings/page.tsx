'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Globe,
  Cloud,
  Check,
  ShieldCheck,
  FileText,
  ExternalLink,
  HardDrive,
  Bell,
  KeyRound,
  Share2,
  ArrowUpRight,
} from 'lucide-react';
import { ConnectedAccount, PublishMode } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  FieldLabel,
  Input,
  PlatformBadge,
  SegmentedTabs,
  Select,
  useToast,
} from '@/components/ui';

type SettingsTab =
  | 'account'
  | 'integrations'
  | 'storage'
  | 'notifications'
  | 'security';

interface SystemStatus {
  supabaseConfigured: boolean;
  r2Configured: boolean;
  r2Bucket: string | null;
  postizConfigured: boolean;
  youtubeEnvConfigured: boolean;
  metaEnvConfigured: boolean;
  cronSecretConfigured: boolean;
}

export default function SettingsPage() {
  const { pushToast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const [brandName, setBrandName] = useState('ZCodeDev');
  const [timezone, setTimezone] = useState('Asia/Karachi');
  const [notificationEmail, setNotificationEmail] =
    useState('zain@zcodedev.com');
  const [autoOptimalTime, setAutoOptimalTime] = useState(true);
  const [defaultPublishMode, setDefaultPublishMode] =
    useState<PublishMode>('native_schedule');

  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          setBrandName(data.settings.brandName || 'ZCodeDev');
          setTimezone(data.settings.timezone || 'Asia/Karachi');
          setNotificationEmail(
            data.settings.notificationEmail || 'zain@zcodedev.com'
          );
          if (typeof data.settings.autoOptimalTime === 'boolean') {
            setAutoOptimalTime(data.settings.autoOptimalTime);
          }
          if (data.settings.defaultPublishMode) {
            setDefaultPublishMode(data.settings.defaultPublishMode);
          }
        }
        if (data.systemStatus) setSystemStatus(data.systemStatus);
      })
      .catch(() => {});

    fetch('/api/accounts')
      .then((res) => res.json())
      .then((data) => {
        if (data.accounts) setAccounts(data.accounts);
      })
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName,
          timezone,
          notificationEmail,
          autoOptimalTime,
          defaultPublishMode,
        }),
      });
      if (res.ok) {
        setSaved(true);
        pushToast({
          type: 'success',
          title: 'Settings saved',
          description: 'Brand profile and scheduling defaults updated.',
        });
        setTimeout(() => setSaved(false), 2500);
      } else {
        throw new Error('Failed to save');
      }
    } catch {
      pushToast({
        type: 'error',
        title: 'Save failed',
        description: 'Could not update workspace settings.',
      });
    } finally {
      setSaving(false);
    }
  };

  const connectedAccounts = accounts.filter((a) => a.isConnected);

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-studio-border">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-ink-primary tracking-[-0.02em]">
            Workspace Settings
          </h1>
          <p className="text-xs text-ink-muted">
            Manage brand identity, scheduling engine defaults, storage configuration, notifications, and API security.
          </p>
        </div>

        <SegmentedTabs
          size="xs"
          value={activeTab}
          onChange={setActiveTab}
          items={[
            { id: 'account', label: 'Account' },
            { id: 'integrations', label: 'Integrations' },
            { id: 'storage', label: 'Storage' },
            { id: 'notifications', label: 'Notifications' },
            { id: 'security', label: 'Security & API' },
          ]}
        />
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {activeTab === 'account' && (
          <>
            <Card className="space-y-4">
              <CardHeader
                icon={<Globe className="w-4 h-4 text-accent-soft" />}
                title="Brand Identity &amp; Scheduling Defaults"
                subtitle="Applies across Composer, Calendar, and Workspace Header"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <FieldLabel htmlFor="brandName">Brand / Studio Name</FieldLabel>
                  <Input
                    id="brandName"
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="timezone">Scheduling Timezone</FieldLabel>
                  <Select
                    id="timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  >
                    <option value="Asia/Karachi">Asia/Karachi (PKT, UTC+5)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST, UTC+4)</option>
                    <option value="Europe/London">Europe/London (GMT, UTC+0)</option>
                    <option value="America/New_York">
                      America/New_York (EST, UTC-5)
                    </option>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <FieldLabel htmlFor="defaultPublishMode">
                    Default Publishing Engine
                  </FieldLabel>
                  <Select
                    id="defaultPublishMode"
                    value={defaultPublishMode}
                    onChange={(e) =>
                      setDefaultPublishMode(e.target.value as PublishMode)
                    }
                  >
                    <option value="native_schedule">
                      Cloud Server Hold (YouTube publishAt / Meta scheduled_publish_time — Works offline)
                    </option>
                    <option value="publish_now">Publish Immediately Live</option>
                    <option value="local_queue">Local Cron Queue</option>
                  </Select>
                </div>
              </div>

              <label className="flex items-start gap-3 p-3 rounded-lg bg-studio-subtle border border-studio-border cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoOptimalTime}
                  onChange={(e) => setAutoOptimalTime(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-accent rounded"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-ink-primary">
                    Auto-select peak engagement window (18:30 PKT)
                  </span>
                  <p className="text-[11px] text-ink-muted">
                    Pre-fills Composer schedule time with the highest-performing evening window.
                  </p>
                </div>
              </label>
            </Card>

            <Card className="space-y-2.5">
              <CardHeader
                icon={<Cloud className="w-4 h-4 text-status-cloud" />}
                title="How Cloud Server Hold Works"
                subtitle="Native platform scheduling architecture"
              />
              <p className="text-xs text-ink-secondary leading-relaxed">
                When scheduling in <strong className="text-ink-primary">Cloud Server Hold</strong> mode, video binaries upload immediately to YouTube (<code className="font-mono text-accent-soft">status.publishAt</code>) and Meta (<code className="font-mono text-status-success">scheduled_publish_time</code>). Platforms hold the asset in their own data centers and automatically make it public at your exact scheduled minute—even when your machine is shut down.
              </p>
            </Card>
          </>
        )}

        {activeTab === 'integrations' && (
          <Card className="space-y-4">
            <CardHeader
              icon={<Share2 className="w-4 h-4 text-status-success" />}
              title="Connected Social Integrations"
              subtitle={`${connectedAccounts.length} of ${accounts.length || 8} channels linked`}
              action={
                <Link href="/connections">
                  <Button
                    size="xs"
                    variant="secondary"
                    icon={<ArrowUpRight className="w-3 h-3" />}
                  >
                    Manage Connections
                  </Button>
                </Link>
              }
            />

            <div className="divide-y divide-studio-border">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <PlatformBadge
                      platform={acc.platform}
                      size="sm"
                      muted={!acc.isConnected}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-ink-primary truncate">
                        {acc.isConnected ? acc.accountName : acc.platform}
                      </p>
                      <p className="text-[11px] text-ink-muted font-mono truncate">
                        {acc.isConnected ? acc.handle : 'Not linked'}
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
                    {acc.isConnected
                      ? acc.tokenStatus === 'expired'
                        ? 'Needs Refresh'
                        : 'Active'
                      : 'Unlinked'}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeTab === 'storage' && (
          <Card className="space-y-4">
            <CardHeader
              icon={<HardDrive className="w-4 h-4 text-status-cloud" />}
              title="Media &amp; Object Storage"
              subtitle="Video binary upload pipeline and retention storage"
              action={
                <Link href="/media">
                  <Button
                    size="xs"
                    variant="secondary"
                    icon={<ArrowUpRight className="w-3 h-3" />}
                  >
                    Open Media Library
                  </Button>
                </Link>
              }
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-lg bg-studio-subtle border border-studio-border space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink-primary">
                    Cloudflare R2 Storage
                  </span>
                  <Badge tone={systemStatus?.r2Configured ? 'success' : 'neutral'}>
                    {systemStatus?.r2Configured ? 'Configured' : 'Local Fallback'}
                  </Badge>
                </div>
                <p className="text-[11px] text-ink-muted font-mono">
                  Bucket: {systemStatus?.r2Bucket || 'Not configured (using /api/upload)'}
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-studio-subtle border border-studio-border space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink-primary">
                    Supabase Metadata Store
                  </span>
                  <Badge tone={systemStatus?.supabaseConfigured ? 'success' : 'neutral'}>
                    {systemStatus?.supabaseConfigured ? 'Connected' : 'Local JSON Store'}
                  </Badge>
                </div>
                <p className="text-[11px] text-ink-muted">
                  Persists post schedules, accounts, audit logs, and video asset metadata.
                </p>
              </div>
            </div>
          </Card>
        )}

        {activeTab === 'notifications' && (
          <Card className="space-y-4">
            <CardHeader
              icon={<Bell className="w-4 h-4 text-status-warning" />}
              title="Notification Preferences"
              subtitle="Configure owner contact email for publishing alerts and token status"
            />
            <div>
              <FieldLabel htmlFor="notificationEmail">Owner Alert Email</FieldLabel>
              <Input
                id="notificationEmail"
                type="email"
                value={notificationEmail}
                onChange={(e) => setNotificationEmail(e.target.value)}
                placeholder="you@domain.com"
              />
              <p className="text-[11px] text-ink-muted mt-1.5">
                Used as the primary workspace contact for compliance and failure notifications.
              </p>
            </div>
          </Card>
        )}

        {activeTab === 'security' && (
          <div className="space-y-4">
            <Card className="space-y-4">
              <CardHeader
                icon={<KeyRound className="w-4 h-4 text-accent-soft" />}
                title="API &amp; Environment Configuration"
                subtitle="Server-side integration readiness (secrets are never exposed to the client)"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {[
                  {
                    label: 'YouTube OAuth Env',
                    ready: Boolean(systemStatus?.youtubeEnvConfigured),
                  },
                  {
                    label: 'Meta Graph Token Env',
                    ready: Boolean(systemStatus?.metaEnvConfigured),
                  },
                  {
                    label: 'Cloudflare R2 Presigner',
                    ready: Boolean(systemStatus?.r2Configured),
                  },
                  {
                    label: 'Supabase Database',
                    ready: Boolean(systemStatus?.supabaseConfigured),
                  },
                  {
                    label: 'Postiz Bridge',
                    ready: Boolean(systemStatus?.postizConfigured),
                  },
                  {
                    label: 'Cron Secret Guard',
                    ready: Boolean(systemStatus?.cronSecretConfigured),
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="p-3 rounded-lg bg-studio-subtle border border-studio-border flex items-center justify-between"
                  >
                    <span className="font-medium text-ink-primary">
                      {item.label}
                    </span>
                    <Badge tone={item.ready ? 'success' : 'neutral'}>
                      {item.ready ? 'Ready' : 'Optional / Unset'}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="space-y-3">
              <CardHeader
                icon={<ShieldCheck className="w-4 h-4 text-status-success" />}
                title="Legal &amp; Platform Compliance"
                subtitle="Developer verification policies for Google YouTube API, Meta, TikTok, and X"
              />

              <div className="flex flex-wrap items-center gap-2">
                <Link href="/terms">
                  <Button
                    size="xs"
                    variant="secondary"
                    icon={<FileText className="w-3.5 h-3.5 text-accent-soft" />}
                  >
                    Terms &amp; Conditions
                  </Button>
                </Link>
                <Link href="/privacy">
                  <Button
                    size="xs"
                    variant="secondary"
                    icon={<ShieldCheck className="w-3.5 h-3.5 text-status-success" />}
                  >
                    Privacy Policy
                  </Button>
                </Link>
                <a
                  href="https://www.youtube.com/t/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    size="xs"
                    variant="ghost"
                    icon={<ExternalLink className="w-3 h-3" />}
                  >
                    YouTube TOS
                  </Button>
                </a>
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    size="xs"
                    variant="ghost"
                    icon={<ExternalLink className="w-3 h-3" />}
                  >
                    Google Privacy
                  </Button>
                </a>
              </div>
            </Card>
          </div>
        )}

        {(activeTab === 'account' || activeTab === 'notifications') && (
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={saving}
              icon={saved ? <Check className="w-4 h-4" /> : undefined}
            >
              {saved ? 'Settings Saved' : 'Save Brand Settings'}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
