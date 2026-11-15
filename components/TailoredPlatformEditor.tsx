'use client';

import { useState } from 'react';
import { SocialPlatform, PlatformSpecificContent } from '@/lib/types';
import { PLATFORM_CONFIGS, YOUTUBE_CATEGORIES } from '@/lib/utils';
import {
  Sparkles,
  MessageSquare,
  Eye,
  Tag,
  FileText,
  Sliders,
  Users,
  Music,
  Cpu,
  Link2,
  Shield,
  Wand2,
  RefreshCw,
  CheckCircle2,
  Globe,
  ListPlus,
  MapPin,
  Layers,
  Hash,
} from 'lucide-react';

interface TailoredPlatformEditorProps {
  selectedPlatforms: SocialPlatform[];
  videoFileName?: string;
  globalCaption: string;
  onGlobalCaptionChange: (caption: string) => void;
  shortenerEnabled: boolean;
  onToggleShortener: (val: boolean) => void;
  platformOverrides: Partial<Record<SocialPlatform, PlatformSpecificContent>>;
  onUpdateOverride: (
    platform: SocialPlatform,
    content: Partial<PlatformSpecificContent>
  ) => void;
}

const ALL_PLATFORMS: SocialPlatform[] = [
  'youtube',
  'instagram',
  'facebook',
  'tiktok',
  'twitter',
  'linkedin',
  'threads',
  'pinterest',
];

