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
  Calendar as CalendarIcon,
  Loader2,
} from 'lucide-react';
import { Skeleton, useToast } from '@/components/ui';

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

  const [previewPlatform, setPreviewPlatform] = useState<SocialPlatform>('youtube');

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
    if (
      selectedPlatforms.length > 0 &&
      !selectedPlatforms.includes(previewPlatform)
    ) {
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
    const localISO = new Date(d.getTime() - tzOffset)
      .toISOString()
      .slice(0, 16);
    setScheduledAt(localISO);
    pushToast({
      type: 'success',
      title: 'Optimal time applied',
      description: 'Scheduled for tomorrow 18:30 PKT (Metricool peak engagement).',
    });
  };

  // Real-time Metricool-style validation notices
  const validationErrors: string[] = [];
  if (selectedPlatforms.length === 0) {
    validationErrors.push('Select at least 1 social network to publish.');
  }
  if (!videoUrl) {
    if (selectedPlatforms.includes('youtube')) {
      validationErrors.push('It is necessary to include a video on YouTube.');
    }
    if (selectedPlatforms.includes('instagram')) {
      validationErrors.push(
        'Instagram Reels require 1 video asset (MP4 or MOV).'
      );
    }
    if (selectedPlatforms.includes('facebook')) {
      validationErrors.push(
        'Facebook Reels/Videos require 1 video asset.'
      );
    }
    if (selectedPlatforms.includes('tiktok')) {
      validationErrors.push(
        'In TikTok it is necessary to include at least one video.'
      );
    }
    if (
      !selectedPlatforms.includes('youtube') &&
      !selectedPlatforms.includes('instagram') &&
      !selectedPlatforms.includes('facebook') &&
      !selectedPlatforms.includes('tiktok')
    ) {
      validationErrors.push('Upload or select a video asset before publishing.');
    }
  }
  if (
    selectedPlatforms.includes('youtube') &&
    !platformOverrides.youtube?.title?.trim() &&
    !globalCaption.trim() &&
    !videoFileName
  ) {
    validationErrors.push('The video title is mandatory on YouTube.');
  }

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
        text: 'Cannot schedule in the past! Choose a future time or select "Publish Immediately".',
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
            : 'Post registered in your Metricool planner queue.';

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
  const ytAcc = accounts.find((a) => a.platform === 'youtube');

  return (
    <div className="space-y-5 pb-10">
      {/* Metricool Top Header Bar: "Create new post" + Brand Pill */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
            Create new post
          </h1>

          {/* Metricool Brand Badge Pill */}
          <div className="h-9 px-3 rounded-xl bg-slate-100 border border-slate-200 inline-flex items-center gap-2">
            {ytAcc?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ytAcc.avatarUrl}
                alt="ZCodeDev"
                className="w-5 h-5 rounded-full object-cover"
              />
            ) : (
              <span className="w-5 h-5 rounded-full bg-[#211832] text-[#D8FF36] text-[10px] font-bold flex items-center justify-center">
                Z
              </span>
            )}
            <span className="text-xs font-bold text-slate-800">ZCodeDev</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleSetOptimalTime}
            className="h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-bold text-slate-800 inline-flex items-center gap-2 transition-colors"
          >
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Apply Best Time (18:30 PKT)</span>
          </button>

          <Link
            href="/calendar"
            className="h-10 px-4 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-xs font-bold text-slate-700 inline-flex items-center gap-2 transition-colors"
          >
            <CalendarIcon className="w-4 h-4 text-slate-500" />
            <span>Planner Calendar</span>
          </Link>
        </div>
      </div>

      {/* Submission Status Alert */}
      {statusMessage && (
        <div
          className={cn(
            'p-4 rounded-2xl border flex flex-col gap-2.5 text-xs shadow-xs',
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : statusMessage.type === 'warning'
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          )}
        >
          <div className="flex items-center gap-2 text-sm font-bold">
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
                  className="h-8 px-3 rounded-lg bg-white border border-slate-300 hover:border-[#211832] text-slate-900 text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs"
                >
                  <span>Open {plat.toUpperCase()}</span>
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Unlinked Network Notice */}
      {unlinkedSelected.length > 0 && (
        <div className="px-4 py-3.5 rounded-2xl bg-amber-50 border border-amber-300 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-amber-900 font-medium">
            <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              Unconnected network selected:{' '}
              <strong className="font-bold text-slate-900">
                {unlinkedSelected
                  .map((p) => PLATFORM_CONFIGS[p].name)
                  .join(', ')}
              </strong>
            </span>
          </div>
          <Link
            href="/connections"
            className="h-8 px-3 rounded-lg bg-white border border-amber-300 text-xs font-bold text-amber-900 hover:bg-amber-100 inline-flex items-center gap-1.5 flex-shrink-0"
          >
            <span>Connect Now</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Metricool 2-Column Split Composer Layout */}
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
      >
        {/* Left 7 Columns: Network Bar + Media Studio + Master Editor + Presets Accordions + Validation + Footer */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-5">
          <PlatformSelector
            selectedPlatforms={selectedPlatforms}
            onTogglePlatform={handleTogglePlatform}
            connectedPlatforms={connectedPlatforms}
            platformOverrides={platformOverrides}
            onUpdateOverride={handleOverrideChange}
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

          {/* Metricool Real-Time Validation Box */}
          {validationErrors.length > 0 ? (
            <div className="p-4 sm:p-5 rounded-2xl bg-[#FEF2F2] border border-[#FCA5A5] space-y-2">
              <div className="flex items-center gap-2 text-xs font-extrabold text-[#991B1B]">
                <AlertTriangle className="w-4 h-4 text-[#DC2626] flex-shrink-0" />
                <span>
                  {validationErrors.length}{' '}
                  {validationErrors.length === 1
                    ? 'requirement pending'
                    : 'requirements pending'}{' '}
                  before publishing
                </span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-xs font-medium text-[#7F1D1D]">
                {validationErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 flex items-center gap-2.5 text-xs font-bold text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>
                All platform requirements verified — Ready to schedule or publish!
              </span>
            </div>
          )}

          {/* Metricool Bottom Dispatch & Scheduling Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Dispatch &amp; Scheduling Strategy
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Choose Cloud Hold, Immediate Live Broadcast, or Planner Queue
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setPublishMode('native_schedule')}
                className={cn(
                  'p-4 rounded-xl border-2 text-left transition-all space-y-1.5',
                  publishMode === 'native_schedule'
                    ? 'bg-slate-50 border-[#211832] text-slate-900 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50/50'
                )}
              >
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <Cloud className="w-4 h-4 text-emerald-600" />
                  <span>Cloud Hold (Recommended)</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Video uploads to cloud and publishes automatically at your chosen time.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPublishMode('publish_now')}
                className={cn(
                  'p-4 rounded-xl border-2 text-left transition-all space-y-1.5',
                  publishMode === 'publish_now'
                    ? 'bg-slate-50 border-[#211832] text-slate-900 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50/50'
                )}
              >
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span>Publish Immediately</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Bypasses schedule queue; broadcasts live right now to all selected platforms.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPublishMode('local_queue')}
                className={cn(
                  'p-4 rounded-xl border-2 text-left transition-all space-y-1.5',
                  publishMode === 'local_queue'
                    ? 'bg-slate-50 border-[#211832] text-slate-900 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50/50'
                )}
              >
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>Planner Queue</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Saves post to calendar queue for scheduled cron-triggered delivery.
                </p>
              </button>
            </div>

            {/* Metricool Bottom Action Footer */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <Link
                  href="/calendar"
                  className="h-11 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 inline-flex items-center justify-center transition-colors"
                >
                  Cancel
                </Link>

                {publishMode !== 'publish_now' ? (
                  <div className="flex items-center gap-2.5 flex-1 sm:flex-initial">
                    <div className="relative flex items-center">
                      <input
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        className="h-11 px-3.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs sm:text-sm font-semibold focus:outline-none focus:border-[#211832] focus:ring-2 focus:ring-[#211832]/10 shadow-2xs"
                        required
                      />
                    </div>
                  </div>
                ) : (
                  <span className="px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900">
                    Ready for immediate live broadcast to {selectedPlatforms.length}{' '}
                    network(s)
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto h-11 px-6 rounded-xl bg-[#211832] hover:bg-[#2d2144] disabled:opacity-60 text-[#D8FF36] text-sm font-bold inline-flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>
                  {isSubmitting
                    ? 'Publishing...'
                    : publishMode === 'publish_now'
                    ? 'Publish Live Now'
                    : publishMode === 'native_schedule'
                    ? 'Schedule'
                    : 'Save to Calendar'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Right 5 Columns: Sticky Post Preview Panel */}
        <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-4">
          <PostPreviewCard
            selectedPlatforms={selectedPlatforms}
            activePlatform={previewPlatform}
            onSelectPlatform={setPreviewPlatform}
            videoUrl={videoPreviewUrl || videoUrl}
            coverUrl={coverUrl}
            title={
              previewOverride?.title ||
              platformOverrides.youtube?.title ||
              (previewPlatform === 'youtube' ? videoFileName : undefined)
            }
            caption={previewOverride?.caption || globalCaption}
            firstComment={previewOverride?.firstComment}
            accountHandle={activeAccount?.handle || '@zcodedev'}
            accountAvatar={activeAccount?.avatarUrl || ytAcc?.avatarUrl}
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
          <Skeleton className="h-16 w-full rounded-2xl" />
          <div className="grid grid-cols-12 gap-6">
            <Skeleton className="col-span-8 h-[600px] rounded-2xl" />
            <Skeleton className="col-span-4 h-[600px] rounded-2xl" />
          </div>
        </div>
      }
    >
      <ComposerContent />
    </Suspense>
  );
}
