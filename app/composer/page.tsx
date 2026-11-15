'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import PlatformSelector from '@/components/PlatformSelector';
import VideoDropzone from '@/components/VideoDropzone';
import TailoredPlatformEditor from '@/components/TailoredPlatformEditor';
import PostPreviewCard from '@/components/PostPreviewCard';
import {
  SocialPlatform,
  PlatformSpecificContent,
  ConnectedAccount,
  PublishMode,
} from '@/lib/types';
import { cn, PLATFORM_CONFIGS } from '@/lib/utils';
import {
  Clock,
  Send,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Cloud,
  Zap,
  ExternalLink,
} from 'lucide-react';
import { Button, Card, Skeleton, useToast } from '@/components/ui';

function ComposerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pushToast } = useToast();

  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>([
    'youtube',
    'instagram',
    'facebook',
  ]);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoPreviewUrl, setVideoPreviewUrl] = useState('');
  const [videoFileName, setVideoFileName] = useState('');
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoAspectRatio, setVideoAspectRatio] = useState('9:16 (Vertical)');
  const [videoSizeMb, setVideoSizeMb] = useState(0);
  const [coverUrl, setCoverUrl] = useState('');
  const [thumbOffsetMs, setThumbOffsetMs] = useState(1000);

  const [globalCaption, setGlobalCaption] = useState('');
  const [shortenerEnabled, setShortenerEnabled] = useState(true);
  const [platformOverrides, setPlatformOverrides] = useState<
    Record<SocialPlatform, PlatformSpecificContent>
  >({} as Record<SocialPlatform, PlatformSpecificContent>);

  const [publishMode, setPublishMode] = useState<PublishMode>('native_schedule');
  const [scheduledAt, setScheduledAt] = useState('');

  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
    urls?: Record<string, string>;
  } | null>(null);

  const [previewPlatform, setPreviewPlatform] = useState<SocialPlatform>('instagram');

  useEffect(() => {
    fetch('/api/accounts')
      .then((res) => res.json())
      .then((data) => {
        if (data.accounts) setAccounts(data.accounts);
      })
      .catch(() => {});

    const cloneId = searchParams.get('clone');
    const editId = searchParams.get('edit');
    const paramDate = searchParams.get('date');

    if (paramDate) {
      setScheduledAt(paramDate);
    } else {
      const now = new Date();
      now.setHours(now.getHours() + 2);
      now.setMinutes(0, 0, 0);
      const tzOffset = now.getTimezoneOffset() * 60000;
      const localISO = new Date(now.getTime() - tzOffset)
        .toISOString()
        .slice(0, 16);
      setScheduledAt(localISO);
    }

    if (cloneId || editId) {
      const targetId = cloneId || editId;
      fetch(`/api/posts`)
        .then((res) => res.json())
        .then((data) => {
          if (data.posts) {
            const found = data.posts.find((p: any) => p.id === targetId);
            if (found) {
              setGlobalCaption(found.globalCaption || '');
              setSelectedPlatforms(found.targetPlatforms || ['youtube']);
              setVideoUrl(found.mediaUrl || '');
              setVideoPreviewUrl(found.mediaUrl || '');
              setVideoFileName(found.mediaFileName || '');
              setVideoDuration(found.mediaDurationSec || 0);
              setVideoAspectRatio(found.mediaAspectRatio || '9:16 (Vertical)');
              setVideoSizeMb(found.mediaSizeMb || 0);
              setCoverUrl(found.coverUrl || '');
              setThumbOffsetMs(found.thumbOffsetMs || 1000);
              if (found.platformOverrides) {
                setPlatformOverrides(found.platformOverrides);
              }
              if (editId && found.scheduledAt) {
                const d = new Date(found.scheduledAt);
                const tzOffset = d.getTimezoneOffset() * 60000;
                setScheduledAt(
                  new Date(d.getTime() - tzOffset).toISOString().slice(0, 16)
                );
              }
            }
          }
        })
        .catch(() => {});
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedPlatforms.length > 0 && !selectedPlatforms.includes(previewPlatform)) {
      setPreviewPlatform(selectedPlatforms[0]);
    }
  }, [selectedPlatforms, previewPlatform]);

  const connectedPlatforms = accounts
    .filter((a) => a.isConnected)
    .map((a) => a.platform);

  const unlinkedSelected = selectedPlatforms.filter(
    (p) => !connectedPlatforms.includes(p)
  );

  const handleTogglePlatform = (platform: SocialPlatform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const handleOverrideChange = (
    platform: SocialPlatform,
    patch: Partial<PlatformSpecificContent>
  ) => {
    setPlatformOverrides((prev) => ({
      ...prev,
      [platform]: {
        ...(prev[platform] || {}),
        ...patch,
      },
    }));
  };

  const handleSetOptimalTime = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(18, 30, 0, 0);
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISO = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    setScheduledAt(localISO);
    pushToast({
      type: 'success',
      title: 'Optimal time applied',
      description: 'Scheduled for tomorrow 18:30 PKT (Metricool peak engagement).',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (selectedPlatforms.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'Select at least one social media channel.',
      });
      return;
    }

    if (!videoUrl) {
      setStatusMessage({
        type: 'error',
        text: 'Please upload or pick a video asset before publishing.',
      });
      return;
    }

    const schedDate = new Date(scheduledAt);
    if (publishMode !== 'publish_now' && isNaN(schedDate.getTime())) {
      setStatusMessage({
        type: 'error',
        text: 'Invalid scheduling date and time.',
      });
      return;
    }
    if (
      publishMode !== 'publish_now' &&
      schedDate.getTime() <= Date.now() - 60000
    ) {
      setStatusMessage({
        type: 'error',
        text: 'Cannot schedule in the past! Choose a future time or select "Publish Immediately Now".',
      });
      return;
    }

    for (const plat of selectedPlatforms) {
      const cfg = PLATFORM_CONFIGS[plat];
      const platCaption = platformOverrides[plat]?.caption || globalCaption;
      if (platCaption.length > cfg.charLimit) {
        setStatusMessage({
          type: 'error',
          text: `${cfg.name} allows maximum ${cfg.charLimit} characters (currently ${platCaption.length}).`,
        });
        return;
      }
      if (cfg.fields.hasTitle) {
        const platTitle = platformOverrides[plat]?.title;
        if (platTitle && platTitle.length > 100) {
          setStatusMessage({
            type: 'error',
            text: `${cfg.name} title cannot exceed 100 characters.`,
          });
          return;
        }
      }
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publishMode,
          scheduledAt: schedDate.toISOString(),
          mediaUrl: videoUrl,
          mediaFileName: videoFileName,
          mediaDurationSec: videoDuration,
          mediaAspectRatio: videoAspectRatio,
          mediaSizeMb: videoSizeMb,
          coverUrl,
          thumbOffsetMs,
          globalCaption,
          shortenerEnabled,
          targetPlatforms: selectedPlatforms,
          platformOverrides,
        }),
      });

      const rawText = await res.text();
      let data: Record<string, any> = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        throw new Error(
          `Server returned HTTP ${res.status}. Use local studio when uploading large binaries directly.`
        );
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit post.');
      }

      if (data.errors && data.errors.length > 0) {
        setStatusMessage({
          type: 'warning',
          text: `Completed with notices: ${data.errors.join(' | ')}`,
          urls: data.publishedUrls,
        });
      } else {
        const successText =
          publishMode === 'publish_now'
            ? 'Post dispatched immediately to selected platforms.'
            : publishMode === 'native_schedule'
            ? 'Video uploaded to cloud storage and locked for automated dispatch.'
            : 'Post registered in your local Metricool planner queue.';

        setStatusMessage({
          type: 'success',
          text: successText,
          urls: data.publishedUrls,
        });
        pushToast({
          type: 'success',
          title: 'Post Scheduled Successfully',
          description: successText,
        });

        setTimeout(() => {
          router.push('/calendar');
        }, 1500);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission failed';
      setStatusMessage({ type: 'error', text: msg });
      pushToast({ type: 'error', title: 'Schedule Failed', description: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeAccount = accounts.find((a) => a.platform === previewPlatform);
  const previewOverride = platformOverrides[previewPlatform];

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#FFFFFF] border border-[#E2E8F0] shadow-card">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">
            Metricool Post Composer
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Multi-network editor, frame selector, caption tailoring, and cloud scheduler
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleSetOptimalTime}
          icon={<Sparkles className="w-3.5 h-3.5 text-[#00D2B4]" />}
        >
          Apply Best Time (18:30 PKT)
        </Button>
      </div>

      {/* Status Alert */}
      {statusMessage && (
        <div
          className={cn(
            'p-4 rounded-xl border flex flex-col gap-2 text-xs shadow-xs',
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : statusMessage.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-red-50 border-red-200 text-red-800'
          )}
        >
          <div className="flex items-center gap-2 font-bold">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          {statusMessage.urls && Object.keys(statusMessage.urls).length > 0 && (
            <div className="flex flex-wrap gap-2 pl-6">
              {Object.entries(statusMessage.urls).map(([plat, url]) => (
                <a
                  key={plat}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded-md bg-[#FFFFFF] border border-slate-200 hover:border-[#00D2B4] text-slate-800 text-[11px] font-bold inline-flex items-center gap-1 shadow-xs"
                >
                  <span>Open {plat.toUpperCase()}</span>
                  <ExternalLink className="w-3 h-3 text-[#00D2B4]" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Unlinked Network Notice */}
      {unlinkedSelected.length > 0 && (
        <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-800">
            <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              Unconnected network selected:{' '}
              <strong className="text-slate-900">
                {unlinkedSelected
                  .map((p) => PLATFORM_CONFIGS[p].name)
                  .join(', ')}
              </strong>
            </span>
          </div>
          <Link
            href="/connections"
            className="text-xs font-bold text-amber-700 hover:text-amber-900 inline-flex items-center gap-1 flex-shrink-0"
          >
            <span>Connect Now</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* Main Split-Pane Grid */}
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start"
      >
        <div className="lg:col-span-8 space-y-4">
          <PlatformSelector
            selectedPlatforms={selectedPlatforms}
            onTogglePlatform={handleTogglePlatform}
            connectedPlatforms={connectedPlatforms}
          />

          <VideoDropzone
            videoUrl={videoUrl}
            videoPreviewUrl={videoPreviewUrl}
            videoFileName={videoFileName}
            videoDuration={videoDuration}
            videoAspectRatio={videoAspectRatio}
            videoSizeMb={videoSizeMb}
            coverUrl={coverUrl}
            thumbOffsetMs={thumbOffsetMs}
            onVideoSelected={(data) => {
              setVideoUrl(data.url);
              setVideoPreviewUrl(data.previewUrl || data.url);
              setVideoFileName(data.fileName);
              setVideoDuration(data.duration);
              setVideoAspectRatio(data.aspectRatio);
              setVideoSizeMb(data.sizeMb);
            }}
            onCoverUpdated={(newCover, newOffset) => {
              setCoverUrl(newCover);
              setThumbOffsetMs(newOffset);
            }}
            onClearVideo={() => {
              setVideoUrl('');
              setVideoPreviewUrl('');
              setVideoFileName('');
              setCoverUrl('');
              setThumbOffsetMs(0);
            }}
          />

          <TailoredPlatformEditor
            selectedPlatforms={selectedPlatforms}
            videoFileName={videoFileName}
            globalCaption={globalCaption}
            onGlobalCaptionChange={setGlobalCaption}
            shortenerEnabled={shortenerEnabled}
            onToggleShortener={setShortenerEnabled}
            platformOverrides={platformOverrides}
            onUpdateOverride={handleOverrideChange}
          />

          {/* Publishing Mode Card */}
          <Card padding="sm" className="space-y-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Dispatch &amp; Scheduling Strategy
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Select cloud hold, immediate broadcast, or cron-managed calendar delivery
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setPublishMode('native_schedule')}
                className={cn(
                  'p-3 rounded-xl border text-left transition-all space-y-1 shadow-xs',
                  publishMode === 'native_schedule'
                    ? 'bg-[#E6FAF7] border-[#00D2B4] text-slate-900'
                    : 'bg-[#FFFFFF] border-slate-200 text-slate-600 hover:bg-slate-50'
                )}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#00A38C]">
                  <Cloud className="w-3.5 h-3.5" />
                  <span>Cloud Hold (Recommended)</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Video uploads to server and publishes automatically at chosen time.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPublishMode('publish_now')}
                className={cn(
                  'p-3 rounded-xl border text-left transition-all space-y-1 shadow-xs',
                  publishMode === 'publish_now'
                    ? 'bg-[#E6FAF7] border-[#00D2B4] text-slate-900'
                    : 'bg-[#FFFFFF] border-slate-200 text-slate-600 hover:bg-slate-50'
                )}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Publish Immediately</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Bypasses schedule queue; broadcasts instantly to selected platforms.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPublishMode('local_queue')}
                className={cn(
                  'p-3 rounded-xl border text-left transition-all space-y-1 shadow-xs',
                  publishMode === 'local_queue'
                    ? 'bg-[#E6FAF7] border-[#00D2B4] text-slate-900'
                    : 'bg-[#FFFFFF] border-slate-200 text-slate-600 hover:bg-slate-50'
                )}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Planner Queue</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Saves to calendar queue for cron-triggered dispatch.
                </p>
              </button>
            </div>

            <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              {publishMode !== 'publish_now' ? (
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <Clock className="w-4 h-4 text-[#00D2B4] flex-shrink-0" />
                  <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                    Schedule Time:
                  </span>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="h-9 px-3 rounded-lg bg-[#FFFFFF] border border-slate-300 text-slate-900 text-xs font-mono focus:outline-none focus:border-[#00D2B4] focus:ring-2 focus:ring-[#00D2B4]/20 shadow-xs"
                    required
                  />
                </div>
              ) : (
                <div className="text-xs font-bold text-emerald-600">
                  Ready for immediate dispatch to {selectedPlatforms.length}{' '}
                  network(s).
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={isSubmitting}
                className="w-full sm:w-auto font-bold"
                icon={<Send className="w-3.5 h-3.5" />}
              >
                {isSubmitting
                  ? 'Uploading...'
                  : publishMode === 'publish_now'
                  ? 'Publish Live Now'
                  : publishMode === 'native_schedule'
                  ? 'Upload & Schedule on Cloud'
                  : 'Save to Calendar'}
              </Button>
            </div>
          </Card>
        </div>

        {/* Right 4 Columns: Sticky Preview */}
        <div className="lg:col-span-4 lg:sticky lg:top-4">
          <PostPreviewCard
            selectedPlatforms={selectedPlatforms}
            activePlatform={previewPlatform}
            onSelectPlatform={setPreviewPlatform}
            videoUrl={videoPreviewUrl || videoUrl}
            coverUrl={coverUrl}
            title={
              previewOverride?.title ||
              (previewPlatform === 'youtube' ? videoFileName : undefined)
            }
            caption={previewOverride?.caption || globalCaption}
            firstComment={previewOverride?.firstComment}
            accountHandle={activeAccount?.handle || '@zcodedev'}
            accountAvatar={activeAccount?.avatarUrl}
            isAiGenerated={previewOverride?.isAiGenerated}
            paidPromotion={previewOverride?.paidPromotion}
            shortenerEnabled={shortenerEnabled}
          />
        </div>
      </form>
    </div>
  );
}

export default function ComposerPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-14 w-full rounded-xl" />
          <div className="grid grid-cols-12 gap-4">
            <Skeleton className="col-span-8 h-[500px] rounded-xl" />
            <Skeleton className="col-span-4 h-[500px] rounded-xl" />
          </div>
        </div>
      }
    >
      <ComposerContent />
    </Suspense>
  );
}