export default function TailoredPlatformEditor({
  selectedPlatforms,
  videoFileName,
  globalCaption,
  onGlobalCaptionChange,
  shortenerEnabled,
  onToggleShortener,
  platformOverrides,
  onUpdateOverride,
}: TailoredPlatformEditorProps) {
  // Default to the first selected platform so platform settings & AI options are ALWAYS visible immediately!
  const [activePlatformTab, setActivePlatformTab] = useState<SocialPlatform>(
    selectedPlatforms[0] || 'youtube'
  );
  const [showAllStacked, setShowAllStacked] = useState<boolean>(false);
  const [tagsInputMap, setTagsInputMap] = useState<Record<string, string>>({});

  // Built-in Metricool AI Content Studio State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTone, setAiTone] = useState<
    | 'viral'
    | 'coding'
    | 'hinglish'
    | 'educational'
    | 'storytelling'
    | 'professional'
  >('viral');
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  // Global Master Toggles
  const [globalAiDisclosure, setGlobalAiDisclosure] = useState<boolean>(false);
  const [globalPaidPromo, setGlobalPaidPromo] = useState<boolean>(false);
  const [globalFirstComment, setGlobalFirstComment] = useState<string>('');

  const handleToggleGlobalAiDisclosure = (checked: boolean) => {
    setGlobalAiDisclosure(checked);
    ALL_PLATFORMS.forEach((plat) => {
      onUpdateOverride(plat, {
        isAiGenerated: checked,
        containsSyntheticMedia: checked,
        isCreatedWithAi: checked,
      });
    });
  };

  const handleToggleGlobalPaidPromo = (checked: boolean) => {
    setGlobalPaidPromo(checked);
    ALL_PLATFORMS.forEach((plat) => {
      onUpdateOverride(plat, {
        paidPromotion: checked,
        commercialContent: checked,
      });
    });
  };

  const handleSyncGlobalFirstComment = (comment: string) => {
    setGlobalFirstComment(comment);
    ALL_PLATFORMS.forEach((plat) => {
      onUpdateOverride(plat, { firstComment: comment });
    });
  };

  const runAiAssistant = async (
    action: 'full_pack' | 'improve_caption' | 'viral_hashtags' | 'first_comment'
  ) => {
    setAiLoading(action);
    setAiNotice(null);
    try {
      const res = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          fileName: videoFileName,
          currentCaption: globalCaption,
          tone: aiTone,
          action,
          platforms: selectedPlatforms,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.globalCaption) {
          onGlobalCaptionChange(data.globalCaption);
        }
        if (data.firstComment && action === 'first_comment') {
          handleSyncGlobalFirstComment(data.firstComment);
        }
        if (data.youtubeTags) {
          setTagsInputMap((prev) => ({
            ...prev,
            youtube: data.youtubeTags.join(', '),
          }));
          onUpdateOverride('youtube', { tags: data.youtubeTags });
        }
        if (data.platformPack) {
          (Object.keys(data.platformPack) as SocialPlatform[]).forEach(
            (plat) => {
              const pack = data.platformPack[plat];
              if (pack) {
                onUpdateOverride(plat, {
                  title: pack.title,
                  caption: pack.caption,
                  firstComment: pack.firstComment,
                  tags: pack.tags,
                  audioName: pack.audioName,
                });
              }
            }
          );
          if (data.firstComment) {
            setGlobalFirstComment(data.firstComment);
          }
        }
        setAiNotice(data.message || 'AI Content applied across platforms!');
        setTimeout(() => setAiNotice(null), 5000);
      }
    } catch {
      // ignore
    } finally {
      setAiLoading(null);
    }
  };

  const platformsToDisplay: SocialPlatform[] = showAllStacked
    ? selectedPlatforms.length > 0
      ? selectedPlatforms
      : ['youtube', 'instagram', 'facebook']
    : [
        selectedPlatforms.includes(activePlatformTab)
          ? activePlatformTab
          : selectedPlatforms[0] || activePlatformTab,
      ];

  const renderPlatformSettingsCard = (plat: SocialPlatform) => {
    const cfg = PLATFORM_CONFIGS[plat];
    const override: PlatformSpecificContent = platformOverrides[plat] || {
      caption: globalCaption,
    };
    const isAiChecked = Boolean(
      override.isAiGenerated ||
        override.containsSyntheticMedia ||
        override.isCreatedWithAi
    );
    const tagsDisplay =
      tagsInputMap[plat] ?? (override.tags ? override.tags.join(', ') : '');

    return (
      <div
        key={plat}
        style={{ borderTopColor: cfg.color, borderTopWidth: '3px' }}
        className="p-3.5 rounded-xl bg-studio-shell border border-studio-border space-y-3.5 shadow-md"
      >
        {/* Platform Card Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-studio-border">
          <div className="flex items-center gap-2">
            <span
              className="px-2 py-0.5 rounded text-[10px] font-black text-white shadow-sm"
              style={{ backgroundColor: cfg.color }}
            >
              {cfg.shortName}
            </span>
            <span className="text-xs sm:text-sm font-extrabold text-slate-900">
              {cfg.name} Advanced Presets, AI Label &amp; API Options
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-mono">
              {(override.caption ?? globalCaption).length}/{cfg.charLimit} chars
            </span>
            <button
              type="button"
              onClick={() => onUpdateOverride(plat, { caption: globalCaption })}
              className="px-2 py-0.5 rounded bg-studio-subtle hover:bg-studio-hover text-[10px] text-status-success font-bold"
            >
              Sync Global Text
            </button>
          </div>
        </div>

        {/* UNIVERSAL AI CONTENT DISCLOSURE & PAID PROMOTION ROW (Present on EVERY Platform!) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-2.5 rounded-lg bg-studio-subtle border border-status-warning/25">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isAiChecked}
              onChange={(e) =>
                onUpdateOverride(plat, {
                  isAiGenerated: e.target.checked,
                  containsSyntheticMedia: e.target.checked,
                  isCreatedWithAi: e.target.checked,
                })
              }
              className="mt-0.5 accent-accent w-4 h-4 rounded"
            />
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-300">
                <Cpu className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span>
                  {plat === 'youtube'
                    ? 'Altered / Synthetic Content (AI Content Label)'
                    : plat === 'instagram' || plat === 'facebook'
                    ? 'Meta "Created with AI" Transparency Label'
                    : plat === 'tiktok'
                    ? 'TikTok AI-Generated Content (AIGC) Label'
                    : `${cfg.name} AI-Generated Content Disclosure`}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-snug">
                {plat === 'youtube'
                  ? 'Sends official status.containsSyntheticMedia=true to YouTube Data API v3.'
                  : plat === 'instagram' || plat === 'facebook'
                  ? 'Sends official is_created_with_ai=true to Meta Graph API v22.0.'
                  : plat === 'tiktok'
                  ? 'Sends official is_aigc=true to TikTok Direct Post API v2.'
                  : `Marks this ${cfg.name} post with official AI transparency metadata.`}
              </p>
            </div>
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(
                override.paidPromotion || override.commercialContent
              )}
              onChange={(e) =>
                onUpdateOverride(plat, {
                  paidPromotion: e.target.checked,
                  commercialContent: e.target.checked,
                })
              }
              className="mt-0.5 accent-status-success w-4 h-4 rounded"
            />
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-status-success">
                <Shield className="w-3.5 h-3.5 text-status-success flex-shrink-0" />
                <span>Paid Promotion / Branded Content Disclosure</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-snug">
                Discloses sponsorship, brand partnership, or commercial product placement on {cfg.name}.
              </p>
            </div>
          </label>
        </div>

        {/* Title Input (YouTube, Facebook, LinkedIn, Pinterest) */}
        {cfg.fields.hasTitle && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-accent-soft" />
                <span>
                  {plat === 'youtube'
                    ? 'YouTube Video / Short Title (Required • Max 100 chars)'
                    : `${cfg.name} Video / Post Title`}
                </span>
              </label>
              <span className="text-[10px] font-mono text-slate-400">
                {override.title?.length || 0}/100
              </span>
            </div>
            <input
              type="text"
              value={override.title || ''}
              onChange={(e) =>
                onUpdateOverride(plat, { title: e.target.value })
              }
              placeholder={`Enter ${cfg.name} title (or click "Generate with AI" above)...`}
              maxLength={100}
              className="w-full px-3 py-2 rounded-lg bg-studio-surface border border-studio-border text-slate-100 text-xs focus:outline-none focus:border-accent/60"
            />
          </div>
        )}

        {/* Platform Specific Caption / Description */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-slate-200">
              {plat === 'youtube'
                ? 'YouTube Video Description & Hashtags'
                : `${cfg.name} Custom Caption & Hashtags`}
            </label>
            <span className="text-[10px] text-slate-400">
              Customizes text for {cfg.name} only
            </span>
          </div>
          <textarea
            value={override.caption ?? globalCaption}
            onChange={(e) =>
              onUpdateOverride(plat, { caption: e.target.value })
            }
            rows={3}
            placeholder={`Write custom caption/description for ${cfg.name}...`}
            className="w-full p-2.5 rounded-lg bg-studio-surface border border-studio-border text-slate-100 text-xs focus:outline-none focus:border-accent/60 resize-y"
          />
        </div>

        {/* YOUTUBE SPECIFIC METRICOOL STUDIO SETTINGS */}
        {plat === 'youtube' && (
          <div className="p-3 rounded-lg bg-studio-surface border border-studio-border space-y-3">
            <p className="text-[11px] font-extrabold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              <span>YouTube Data API v3 Studio Options</span>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                  Format Type
                </label>
                <select
                  value={override.postType || 'short'}
                  onChange={(e) =>
                    onUpdateOverride('youtube', {
                      postType: e.target.value as 'short' | 'video',
                      isShortOrReel: e.target.value === 'short',
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#00D2B4] focus:ring-1 focus:ring-[#00D2B4]"
                >
                  <option value="short">YouTube Short (9:16 Vertical)</option>
                  <option value="video">Standard Video (16:9)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                  Privacy Visibility
                </label>
                <select
                  value={override.privacy || 'public'}
                  onChange={(e) =>
                    onUpdateOverride('youtube', {
                      privacy: e.target.value as
                        | 'public'
                        | 'unlisted'
                        | 'private',
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#00D2B4] focus:ring-1 focus:ring-[#00D2B4]"
                >
                  <option value="public">Public</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="private">Private</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                  YouTube Category
                </label>
                <select
                  value={override.categoryId || '28'}
                  onChange={(e) =>
                    onUpdateOverride('youtube', { categoryId: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#00D2B4] focus:ring-1 focus:ring-[#00D2B4]"
                >
                  {YOUTUBE_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                  Audience (COPPA Compliance)
                </label>
                <select
                  value={override.madeForKids ? 'yes' : 'no'}
                  onChange={(e) =>
                    onUpdateOverride('youtube', {
                      madeForKids: e.target.value === 'yes',
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#00D2B4] focus:ring-1 focus:ring-[#00D2B4]"
                >
                  <option value="no">No, not made for kids</option>
                  <option value="yes">Yes, made for kids</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                  Video License
                </label>
                <select
                  value={override.license || 'youtube'}
                  onChange={(e) =>
                    onUpdateOverride('youtube', {
                      license: e.target.value as 'youtube' | 'creativeCommon',
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#00D2B4] focus:ring-1 focus:ring-[#00D2B4]"
                >
                  <option value="youtube">Standard YouTube License</option>
                  <option value="creativeCommon">
                    Creative Commons - Attribution
                  </option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 mb-1">
                  <Globe className="w-2.5 h-2.5 text-status-success" />
                  <span>Audio &amp; Title Language</span>
                </label>
                <select
                  value={override.defaultLanguage || 'en'}
                  onChange={(e) =>
                    onUpdateOverride('youtube', {
                      defaultLanguage: e.target.value,
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#00D2B4] focus:ring-1 focus:ring-[#00D2B4]"
                >
                  <option value="en">English (en)</option>
                  <option value="ur">Urdu / Roman Urdu (ur)</option>
                  <option value="hi">Hindi / Hinglish (hi)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 mb-1">
                  <Tag className="w-2.5 h-2.5 text-status-success" />
                  <span>YouTube Search Tags (comma-separated, up to 35)</span>
                </label>
                <input
                  type="text"
                  value={tagsDisplay}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTagsInputMap((prev) => ({ ...prev, youtube: val }));
                    onUpdateOverride('youtube', {
                      tags: val
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean),
                    });
                  }}
                  placeholder="python, coding, aiautomation, zcodedev, shorts"
                  className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#00D2B4] focus:ring-1 focus:ring-[#00D2B4]"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 mb-1">
                  <ListPlus className="w-2.5 h-2.5 text-accent-soft" />
                  <span>Auto-Add to YouTube Playlist ID (Optional)</span>
                </label>
                <input
                  type="text"
                  value={override.playlistId || ''}
                  onChange={(e) =>
                    onUpdateOverride('youtube', { playlistId: e.target.value })
                  }
                  placeholder="e.g. PLxxxxxxxxxxxxxxxx"
                  className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs text-slate-900 font-mono focus:outline-none focus:border-[#00D2B4] focus:ring-1 focus:ring-[#00D2B4]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <label className="flex items-center gap-2 p-2 rounded bg-studio-subtle border border-studio-border cursor-pointer text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={override.embeddable !== false}
                  onChange={(e) =>
                    onUpdateOverride('youtube', {
                      embeddable: e.target.checked,
                    })
                  }
                  className="accent-accent"
                />
                <span>Allow Video Embedding</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded bg-studio-subtle border border-studio-border cursor-pointer text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={override.notifySubscribers !== false}
                  onChange={(e) =>
                    onUpdateOverride('youtube', {
                      notifySubscribers: e.target.checked,
                    })
                  }
                  className="accent-accent"
                />
                <span>Notify Channel Subscribers</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded bg-studio-subtle border border-studio-border cursor-pointer text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={override.publicStatsViewable !== false}
                  onChange={(e) =>
                    onUpdateOverride('youtube', {
                      publicStatsViewable: e.target.checked,
                    })
                  }
                  className="accent-accent"
                />
                <span>Show Like Count Publicly</span>
              </label>
            </div>
          </div>
        )}

        {/* INSTAGRAM SPECIFIC METRICOOL SETTINGS */}
        {plat === 'instagram' && (
          <div className="p-3 rounded-lg bg-studio-surface border border-studio-border space-y-3">
            <p className="text-[11px] font-extrabold text-pink-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              <span>Instagram Graph API v22.0 Reels &amp; Feed Options</span>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                  Publication Format
                </label>
                <select
                  value={override.postType || 'reel'}
                  onChange={(e) =>
                    onUpdateOverride('instagram', {
                      postType: e.target.value as 'reel' | 'post' | 'story',
                      isShortOrReel: e.target.value === 'reel',
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#00D2B4] focus:ring-1 focus:ring-[#00D2B4]"
                >
                  <option value="reel">Instagram Reel (9:16)</option>
                  <option value="post">Feed Video Post</option>
                  <option value="story">Instagram Story</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 mb-1">
                  <Users className="w-2.5 h-2.5 text-pink-400" />
                  <span>Invite Collaborators (up to 3 @handles)</span>
                </label>
                <input
                  type="text"
                  value={override.collaborators || ''}
                  onChange={(e) =>
                    onUpdateOverride('instagram', {
                      collaborators: e.target.value,
                    })
                  }
                  placeholder="@collab1, @collab2"
                  className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#00D2B4] focus:ring-1 focus:ring-[#00D2B4]"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 mb-1">
                  <Music className="w-2.5 h-2.5 text-cyan-400" />
                  <span>Original Audio Rename</span>
                </label>
                <input
                  type="text"
                  value={override.audioName || ''}
                  onChange={(e) =>
                    onUpdateOverride('instagram', { audioName: e.target.value })
                  }
                  placeholder="Original Audio - ZCodeDev"
                  className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#00D2B4] focus:ring-1 focus:ring-[#00D2B4]"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 mb-1">
                  <Users className="w-2.5 h-2.5 text-status-success" />
                  <span>Tag Users in Video (@usernames)</span>
                </label>
                <input
                  type="text"
                  value={override.userTags || ''}
                  onChange={(e) =>
                    onUpdateOverride('instagram', { userTags: e.target.value })
                  }
                  placeholder="@username1, @username2"
                  className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#00D2B4] focus:ring-1 focus:ring-[#00D2B4]"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 mb-1">
                  <MapPin className="w-2.5 h-2.5 text-amber-400" />
                  <span>Location Tag</span>
                </label>
                <input
                  type="text"
                  value={override.locationName || ''}
                  onChange={(e) =>
                    onUpdateOverride('instagram', {
                      locationName: e.target.value,
                    })
                  }
                  placeholder="Karachi, Pakistan / Remote"
                  className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#00D2B4] focus:ring-1 focus:ring-[#00D2B4]"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                  Accessibility Alt Text
                </label>
                <input
                  type="text"
                  value={override.altText || ''}
                  onChange={(e) =>
                    onUpdateOverride('instagram', { altText: e.target.value })
                  }
                  placeholder="Describe video for screen readers..."
                  className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#00D2B4] focus:ring-1 focus:ring-[#00D2B4]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="flex items-center gap-2 p-2 rounded bg-studio-subtle border border-studio-border cursor-pointer text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={override.shareToFeed !== false}
                  onChange={(e) =>
                    onUpdateOverride('instagram', {
                      shareToFeed: e.target.checked,
                    })
                  }
                  className="accent-accent"
                />
                <span>Also Share Reel to Main Profile Grid (`share_to_feed`)</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded bg-studio-subtle border border-studio-border cursor-pointer text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={Boolean(override.disableComments)}
                  onChange={(e) =>
                    onUpdateOverride('instagram', {
                      disableComments: e.target.checked,
                    })
                  }
                  className="accent-accent"
                />
                <span>Turn Off Comments on This Reel</span>
              </label>
            </div>
          </div>
        )}

        {/* FACEBOOK SPECIFIC METRICOOL SETTINGS */}
        {plat === 'facebook' && (
          <div className="p-3 rounded-lg bg-studio-surface border border-studio-border space-y-3">
            <p className="text-[11px] font-extrabold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              <span>Facebook Page Graph API v22.0 Reels &amp; Video Options</span>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                  Facebook Publication Format
                </label>
                <select
                  value={override.postType || 'reel'}
                  onChange={(e) =>
                    onUpdateOverride('facebook', {
                      postType: e.target.value as 'reel' | 'video',
                      isShortOrReel: e.target.value === 'reel',
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#00D2B4] focus:ring-1 focus:ring-[#00D2B4]"
                >
                  <option value="reel">Facebook Page Reel (9:16)</option>
                  <option value="video">Facebook Page Standard Video</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                  Call-To-Action (CTA) Button
                </label>
                <select
                  value={override.callToActionType || 'NONE'}
                  onChange={(e) =>
                    onUpdateOverride('facebook', {
                      callToActionType: e.target.value as
                        | 'NONE'
                        | 'LEARN_MORE'
                        | 'WATCH_MORE'
                        | 'SHOP_NOW'
                        | 'SIGN_UP',
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#00D2B4] focus:ring-1 focus:ring-[#00D2B4]"
                >
                  <option value="NONE">No CTA Button</option>
                  <option value="LEARN_MORE">Learn More</option>
                  <option value="WATCH_MORE">Watch More</option>
                  <option value="SIGN_UP">Sign Up</option>
                  <option value="SHOP_NOW">Shop Now</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                  CTA Destination URL (Optional)
                </label>
                <input
                  type="url"
                  value={override.destinationLink || ''}
                  onChange={(e) =>
                    onUpdateOverride('facebook', {
                      destinationLink: e.target.value,
                    })
                  }
                  placeholder="https://youtube.com/@zcodedev"
                  className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#00D2B4] focus:ring-1 focus:ring-[#00D2B4]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="flex items-center gap-2 p-2 rounded bg-studio-subtle border border-studio-border cursor-pointer text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={override.shareToFeed !== false}
                  onChange={(e) =>
                    onUpdateOverride('facebook', {
                      shareToFeed: e.target.checked,
                    })
                  }
                  className="accent-accent"
                />
                <span>Share Reel to Page Feed Timeline</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded bg-studio-subtle border border-studio-border cursor-pointer text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={override.embeddable !== false}
                  onChange={(e) =>
                    onUpdateOverride('facebook', {
                      embeddable: e.target.checked,
                    })
                  }
                  className="accent-accent"
                />
                <span>Allow Video Embedding</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded bg-studio-subtle border border-studio-border cursor-pointer text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={Boolean(override.secret)}
                  onChange={(e) =>
                    onUpdateOverride('facebook', { secret: e.target.checked })
                  }
                  className="accent-accent"
                />
                <span>Publish as Unlisted / Secret Video</span>
              </label>
            </div>
          </div>
        )}

        {/* TIKTOK SPECIFIC METRICOOL SETTINGS */}
        {plat === 'tiktok' && (
          <div className="p-3 rounded-lg bg-studio-surface border border-studio-border space-y-3">
            <p className="text-[11px] font-extrabold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              <span>TikTok Direct Post API v2 Creator Settings</span>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                  Who Can Watch This Video (Privacy Level)
                </label>
                <select
                  value={override.privacy || 'public'}
                  onChange={(e) =>
                    onUpdateOverride('tiktok', {
                      privacy: e.target.value as
                        | 'public'
                        | 'friends'
                        | 'private',
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#00D2B4] focus:ring-1 focus:ring-[#00D2B4]"
                >
                  <option value="public">Public to Everyone</option>
                  <option value="friends">Friends (Mutual Followers)</option>
                  <option value="private">Private (Only Me)</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-1.5 self-end">
                <label className="flex items-center gap-1.5 p-2 rounded bg-studio-subtle border border-studio-border cursor-pointer text-[11px] text-slate-200">
                  <input
                    type="checkbox"
                    checked={override.allowComments !== false}
                    onChange={(e) =>
                      onUpdateOverride('tiktok', {
                        allowComments: e.target.checked,
                      })
                    }
                    className="accent-accent"
                  />
                  <span>Comments</span>
                </label>

                <label className="flex items-center gap-1.5 p-2 rounded bg-studio-subtle border border-studio-border cursor-pointer text-[11px] text-slate-200">
                  <input
                    type="checkbox"
                    checked={override.allowDuet !== false}
                    onChange={(e) =>
                      onUpdateOverride('tiktok', {
                        allowDuet: e.target.checked,
                      })
                    }
                    className="accent-accent"
                  />
                  <span>Duet</span>
                </label>

                <label className="flex items-center gap-1.5 p-2 rounded bg-studio-subtle border border-studio-border cursor-pointer text-[11px] text-slate-200">
                  <input
                    type="checkbox"
                    checked={override.allowStitch !== false}
                    onChange={(e) =>
                      onUpdateOverride('tiktok', {
                        allowStitch: e.target.checked,
                      })
                    }
                    className="accent-accent"
                  />
                  <span>Stitch</span>
                </label>
              </div>
            </div>

            {override.commercialContent && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 rounded bg-studio-subtle border border-cyan-500/30">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                  <input
                    type="checkbox"
                    checked={override.commercialYourBrand !== false}
                    onChange={(e) =>
                      onUpdateOverride('tiktok', {
                        commercialYourBrand: e.target.checked,
                      })
                    }
                    className="accent-status-success"
                  />
                  <span>Your Brand (Promoting your own business)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                  <input
                    type="checkbox"
                    checked={Boolean(override.commercialBrandedContent)}
                    onChange={(e) =>
                      onUpdateOverride('tiktok', {
                        commercialBrandedContent: e.target.checked,
                      })
                    }
                    className="accent-accent"
                  />
                  <span>Branded Content (Third-party paid partnership)</span>
                </label>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="flex items-center gap-2 p-2 rounded bg-studio-subtle border border-studio-border cursor-pointer text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={Boolean(override.autoAddMusic)}
                  onChange={(e) =>
                    onUpdateOverride('tiktok', {
                      autoAddMusic: e.target.checked,
                    })
                  }
                  className="accent-accent"
                />
                <span>Auto-Sync Trending Sound (`auto_add_music`)</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded bg-studio-subtle border border-studio-border cursor-pointer text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={override.highQualityUpload !== false}
                  onChange={(e) =>
                    onUpdateOverride('tiktok', {
                      highQualityUpload: e.target.checked,
                    })
                  }
                  className="accent-accent"
                />
                <span>Allow 1080p High-Quality Upload</span>
              </label>
            </div>
          </div>
        )}

        {/* X (TWITTER) SPECIFIC METRICOOL SETTINGS */}
        {plat === 'twitter' && (
          <div className="p-3 rounded-lg bg-studio-surface border border-studio-border grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                Who Can Reply on X (`reply_settings`)
              </label>
              <select
                value={override.xReplySettings || 'everyone'}
                onChange={(e) =>
                  onUpdateOverride('twitter', {
                    xReplySettings: e.target.value as
                      | 'everyone'
                      | 'following'
                      | 'mentionedUsers'
                      | 'subscribers',
                  })
                }
                className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#00D2B4] focus:ring-1 focus:ring-[#00D2B4]"
              >
                <option value="everyone">Everyone</option>
                <option value="following">Accounts You Follow</option>
                <option value="mentionedUsers">Only Mentioned Users</option>
                <option value="subscribers">Verified Subscribers Only</option>
              </select>
            </div>

            <label className="flex items-center gap-2 p-2 rounded bg-studio-subtle border border-studio-border cursor-pointer text-xs text-slate-200 self-end">
              <input
                type="checkbox"
                checked={Boolean(override.sensitiveContent)}
                onChange={(e) =>
                  onUpdateOverride('twitter', {
                    sensitiveContent: e.target.checked,
                  })
                }
                className="accent-accent"
              />
              <span>Mark Media as Sensitive Warning</span>
            </label>
          </div>
        )}

        {/* LINKEDIN SPECIFIC METRICOOL SETTINGS */}
        {plat === 'linkedin' && (
          <div className="p-3 rounded-lg bg-studio-surface border border-studio-border grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 mb-1">
                <Eye className="w-3 h-3 text-blue-400" />
                <span>LinkedIn Network Visibility</span>
              </label>
              <select
                value={override.privacy || 'public'}
                onChange={(e) =>
                  onUpdateOverride('linkedin', {
                    privacy: e.target.value as 'public' | 'private',
                  })
                }
                className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#00D2B4] focus:ring-1 focus:ring-[#00D2B4]"
              >
                <option value="public">Public (Anyone on or off LinkedIn)</option>
                <option value="private">Connections Only</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                Project / Article Resource Link (Optional)
              </label>
              <input
                type="url"
                value={override.destinationLink || ''}
                onChange={(e) =>
                  onUpdateOverride('linkedin', {
                    destinationLink: e.target.value,
                  })
                }
                placeholder="https://github.com/Zain1098"
                className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#00D2B4] focus:ring-1 focus:ring-[#00D2B4]"
              />
            </div>
          </div>
        )}

        {/* THREADS SPECIFIC METRICOOL SETTINGS */}
        {plat === 'threads' && (
          <div className="p-3 rounded-lg bg-studio-surface border border-studio-border grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                Who Can Reply on Threads (`reply_control`)
              </label>
              <select
                value={override.replyControl || 'everyone'}
                onChange={(e) =>
                  onUpdateOverride('threads', {
                    replyControl: e.target.value as
                      | 'everyone'
                      | 'accounts_you_follow'
                      | 'mentioned_only',
                  })
                }
                className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#00D2B4] focus:ring-1 focus:ring-[#00D2B4]"
              >
                <option value="everyone">Everyone</option>
                <option value="accounts_you_follow">Profiles You Follow</option>
                <option value="mentioned_only">Mentioned Only</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 mb-1">
                <Hash className="w-3 h-3 text-purple-400" />
                <span>Threads Topic Tag</span>
              </label>
              <input
                type="text"
                value={override.topicTag || ''}
                onChange={(e) =>
                  onUpdateOverride('threads', { topicTag: e.target.value })
                }
                placeholder="Coding & AI"
                className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#00D2B4] focus:ring-1 focus:ring-[#00D2B4]"
              />
            </div>
          </div>
        )}

        {/* PINTEREST SPECIFIC METRICOOL SETTINGS */}
        {plat === 'pinterest' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-lg bg-studio-surface border border-studio-border">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                Pinterest Board ID / Name
              </label>
              <input
                type="text"
                value={override.boardId || ''}
                onChange={(e) =>
                  onUpdateOverride('pinterest', { boardId: e.target.value })
                }
                placeholder="Board ID (e.g. 9823749234)"
                className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#00D2B4] focus:ring-1 focus:ring-[#00D2B4]"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                Destination Link URL
              </label>
              <input
                type="url"
                value={override.destinationLink || ''}
                onChange={(e) =>
                  onUpdateOverride('pinterest', {
                    destinationLink: e.target.value,
                  })
                }
                placeholder="https://youtube.com/@zcodedev"
                className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#00D2B4] focus:ring-1 focus:ring-[#00D2B4]"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                Pin Alt Text (SEO)
              </label>
              <input
                type="text"
                value={override.altText || ''}
                onChange={(e) =>
                  onUpdateOverride('pinterest', { altText: e.target.value })
                }
                placeholder="Describe Pin video..."
                className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#00D2B4] focus:ring-1 focus:ring-[#00D2B4]"
              />
            </div>
          </div>
        )}

        {/* Auto First Comment / Follow-Up Reply */}
        {cfg.fields.hasFirstComment && (
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-status-success" />
              <span>
                Auto First Comment / Follow-up Reply on {cfg.name}
              </span>
            </label>
            <input
              type="text"
              value={override.firstComment || ''}
              onChange={(e) =>
                onUpdateOverride(plat, { firstComment: e.target.value })
              }
              placeholder={`Optional first comment to post automatically on ${cfg.name} right after publishing...`}
              className="w-full px-3 py-1.5 rounded-lg bg-studio-surface border border-studio-border text-slate-100 text-xs focus:outline-none focus:border-accent/60"
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 rounded-xl bg-studio-surface border border-studio-border space-y-4">
      {/* 1. BUILT-IN METRICOOL AI CONTENT & SEO GENERATOR STUDIO */}
      <div className="p-3.5 rounded-xl bg-studio-subtle border border-studio-borderStrong space-y-3 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-accent/15 border border-accent/60/40 text-accent-soft">
              <Wand2 className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                <span>Metricool AI Content, Title, Hashtag &amp; SEO Studio</span>
                <span className="px-1.5 py-0.5 rounded bg-status-success/15 text-status-success text-[9px] font-black uppercase">
                  Live Engine
                </span>
              </h3>
              <p className="text-[10px] text-slate-300">
                Enter your video topic (or use your uploaded video filename) to auto-generate titles, captions, hashtags, YouTube SEO tags &amp; first comments for all platforms.
              </p>
            </div>
          </div>

          <select
            value={aiTone}
            onChange={(e) =>
              setAiTone(
                e.target.value as
                  | 'viral'
                  | 'coding'
                  | 'hinglish'
                  | 'educational'
                  | 'storytelling'
                  | 'professional'
              )
            }
            className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#00D2B4]"
          >
            <option value="viral">Tone: Viral Hook &amp; Retention</option>
            <option value="coding">Tone: Coding &amp; Tech Breakdown</option>
            <option value="hinglish">Tone: Roman Urdu / Hinglish + English</option>
            <option value="educational">Tone: Step-by-Step Educational</option>
            <option value="storytelling">Tone: Developer Storytelling</option>
            <option value="professional">Tone: Professional / Executive</option>
          </select>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder={
              videoFileName
                ? `Video topic (default: "${videoFileName}") — e.g. Python AI Agent Tutorial in 60s...`
                : 'Type your video topic or idea (e.g. Build an AI Agent with Python & Next.js)...'
            }
            className="flex-1 px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#00D2B4] focus:ring-1 focus:ring-[#00D2B4]"
          />

          <button
            type="button"
            onClick={() => runAiAssistant('full_pack')}
            disabled={aiLoading !== null}
            className="px-4 py-2 rounded-lg bg-[#00D2B4] hover:bg-[#00BFA3] transition-colors text-[#0D1525] text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm flex-shrink-0"
          >
            {aiLoading === 'full_pack' ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>Generate Full AI Pack (All Platforms)</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => runAiAssistant('improve_caption')}
            disabled={aiLoading !== null}
            className="px-2.5 py-1 rounded-md bg-studio-subtle hover:bg-studio-hover border border-studio-borderStrong text-[10px] font-bold text-slate-200 flex items-center gap-1"
          >
            <Wand2 className="w-3 h-3 text-accent-soft" />
            <span>Rewrite &amp; Improve Hook</span>
          </button>

          <button
            type="button"
            onClick={() => runAiAssistant('viral_hashtags')}
            disabled={aiLoading !== null}
            className="px-2.5 py-1 rounded-md bg-studio-subtle hover:bg-studio-hover border border-studio-borderStrong text-[10px] font-bold text-slate-200 flex items-center gap-1"
          >
            <Tag className="w-3 h-3 text-status-success" />
            <span>+15 Viral Hashtags &amp; YouTube SEO Tags</span>
          </button>

          <button
            type="button"
            onClick={() => runAiAssistant('first_comment')}
            disabled={aiLoading !== null}
            className="px-2.5 py-1 rounded-md bg-studio-subtle hover:bg-studio-hover border border-studio-borderStrong text-[10px] font-bold text-slate-200 flex items-center gap-1"
          >
            <MessageSquare className="w-3 h-3 text-amber-400" />
            <span>Generate Engaging First Comment</span>
          </button>

          {aiNotice && (
            <span className="text-[11px] font-bold text-status-success flex items-center gap-1 ml-auto">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{aiNotice}</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. MASTER GLOBAL CAPTION & GLOBAL AI CONTENT DISCLOSURE BAR */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-accent-soft" />
            <span>
              Global Master Caption &amp; Hashtags (Synced to All Selected Networks)
            </span>
          </label>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={shortenerEnabled}
                onChange={(e) => onToggleShortener(e.target.checked)}
                className="accent-accent rounded"
              />
              <Link2 className="w-3 h-3 text-status-success" />
              <span>Shorten URLs</span>
            </label>
            <span className="text-[11px] text-slate-400 font-mono">
              {globalCaption.length} chars
            </span>
          </div>
        </div>

        <textarea
          value={globalCaption}
          onChange={(e) => onGlobalCaptionChange(e.target.value)}
          placeholder="Write your master caption here or click 'Generate Full AI Pack' above..."
          rows={3}
          className="w-full p-3 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs placeholder:text-slate-500 focus:outline-none focus:border-[#00D2B4] focus:ring-1 focus:ring-[#00D2B4] resize-y"
        />

        {/* Global Cross-Platform AI Disclosure & Paid Promotion Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 p-2.5 rounded-xl bg-studio-subtle border border-studio-border">
          <label className="flex items-center gap-2 p-2 rounded-lg bg-studio-surface border border-amber-500/30 cursor-pointer text-xs font-bold text-amber-300">
            <input
              type="checkbox"
              checked={globalAiDisclosure}
              onChange={(e) => handleToggleGlobalAiDisclosure(e.target.checked)}
              className="accent-accent w-4 h-4"
            />
            <Cpu className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              Global &ldquo;Created with AI / Synthetic Media&rdquo; Label (All Platforms)
            </span>
          </label>

          <label className="flex items-center gap-2 p-2 rounded-lg bg-studio-surface border border-studio-border cursor-pointer text-xs font-bold text-status-success">
            <input
              type="checkbox"
              checked={globalPaidPromo}
              onChange={(e) => handleToggleGlobalPaidPromo(e.target.checked)}
              className="accent-status-success w-4 h-4"
            />
            <Shield className="w-4 h-4 text-status-success flex-shrink-0" />
            <span>Global Paid Promotion / Branded Content</span>
          </label>

          <div className="flex items-center gap-1.5 bg-studio-surface border border-studio-border rounded-lg px-2.5 py-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-status-success flex-shrink-0" />
            <input
              type="text"
              value={globalFirstComment}
              onChange={(e) => handleSyncGlobalFirstComment(e.target.value)}
              placeholder="Global First Comment (Syncs to all)..."
              className="w-full bg-transparent text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 3. ALWAYS-VISIBLE PER-PLATFORM SETTINGS SELECTOR BAR */}
      <div className="space-y-3 pt-2 border-t border-studio-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {(selectedPlatforms.length > 0
              ? selectedPlatforms
              : ALL_PLATFORMS
            ).map((plat) => {
              const cfg = PLATFORM_CONFIGS[plat];
              const isSelectedTab =
                !showAllStacked && activePlatformTab === plat;
              const hasAiFlag = Boolean(
                platformOverrides[plat]?.isAiGenerated ||
                  platformOverrides[plat]?.containsSyntheticMedia ||
                  platformOverrides[plat]?.isCreatedWithAi
              );

              return (
                <button
                  key={plat}
                  type="button"
                  onClick={() => {
                    setShowAllStacked(false);
                    setActivePlatformTab(plat);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 flex-shrink-0 border ${
                    isSelectedTab
                      ? 'bg-[#E6FAF7] text-[#00897B] border-[#00D2B4] shadow-sm font-bold'
                      : 'bg-white text-slate-600 hover:text-slate-900 border-slate-200 font-medium'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: cfg.color }}
                  />
                  <span>{cfg.name} Settings</span>
                  {hasAiFlag && (
                    <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-black">
                      AI
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setShowAllStacked(!showAllStacked)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold flex items-center gap-1.5 border flex-shrink-0 self-start sm:self-auto ${
              showAllStacked
                ? 'bg-status-success text-black border-[#00C49F]'
                : 'bg-studio-subtle text-status-success border-status-success/30 hover:bg-studio-hover'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>
              {showAllStacked
                ? 'Showing All Selected Platforms Stacked'
                : `Expand All (${selectedPlatforms.length}) Platform Settings`}
            </span>
          </button>
        </div>

        {/* Render Active Platform Settings Card (or All Selected Stacked!) */}
        <div className="space-y-4">
          {platformsToDisplay.map((plat) => renderPlatformSettingsCard(plat))}
        </div>
      </div>
    </div>
  );
}
