'use client';

import { useState, useEffect, useCallback } from 'react';
import { SocialPlatform, PlatformSpecificContent } from '@/lib/types';
import { cn, PLATFORM_CONFIGS, YOUTUBE_CATEGORIES } from '@/lib/utils';
import { PlatformBadge } from './ui';
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
  ChevronDown,
  ChevronUp,
  Plus,
  Check,
} from 'lucide-react';

interface YouTubePlaylistOption {
  id: string;
  title: string;
  description: string;
  itemCount: number;
  privacyStatus: string;
}

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

const INPUT_CLASS =
  'w-full h-11 px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#211832] focus:ring-2 focus:ring-[#211832]/10 transition-all shadow-2xs';

const SELECT_CLASS =
  'w-full h-11 px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-sm font-medium text-slate-900 focus:outline-none focus:border-[#211832] focus:ring-2 focus:ring-[#211832]/10 transition-all shadow-2xs cursor-pointer';

const TEXTAREA_CLASS =
  'w-full p-3.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#211832] focus:ring-2 focus:ring-[#211832]/10 transition-all shadow-2xs resize-y leading-relaxed';

const LABEL_CLASS =
  'block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5';

const CHECKBOX_CARD_CLASS =
  'flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 cursor-pointer transition-colors text-xs font-semibold text-slate-800';

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
  const [editByNetwork, setEditByNetwork] = useState<boolean>(false);
  const [activeNetworkTab, setActiveNetworkTab] = useState<SocialPlatform>(
    selectedPlatforms[0] || 'youtube'
  );

  // Open accordions state — YouTube & first selected platform open by default
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({
    global: false,
    youtube: true,
    instagram: true,
    facebook: false,
    tiktok: false,
    twitter: false,
    threads: false,
    linkedin: false,
    pinterest: false,
  });

  const [showAiStudio, setShowAiStudio] = useState<boolean>(true);
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

  // Live YouTube Playlists State
  const [ytPlaylists, setYtPlaylists] = useState<YouTubePlaylistOption[]>([]);
  const [ytPlaylistsLoading, setYtPlaylistsLoading] = useState<boolean>(false);
  const [ytPlaylistsError, setYtPlaylistsError] = useState<string | null>(null);
  const [customPlaylistMode, setCustomPlaylistMode] = useState<boolean>(false);
  const [showNewPlaylistModal, setShowNewPlaylistModal] =
    useState<boolean>(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState<string>('');
  const [newPlaylistPrivacy, setNewPlaylistPrivacy] = useState<
    'public' | 'unlisted' | 'private'
  >('public');
  const [creatingPlaylist, setCreatingPlaylist] = useState<boolean>(false);

  const fetchYouTubePlaylists = useCallback(async () => {
    setYtPlaylistsLoading(true);
    setYtPlaylistsError(null);
    try {
      const res = await fetch('/api/youtube/playlists', { cache: 'no-store' });
      const data = await res.json();
      if (data.success && Array.isArray(data.playlists)) {
        setYtPlaylists(data.playlists);
      } else {
        setYtPlaylistsError(
          data.error || 'Could not load playlists from YouTube.'
        );
      }
    } catch {
      setYtPlaylistsError('Network error while fetching YouTube playlists.');
    } finally {
      setYtPlaylistsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchYouTubePlaylists();
  }, [fetchYouTubePlaylists]);

  const handleCreatePlaylist = async () => {
    if (!newPlaylistTitle.trim()) return;
    setCreatingPlaylist(true);
    setYtPlaylistsError(null);
    try {
      const res = await fetch('/api/youtube/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newPlaylistTitle.trim(),
          privacyStatus: newPlaylistPrivacy,
        }),
      });
      const data = await res.json();
      if (data.success && data.playlist) {
        setYtPlaylists((prev) => [data.playlist, ...prev]);
        onUpdateOverride('youtube', { playlistId: data.playlist.id });
        setNewPlaylistTitle('');
        setShowNewPlaylistModal(false);
      } else {
        setYtPlaylistsError(data.error || 'Failed to create playlist.');
      }
    } catch {
      setYtPlaylistsError('Error creating YouTube playlist.');
    } finally {
      setCreatingPlaylist(false);
    }
  };

  const toggleAccordion = (key: string) => {
    setOpenAccordions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAllAccordions = (expand: boolean) => {
    const next: Record<string, boolean> = { global: expand };
    ALL_PLATFORMS.forEach((p) => {
      next[p] = expand;
    });
    setOpenAccordions(next);
  };

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

  const activePlatformsList: SocialPlatform[] =
    selectedPlatforms.length > 0
      ? selectedPlatforms
      : ['youtube', 'instagram', 'facebook'];

  const currentEditPlatform = activePlatformsList.includes(activeNetworkTab)
    ? activeNetworkTab
    : activePlatformsList[0];

  const currentEditConfig = PLATFORM_CONFIGS[currentEditPlatform];
  const currentEditOverride: Partial<PlatformSpecificContent> =
    platformOverrides[currentEditPlatform] || {};
  const displayedCaption = editByNetwork
    ? currentEditOverride.caption ?? globalCaption
    : globalCaption;

  const primaryTitlePlatform = selectedPlatforms.includes('youtube')
    ? 'youtube'
    : selectedPlatforms.find((p) => PLATFORM_CONFIGS[p].fields.hasTitle) ||
      'youtube';

  const primaryTitleValue = platformOverrides[primaryTitlePlatform]?.title || '';

  const handlePrimaryTitleChange = (val: string) => {
    // Sync title to YouTube and any selected title-enabled platform that doesn't have a custom title yet
    onUpdateOverride(primaryTitlePlatform, { title: val });
    selectedPlatforms.forEach((p) => {
      if (
        p !== primaryTitlePlatform &&
        PLATFORM_CONFIGS[p].fields.hasTitle &&
        !platformOverrides[p]?.title
      ) {
        onUpdateOverride(p, { title: val });
      }
    });
  };

  const renderPlatformPresetAccordion = (plat: SocialPlatform) => {
    const cfg = PLATFORM_CONFIGS[plat];
    const override: PlatformSpecificContent = platformOverrides[plat] || {
      caption: globalCaption,
    };
    const isOpen = Boolean(openAccordions[plat]);
    const isAiChecked = Boolean(
      override.isAiGenerated ||
        override.containsSyntheticMedia ||
        override.isCreatedWithAi
    );
    const isPaidChecked = Boolean(
      override.paidPromotion || override.commercialContent
    );
    const tagsDisplay =
      tagsInputMap[plat] ?? (override.tags ? override.tags.join(', ') : '');

    return (
      <div
        key={plat}
        className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden transition-all"
      >
        {/* Metricool-style Accordion Header Bar */}
        <button
          type="button"
          onClick={() => toggleAccordion(plat)}
          className="w-full min-h-[56px] px-5 py-3.5 flex items-center justify-between gap-3 bg-white hover:bg-slate-50/80 transition-colors text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <PlatformBadge platform={plat} size="sm" />
            <div>
              <span className="text-sm font-bold text-slate-900">
                {cfg.name.replace(' (Twitter)', '')} presets
              </span>
              <span className="hidden sm:inline-block ml-2.5 text-xs text-slate-500">
                •{' '}
                {plat === 'youtube'
                  ? `${(override.postType || 'short').toUpperCase()} • ${
                      override.privacy || 'public'
                    }${
                      override.playlistId
                        ? ` • Playlist linked`
                        : ''
                    }`
                  : plat === 'instagram'
                  ? `${(override.postType || 'reel').toUpperCase()}`
                  : plat === 'facebook'
                  ? `${(override.postType || 'reel').toUpperCase()}`
                  : `${(override.caption ?? globalCaption).length}/${
                      cfg.charLimit
                    } chars`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {isAiChecked && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-[11px] font-bold">
                AI Label
              </span>
            )}
            {isPaidChecked && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-900 text-[11px] font-bold">
                Paid Promo
              </span>
            )}
            <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              {isOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </span>
          </div>
        </button>

        {/* Accordion Body */}
        {isOpen && (
          <div className="p-5 pt-4 border-t border-slate-200 space-y-5 bg-white">
            {/* Title Input for platforms that support Titles */}
            {cfg.fields.hasTitle && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-slate-600" />
                    <span>
                      {plat === 'youtube'
                        ? 'Video / Short Title (Required • Max 100 chars)'
                        : `${cfg.name} Post Title`}
                    </span>
                  </label>
                  <span className="text-xs font-mono font-semibold text-slate-500">
                    {override.title?.length || 0} / 100
                  </span>
                </div>
                <input
                  type="text"
                  value={override.title || ''}
                  onChange={(e) =>
                    onUpdateOverride(plat, { title: e.target.value })
                  }
                  placeholder={`Enter ${cfg.name} title...`}
                  maxLength={100}
                  className={INPUT_CLASS}
                />
              </div>
            )}

            {/* Custom Network Caption / Description */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">
                  {plat === 'youtube'
                    ? 'YouTube Video Description & Hashtags'
                    : `${cfg.name} Caption & Hashtags`}
                </label>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-mono font-semibold text-slate-500">
                    {(override.caption ?? globalCaption).length} / {cfg.charLimit}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateOverride(plat, { caption: globalCaption })
                    }
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-bold text-slate-700 transition-colors"
                  >
                    Reset to Global Text
                  </button>
                </div>
              </div>
              <textarea
                value={override.caption ?? globalCaption}
                onChange={(e) =>
                  onUpdateOverride(plat, { caption: e.target.value })
                }
                rows={3}
                placeholder={`Write custom description/caption for ${cfg.name}...`}
                className={TEXTAREA_CLASS}
              />
            </div>

            {/* YOUTUBE SPECIFIC PRESETS (WITH LIVE PLAYLIST SELECTOR!) */}
            {plat === 'youtube' && (
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <p className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-red-600" />
                    <span>YouTube Studio &amp; Playlist Configuration</span>
                  </p>
                </div>

                {/* Row 1: Format, Privacy, Category */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={LABEL_CLASS}>Format Type</label>
                    <select
                      value={override.postType || 'short'}
                      onChange={(e) =>
                        onUpdateOverride('youtube', {
                          postType: e.target.value as 'short' | 'video',
                          isShortOrReel: e.target.value === 'short',
                        })
                      }
                      className={SELECT_CLASS}
                    >
                      <option value="short">YouTube Short (9:16 Vertical)</option>
                      <option value="video">Standard Video (16:9)</option>
                    </select>
                  </div>

                  <div>
                    <label className={LABEL_CLASS}>Privacy Visibility</label>
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
                      className={SELECT_CLASS}
                    >
                      <option value="public">Public</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="private">Private</option>
                    </select>
                  </div>

                  <div>
                    <label className={LABEL_CLASS}>YouTube Category</label>
                    <select
                      value={override.categoryId || '28'}
                      onChange={(e) =>
                        onUpdateOverride('youtube', {
                          categoryId: e.target.value,
                        })
                      }
                      className={SELECT_CLASS}
                    >
                      {YOUTUBE_CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 2: Audience, License, Language */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={LABEL_CLASS}>
                      Audience (Made for Kids)
                    </label>
                    <select
                      value={override.madeForKids ? 'yes' : 'no'}
                      onChange={(e) =>
                        onUpdateOverride('youtube', {
                          madeForKids: e.target.value === 'yes',
                        })
                      }
                      className={SELECT_CLASS}
                    >
                      <option value="no">No, not made for kids</option>
                      <option value="yes">Yes, made for kids</option>
                    </select>
                  </div>

                  <div>
                    <label className={LABEL_CLASS}>Video License</label>
                    <select
                      value={override.license || 'youtube'}
                      onChange={(e) =>
                        onUpdateOverride('youtube', {
                          license: e.target.value as
                            | 'youtube'
                            | 'creativeCommon',
                        })
                      }
                      className={SELECT_CLASS}
                    >
                      <option value="youtube">Standard YouTube License</option>
                      <option value="creativeCommon">
                        Creative Commons - Attribution
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className={LABEL_CLASS}>
                      <Globe className="w-3.5 h-3.5 text-slate-600" />
                      <span>Audio &amp; Title Language</span>
                    </label>
                    <select
                      value={override.defaultLanguage || 'en'}
                      onChange={(e) =>
                        onUpdateOverride('youtube', {
                          defaultLanguage: e.target.value,
                        })
                      }
                      className={SELECT_CLASS}
                    >
                      <option value="en">English (en)</option>
                      <option value="ur">Urdu / Roman Urdu (ur)</option>
                      <option value="hi">Hindi / Hinglish (hi)</option>
                    </select>
                  </div>
                </div>

                {/* Row 3: LIVE YOUTUBE PLAYLIST SELECTOR + TAGS */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Live YouTube Playlist Box */}
                  <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 shadow-2xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <ListPlus className="w-4 h-4 text-red-600" />
                        <span>Add Video to YouTube Playlist</span>
                      </label>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={fetchYouTubePlaylists}
                          disabled={ytPlaylistsLoading}
                          className="h-7 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[11px] font-bold text-slate-700 inline-flex items-center gap-1 transition-colors"
                          title="Refresh playlists from your YouTube channel"
                        >
                          <RefreshCw
                            className={cn(
                              'w-3 h-3',
                              ytPlaylistsLoading && 'animate-spin'
                            )}
                          />
                          <span>Refresh</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setShowNewPlaylistModal(!showNewPlaylistModal)
                          }
                          className="h-7 px-2.5 rounded-lg bg-[#211832] hover:bg-[#2d2144] text-white text-[11px] font-bold inline-flex items-center gap-1 transition-colors"
                        >
                          <Plus className="w-3 h-3 text-[#D8FF36]" />
                          <span>New Playlist</span>
                        </button>
                      </div>
                    </div>

                    {!customPlaylistMode ? (
                      <div className="space-y-2">
                        <select
                          value={override.playlistId || ''}
                          onChange={(e) => {
                            if (e.target.value === '__custom__') {
                              setCustomPlaylistMode(true);
                            } else {
                              onUpdateOverride('youtube', {
                                playlistId: e.target.value,
                              });
                            }
                          }}
                          className={SELECT_CLASS}
                        >
                          <option value="">
                            -- Select a YouTube Playlist (None) --
                          </option>
                          {ytPlaylists.map((pl) => (
                            <option key={pl.id} value={pl.id}>
                              {pl.title} ({pl.itemCount} videos •{' '}
                              {pl.privacyStatus})
                            </option>
                          ))}
                          <option value="__custom__">
                            + Enter custom Playlist ID manually...
                          </option>
                        </select>

                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>
                            {ytPlaylistsLoading
                              ? 'Loading playlists from ZCodeDev channel...'
                              : ytPlaylists.length > 0
                              ? `${ytPlaylists.length} playlists fetched from your YouTube channel`
                              : ytPlaylistsError || 'No playlists found'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setCustomPlaylistMode(true)}
                            className="font-semibold text-slate-700 hover:underline"
                          >
                            Enter ID manually
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={override.playlistId || ''}
                            onChange={(e) =>
                              onUpdateOverride('youtube', {
                                playlistId: e.target.value,
                              })
                            }
                            placeholder="Paste Playlist ID (e.g. PLxxxxxxxxxxxxxxxx)"
                            className={cn(INPUT_CLASS, 'font-mono')}
                          />
                          <button
                            type="button"
                            onClick={() => setCustomPlaylistMode(false)}
                            className="h-11 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-bold text-slate-700 whitespace-nowrap"
                          >
                            Use Dropdown
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Inline Create New YouTube Playlist Drawer */}
                    {showNewPlaylistModal && (
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-300 space-y-3">
                        <p className="text-xs font-bold text-slate-800">
                          Create a New Playlist on YouTube
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div className="sm:col-span-2">
                            <input
                              type="text"
                              value={newPlaylistTitle}
                              onChange={(e) =>
                                setNewPlaylistTitle(e.target.value)
                              }
                              placeholder="New playlist title (e.g. AI Shorts 2026)"
                              className={INPUT_CLASS}
                            />
                          </div>
                          <div>
                            <select
                              value={newPlaylistPrivacy}
                              onChange={(e) =>
                                setNewPlaylistPrivacy(
                                  e.target.value as
                                    | 'public'
                                    | 'unlisted'
                                    | 'private'
                                )
                              }
                              className={SELECT_CLASS}
                            >
                              <option value="public">Public</option>
                              <option value="unlisted">Unlisted</option>
                              <option value="private">Private</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShowNewPlaylistModal(false)}
                            className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={
                              creatingPlaylist || !newPlaylistTitle.trim()
                            }
                            onClick={handleCreatePlaylist}
                            className="h-9 px-3.5 rounded-lg bg-[#211832] text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {creatingPlaylist ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-[#D8FF36]" />
                            )}
                            <span>Create &amp; Select</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* YouTube Search Tags Box */}
                  <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 shadow-2xs">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Tag className="w-4 h-4 text-emerald-600" />
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
                      className={INPUT_CLASS}
                    />
                    <p className="text-[11px] text-slate-500">
                      Separate tags with commas. Tip: Use the AI Hashtag &amp; SEO button above to auto-fill 25 high-ranking tags.
                    </p>
                  </div>
                </div>

                {/* Row 4: YouTube Checkboxes */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-slate-200 cursor-pointer text-xs font-bold text-slate-800 shadow-2xs">
                    <input
                      type="checkbox"
                      checked={override.embeddable !== false}
                      onChange={(e) =>
                        onUpdateOverride('youtube', {
                          embeddable: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded accent-[#211832]"
                    />
                    <span>Allow Video Embedding</span>
                  </label>

                  <label className="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-slate-200 cursor-pointer text-xs font-bold text-slate-800 shadow-2xs">
                    <input
                      type="checkbox"
                      checked={override.notifySubscribers !== false}
                      onChange={(e) =>
                        onUpdateOverride('youtube', {
                          notifySubscribers: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded accent-[#211832]"
                    />
                    <span>Notify Channel Subscribers</span>
                  </label>

                  <label className="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-slate-200 cursor-pointer text-xs font-bold text-slate-800 shadow-2xs">
                    <input
                      type="checkbox"
                      checked={override.publicStatsViewable !== false}
                      onChange={(e) =>
                        onUpdateOverride('youtube', {
                          publicStatsViewable: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded accent-[#211832]"
                    />
                    <span>Show Like Count Publicly</span>
                  </label>
                </div>
              </div>
            )}

            {/* INSTAGRAM SPECIFIC PRESETS */}
            {plat === 'instagram' && (
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-3">
                  <Sliders className="w-4 h-4 text-pink-600" />
                  <span>Instagram Graph API v22.0 Reels &amp; Feed Options</span>
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={LABEL_CLASS}>Publication Format</label>
                    <select
                      value={override.postType || 'reel'}
                      onChange={(e) =>
                        onUpdateOverride('instagram', {
                          postType: e.target.value as 'reel' | 'post' | 'story',
                          isShortOrReel: e.target.value === 'reel',
                        })
                      }
                      className={SELECT_CLASS}
                    >
                      <option value="reel">Instagram Reel (9:16)</option>
                      <option value="post">Feed Video Post</option>
                      <option value="story">Instagram Story</option>
                    </select>
                  </div>

                  <div>
                    <label className={LABEL_CLASS}>
                      <Users className="w-3.5 h-3.5 text-pink-600" />
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
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label className={LABEL_CLASS}>
                      <Music className="w-3.5 h-3.5 text-slate-600" />
                      <span>Original Audio Rename</span>
                    </label>
                    <input
                      type="text"
                      value={override.audioName || ''}
                      onChange={(e) =>
                        onUpdateOverride('instagram', {
                          audioName: e.target.value,
                        })
                      }
                      placeholder="Original Audio - ZCodeDev"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label className={LABEL_CLASS}>
                      <Users className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Tag Users in Video (@usernames)</span>
                    </label>
                    <input
                      type="text"
                      value={override.userTags || ''}
                      onChange={(e) =>
                        onUpdateOverride('instagram', {
                          userTags: e.target.value,
                        })
                      }
                      placeholder="@username1, @username2"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label className={LABEL_CLASS}>
                      <MapPin className="w-3.5 h-3.5 text-amber-600" />
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
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label className={LABEL_CLASS}>
                      Accessibility Alt Text
                    </label>
                    <input
                      type="text"
                      value={override.altText || ''}
                      onChange={(e) =>
                        onUpdateOverride('instagram', {
                          altText: e.target.value,
                        })
                      }
                      placeholder="Describe video for screen readers..."
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-slate-200 cursor-pointer text-xs font-bold text-slate-800 shadow-2xs">
                    <input
                      type="checkbox"
                      checked={override.shareToFeed !== false}
                      onChange={(e) =>
                        onUpdateOverride('instagram', {
                          shareToFeed: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded accent-[#211832]"
                    />
                    <span>
                      Also Share Reel to Main Profile Grid (share_to_feed)
                    </span>
                  </label>

                  <label className="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-slate-200 cursor-pointer text-xs font-bold text-slate-800 shadow-2xs">
                    <input
                      type="checkbox"
                      checked={Boolean(override.disableComments)}
                      onChange={(e) =>
                        onUpdateOverride('instagram', {
                          disableComments: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded accent-[#211832]"
                    />
                    <span>Turn Off Comments on This Reel</span>
                  </label>
                </div>
              </div>
            )}

            {/* FACEBOOK SPECIFIC PRESETS */}
            {plat === 'facebook' && (
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-3">
                  <Sliders className="w-4 h-4 text-blue-600" />
                  <span>Facebook Page Graph API v22.0 Reels &amp; Video Options</span>
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={LABEL_CLASS}>
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
                      className={SELECT_CLASS}
                    >
                      <option value="reel">Facebook Page Reel (9:16)</option>
                      <option value="video">Facebook Page Standard Video</option>
                    </select>
                  </div>

                  <div>
                    <label className={LABEL_CLASS}>
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
                      className={SELECT_CLASS}
                    >
                      <option value="NONE">No CTA Button</option>
                      <option value="LEARN_MORE">Learn More</option>
                      <option value="WATCH_MORE">Watch More</option>
                      <option value="SIGN_UP">Sign Up</option>
                      <option value="SHOP_NOW">Shop Now</option>
                    </select>
                  </div>

                  <div>
                    <label className={LABEL_CLASS}>
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
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-slate-200 cursor-pointer text-xs font-bold text-slate-800 shadow-2xs">
                    <input
                      type="checkbox"
                      checked={override.shareToFeed !== false}
                      onChange={(e) =>
                        onUpdateOverride('facebook', {
                          shareToFeed: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded accent-[#211832]"
                    />
                    <span>Share Reel to Page Feed Timeline</span>
                  </label>

                  <label className="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-slate-200 cursor-pointer text-xs font-bold text-slate-800 shadow-2xs">
                    <input
                      type="checkbox"
                      checked={override.embeddable !== false}
                      onChange={(e) =>
                        onUpdateOverride('facebook', {
                          embeddable: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded accent-[#211832]"
                    />
                    <span>Allow Video Embedding</span>
                  </label>

                  <label className="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-slate-200 cursor-pointer text-xs font-bold text-slate-800 shadow-2xs">
                    <input
                      type="checkbox"
                      checked={Boolean(override.secret)}
                      onChange={(e) =>
                        onUpdateOverride('facebook', {
                          secret: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded accent-[#211832]"
                    />
                    <span>Publish as Unlisted / Secret Video</span>
                  </label>
                </div>
              </div>
            )}

            {/* TIKTOK SPECIFIC PRESETS */}
            {plat === 'tiktok' && (
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-3">
                  <Sliders className="w-4 h-4 text-slate-900" />
                  <span>TikTok Direct Post API v2 Creator Settings</span>
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL_CLASS}>
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
                      className={SELECT_CLASS}
                    >
                      <option value="public">Public to Everyone</option>
                      <option value="friends">
                        Friends (Mutual Followers)
                      </option>
                      <option value="private">Private (Only Me)</option>
                    </select>
                  </div>

                  <div>
                    <label className={LABEL_CLASS}>
                      Interaction Permissions
                    </label>
                    <div className="grid grid-cols-3 gap-2.5">
                      <label className="flex items-center gap-2 h-11 px-3 rounded-xl bg-white border border-slate-300 cursor-pointer text-xs font-bold text-slate-800">
                        <input
                          type="checkbox"
                          checked={override.allowComments !== false}
                          onChange={(e) =>
                            onUpdateOverride('tiktok', {
                              allowComments: e.target.checked,
                            })
                          }
                          className="w-4 h-4 rounded accent-[#211832]"
                        />
                        <span>Comments</span>
                      </label>

                      <label className="flex items-center gap-2 h-11 px-3 rounded-xl bg-white border border-slate-300 cursor-pointer text-xs font-bold text-slate-800">
                        <input
                          type="checkbox"
                          checked={override.allowDuet !== false}
                          onChange={(e) =>
                            onUpdateOverride('tiktok', {
                              allowDuet: e.target.checked,
                            })
                          }
                          className="w-4 h-4 rounded accent-[#211832]"
                        />
                        <span>Duet</span>
                      </label>

                      <label className="flex items-center gap-2 h-11 px-3 rounded-xl bg-white border border-slate-300 cursor-pointer text-xs font-bold text-slate-800">
                        <input
                          type="checkbox"
                          checked={override.allowStitch !== false}
                          onChange={(e) =>
                            onUpdateOverride('tiktok', {
                              allowStitch: e.target.checked,
                            })
                          }
                          className="w-4 h-4 rounded accent-[#211832]"
                        />
                        <span>Stitch</span>
                      </label>
                    </div>
                  </div>
                </div>

                {override.commercialContent && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-white border border-slate-200">
                    <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-800">
                      <input
                        type="checkbox"
                        checked={override.commercialYourBrand !== false}
                        onChange={(e) =>
                          onUpdateOverride('tiktok', {
                            commercialYourBrand: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded accent-[#211832]"
                      />
                      <span>Your Brand (Promoting your own business)</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-800">
                      <input
                        type="checkbox"
                        checked={Boolean(override.commercialBrandedContent)}
                        onChange={(e) =>
                          onUpdateOverride('tiktok', {
                            commercialBrandedContent: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded accent-[#211832]"
                      />
                      <span>Branded Content (Third-party paid partnership)</span>
                    </label>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-slate-200 cursor-pointer text-xs font-bold text-slate-800 shadow-2xs">
                    <input
                      type="checkbox"
                      checked={Boolean(override.autoAddMusic)}
                      onChange={(e) =>
                        onUpdateOverride('tiktok', {
                          autoAddMusic: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded accent-[#211832]"
                    />
                    <span>Auto-Sync Trending Sound (auto_add_music)</span>
                  </label>

                  <label className="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-slate-200 cursor-pointer text-xs font-bold text-slate-800 shadow-2xs">
                    <input
                      type="checkbox"
                      checked={override.highQualityUpload !== false}
                      onChange={(e) =>
                        onUpdateOverride('tiktok', {
                          highQualityUpload: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded accent-[#211832]"
                    />
                    <span>Allow 1080p High-Quality Upload</span>
                  </label>
                </div>
              </div>
            )}

            {/* X (TWITTER) SPECIFIC PRESETS */}
            {plat === 'twitter' && (
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLASS}>
                    Who Can Reply on X (reply_settings)
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
                    className={SELECT_CLASS}
                  >
                    <option value="everyone">Everyone</option>
                    <option value="following">Accounts You Follow</option>
                    <option value="mentionedUsers">Only Mentioned Users</option>
                    <option value="subscribers">
                      Verified Subscribers Only
                    </option>
                  </select>
                </div>

                <div className="flex items-end">
                  <label className="w-full h-11 px-4 rounded-xl bg-white border border-slate-300 flex items-center gap-3 cursor-pointer text-xs font-bold text-slate-800 shadow-2xs">
                    <input
                      type="checkbox"
                      checked={Boolean(override.sensitiveContent)}
                      onChange={(e) =>
                        onUpdateOverride('twitter', {
                          sensitiveContent: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded accent-[#211832]"
                    />
                    <span>Mark Media as Sensitive Content Warning</span>
                  </label>
                </div>
              </div>
            )}

            {/* LINKEDIN SPECIFIC PRESETS */}
            {plat === 'linkedin' && (
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLASS}>
                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                    <span>LinkedIn Network Visibility</span>
                  </label>
                  <select
                    value={override.privacy || 'public'}
                    onChange={(e) =>
                      onUpdateOverride('linkedin', {
                        privacy: e.target.value as 'public' | 'private',
                      })
                    }
                    className={SELECT_CLASS}
                  >
                    <option value="public">
                      Public (Anyone on or off LinkedIn)
                    </option>
                    <option value="private">Connections Only</option>
                  </select>
                </div>

                <div>
                  <label className={LABEL_CLASS}>
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
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
            )}

            {/* THREADS SPECIFIC PRESETS */}
            {plat === 'threads' && (
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLASS}>
                    Who Can Reply on Threads (reply_control)
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
                    className={SELECT_CLASS}
                  >
                    <option value="everyone">Everyone</option>
                    <option value="accounts_you_follow">
                      Profiles You Follow
                    </option>
                    <option value="mentioned_only">Mentioned Only</option>
                  </select>
                </div>

                <div>
                  <label className={LABEL_CLASS}>
                    <Hash className="w-3.5 h-3.5 text-slate-700" />
                    <span>Threads Topic Tag</span>
                  </label>
                  <input
                    type="text"
                    value={override.topicTag || ''}
                    onChange={(e) =>
                      onUpdateOverride('threads', {
                        topicTag: e.target.value,
                      })
                    }
                    placeholder="Coding & AI"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
            )}

            {/* PINTEREST SPECIFIC PRESETS */}
            {plat === 'pinterest' && (
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={LABEL_CLASS}>
                    Pinterest Board ID / Name
                  </label>
                  <input
                    type="text"
                    value={override.boardId || ''}
                    onChange={(e) =>
                      onUpdateOverride('pinterest', {
                        boardId: e.target.value,
                      })
                    }
                    placeholder="Board ID (e.g. 9823749234)"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Destination Link URL</label>
                  <input
                    type="url"
                    value={override.destinationLink || ''}
                    onChange={(e) =>
                      onUpdateOverride('pinterest', {
                        destinationLink: e.target.value,
                      })
                    }
                    placeholder="https://youtube.com/@zcodedev"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Pin Alt Text (SEO)</label>
                  <input
                    type="text"
                    value={override.altText || ''}
                    onChange={(e) =>
                      onUpdateOverride('pinterest', {
                        altText: e.target.value,
                      })
                    }
                    placeholder="Describe Pin video..."
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
            )}

            {/* First Comment Input */}
            {cfg.fields.hasFirstComment && (
              <div>
                <label className={LABEL_CLASS}>
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
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
                  className={INPUT_CLASS}
                />
              </div>
            )}

            {/* Universal AI Content Disclosure & Paid Promotion Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <label className={CHECKBOX_CARD_CLASS}>
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
                  className="mt-0.5 w-4 h-4 rounded accent-[#211832]"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <Cpu className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>
                      {plat === 'youtube'
                        ? 'Altered / Synthetic Content (AI Label)'
                        : plat === 'instagram' || plat === 'facebook'
                        ? 'Meta "Created with AI" Transparency Label'
                        : plat === 'tiktok'
                        ? 'TikTok AI-Generated Content (AIGC) Label'
                        : `${cfg.name} AI-Generated Content Disclosure`}
                    </span>
                  </div>
                  <p className="text-[11px] font-normal text-slate-500 leading-snug">
                    {plat === 'youtube'
                      ? 'Sends status.containsSyntheticMedia=true to YouTube Data API v3.'
                      : plat === 'instagram' || plat === 'facebook'
                      ? 'Sends is_created_with_ai=true to Meta Graph API v22.0.'
                      : plat === 'tiktok'
                      ? 'Sends is_aigc=true to TikTok Direct Post API v2.'
                      : `Marks this ${cfg.name} post with official AI transparency metadata.`}
                  </p>
                </div>
              </label>

              <label className={CHECKBOX_CARD_CLASS}>
                <input
                  type="checkbox"
                  checked={isPaidChecked}
                  onChange={(e) =>
                    onUpdateOverride(plat, {
                      paidPromotion: e.target.checked,
                      commercialContent: e.target.checked,
                    })
                  }
                  className="mt-0.5 w-4 h-4 rounded accent-[#211832]"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <Shield className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>Paid Promotion / Branded Content Disclosure</span>
                  </div>
                  <p className="text-[11px] font-normal text-slate-500 leading-snug">
                    Discloses sponsorship, brand partnership, or commercial product placement on {cfg.name}.
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* 1. METRICOOL MASTER COMPOSER CARD (Title + Caption + Bottom Action Toolbar + Edit By Network) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        {/* Top Mode Bar: Global vs Edit by Network (Metricool signature dark eggplant pill) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">
              Post Title, Caption &amp; Content Editor
            </h2>
            {editByNetwork && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold">
                Editing {currentEditConfig.name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditByNetwork(!editByNetwork)}
              className={cn(
                'h-9 px-3.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-all shadow-2xs',
                editByNetwork
                  ? 'bg-[#211832] text-[#D8FF36] border border-[#211832]'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
              )}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>EDIT BY NETWORK</span>
            </button>
          </div>
        </div>

        {/* Network Switcher Bar when "EDIT BY NETWORK" is active */}
        {editByNetwork && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {activePlatformsList.map((plat) => {
              const pCfg = PLATFORM_CONFIGS[plat];
              const isAct = currentEditPlatform === plat;
              return (
                <button
                  key={plat}
                  type="button"
                  onClick={() => setActiveNetworkTab(plat)}
                  className={cn(
                    'h-9 px-3.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all flex-shrink-0',
                    isAct
                      ? 'bg-[#211832] text-white border-[#211832] shadow-xs'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                  )}
                >
                  <PlatformBadge platform={plat} size="xs" />
                  <span>{pCfg.name.replace(' (Twitter)', '')}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Prominent Video / Short Title Box right inside main composer */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-red-600" />
              <span>
                Video / Short Title (YouTube &amp; Title-Enabled Networks)
              </span>
            </label>
            <span className="text-xs font-mono font-semibold text-slate-500">
              {primaryTitleValue.length} / 100
            </span>
          </div>
          <input
            type="text"
            value={primaryTitleValue}
            onChange={(e) => handlePrimaryTitleChange(e.target.value)}
            placeholder="Enter a clear, catchy title for your video or YouTube Short..."
            maxLength={100}
            className={INPUT_CLASS}
          />
        </div>

        {/* Main Metricool Textarea Container with Integrated Bottom Toolbar */}
        <div className="rounded-2xl border border-slate-300 bg-white overflow-hidden focus-within:border-[#211832] focus-within:ring-2 focus-within:ring-[#211832]/10 transition-all">
          <div className="px-4 pt-3 pb-1 flex items-center justify-between border-b border-slate-100 bg-slate-50/60">
            <span className="text-xs font-bold text-slate-700">
              {editByNetwork
                ? `${currentEditConfig.name} Custom Caption / Description`
                : 'Global Master Caption & Hashtags (Synced to All Networks)'}
            </span>
            <span className="text-[11px] font-medium text-slate-500">
              {editByNetwork
                ? `Applies to ${currentEditConfig.name}`
                : `Syncs across ${selectedPlatforms.length} selected networks`}
            </span>
          </div>

          <textarea
            value={displayedCaption}
            onChange={(e) => {
              if (editByNetwork) {
                onUpdateOverride(currentEditPlatform, {
                  caption: e.target.value,
                });
              } else {
                onGlobalCaptionChange(e.target.value);
              }
            }}
            placeholder="Write your caption, description, links, and #hashtags here..."
            rows={5}
            className="w-full p-4 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none resize-y leading-relaxed"
          />

          {/* Metricool Integrated Bottom Toolbar inside Editor Box */}
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAiStudio(!showAiStudio)}
                className={cn(
                  'h-9 px-3 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition-colors',
                  showAiStudio
                    ? 'bg-[#211832] text-[#D8FF36] border-[#211832]'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                )}
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>AI Studio</span>
              </button>

              <button
                type="button"
                onClick={() => onToggleShortener(!shortenerEnabled)}
                className={cn(
                  'h-9 px-3 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition-colors',
                  shortenerEnabled
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-300'
                )}
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>URL Shortener: {shortenerEnabled ? 'ON' : 'OFF'}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleToggleGlobalAiDisclosure(!globalAiDisclosure)
                }
                className={cn(
                  'h-9 px-3 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition-colors',
                  globalAiDisclosure
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-300'
                )}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>AI Label: {globalAiDisclosure ? 'ON' : 'OFF'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleGlobalPaidPromo(!globalPaidPromo)}
                className={cn(
                  'h-9 px-3 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition-colors',
                  globalPaidPromo
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-300'
                )}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Paid Promo: {globalPaidPromo ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            {/* Character Counter Pill */}
            <div className="flex items-center gap-2">
              <PlatformBadge platform={currentEditPlatform} size="xs" />
              <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-mono font-bold text-slate-700">
                {displayedCaption.length} / {currentEditConfig.charLimit}
              </span>
            </div>
          </div>
        </div>

        {/* Built-in AI Content, Title, Hashtag & SEO Generator Panel */}
        {showAiStudio && (
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-[#211832] text-[#D8FF36] flex items-center justify-center flex-shrink-0">
                  <Wand2 className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>AI Title, Caption, Hashtag &amp; SEO Generator</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
                      Live
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Auto-generates titles, descriptions, viral hashtags, YouTube SEO tags &amp; first comments for all selected networks
                  </p>
                </div>
              </div>

              <div className="w-full sm:w-64">
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
                  className={SELECT_CLASS}
                >
                  <option value="viral">Tone: Viral Hook &amp; Retention</option>
                  <option value="coding">Tone: Coding &amp; Tech Breakdown</option>
                  <option value="hinglish">
                    Tone: Roman Urdu / Hinglish + English
                  </option>
                  <option value="educational">
                    Tone: Step-by-Step Educational
                  </option>
                  <option value="storytelling">
                    Tone: Developer Storytelling
                  </option>
                  <option value="professional">
                    Tone: Professional / Executive
                  </option>
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder={
                  videoFileName
                    ? `Video topic (default: "${videoFileName}") — e.g. Python AI Agent Tutorial in 60s...`
                    : 'Type your video topic or idea (e.g. Build an AI Agent with Python & Next.js)...'
                }
                className={cn(INPUT_CLASS, 'flex-1')}
              />

              <button
                type="button"
                onClick={() => runAiAssistant('full_pack')}
                disabled={aiLoading !== null}
                className="h-11 px-5 rounded-xl bg-[#211832] hover:bg-[#2d2144] transition-colors text-[#D8FF36] text-xs font-bold flex items-center justify-center gap-2 shadow-xs flex-shrink-0"
              >
                {aiLoading === 'full_pack' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>Generate Full AI Pack</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => runAiAssistant('improve_caption')}
                disabled={aiLoading !== null}
                className="h-9 px-3.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-xs font-bold text-slate-800 inline-flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <Wand2 className="w-3.5 h-3.5 text-slate-700" />
                <span>Rewrite &amp; Improve Hook</span>
              </button>

              <button
                type="button"
                onClick={() => runAiAssistant('viral_hashtags')}
                disabled={aiLoading !== null}
                className="h-9 px-3.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-xs font-bold text-slate-800 inline-flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <Tag className="w-3.5 h-3.5 text-emerald-600" />
                <span>+15 Viral Hashtags &amp; YouTube Tags</span>
              </button>

              <button
                type="button"
                onClick={() => runAiAssistant('first_comment')}
                disabled={aiLoading !== null}
                className="h-9 px-3.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-xs font-bold text-slate-800 inline-flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                <span>Generate Engaging First Comment</span>
              </button>

              {aiNotice && (
                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 ml-auto bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{aiNotice}</span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. METRICOOL-STYLE PRESET ACCORDIONS (Global Presets + Per-Network Presets) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Network Presets &amp; Advanced Settings
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => expandAllAccordions(true)}
              className="text-xs font-bold text-slate-700 hover:text-slate-900 underline"
            >
              Expand All
            </button>
            <span className="text-slate-300">•</span>
            <button
              type="button"
              onClick={() => expandAllAccordions(false)}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 underline"
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* Global Presets Accordion */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <button
            type="button"
            onClick={() => toggleAccordion('global')}
            className="w-full min-h-[56px] px-5 py-3.5 flex items-center justify-between gap-3 bg-white hover:bg-slate-50/80 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs font-bold">
                G
              </span>
              <div>
                <span className="text-sm font-bold text-slate-900">
                  Global presets
                </span>
                <span className="hidden sm:inline-block ml-2.5 text-xs text-slate-500">
                  • First comment sync, URL shortener &amp; cross-network compliance
                </span>
              </div>
            </div>
            <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              {openAccordions.global ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </span>
          </button>

          {openAccordions.global && (
            <div className="p-5 pt-4 border-t border-slate-200 space-y-4 bg-white">
              <div>
                <label className={LABEL_CLASS}>
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  <span>
                    Global First Comment (Syncs to All Selected Networks)
                  </span>
                </label>
                <input
                  type="text"
                  value={globalFirstComment}
                  onChange={(e) => handleSyncGlobalFirstComment(e.target.value)}
                  placeholder="Write a first comment to automatically post across all selected networks..."
                  className={INPUT_CLASS}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className={CHECKBOX_CARD_CLASS}>
                  <input
                    type="checkbox"
                    checked={shortenerEnabled}
                    onChange={(e) => onToggleShortener(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded accent-[#211832]"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      Auto-Shorten URLs in Captions
                    </p>
                    <p className="text-[11px] font-normal text-slate-500 mt-0.5">
                      Converts long links into clean compact URLs when publishing
                    </p>
                  </div>
                </label>

                <label className={CHECKBOX_CARD_CLASS}>
                  <input
                    type="checkbox"
                    checked={globalAiDisclosure}
                    onChange={(e) =>
                      handleToggleGlobalAiDisclosure(e.target.checked)
                    }
                    className="mt-0.5 w-4 h-4 rounded accent-[#211832]"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      Global &ldquo;Created with AI&rdquo; Label
                    </p>
                    <p className="text-[11px] font-normal text-slate-500 mt-0.5">
                      Enables official AI / Synthetic Media flag on all networks
                    </p>
                  </div>
                </label>

                <label className={CHECKBOX_CARD_CLASS}>
                  <input
                    type="checkbox"
                    checked={globalPaidPromo}
                    onChange={(e) =>
                      handleToggleGlobalPaidPromo(e.target.checked)
                    }
                    className="mt-0.5 w-4 h-4 rounded accent-[#211832]"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      Global Paid Promotion Label
                    </p>
                    <p className="text-[11px] font-normal text-slate-500 mt-0.5">
                      Enables commercial / sponsored content disclosure everywhere
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Per-Platform Accordions */}
        {activePlatformsList.map((plat) => renderPlatformPresetAccordion(plat))}
      </div>
    </div>
  );
}
