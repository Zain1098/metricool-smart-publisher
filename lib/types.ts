export type SocialPlatform =
  | 'youtube'
  | 'instagram'
  | 'tiktok'
  | 'facebook'
  | 'twitter'
  | 'linkedin'
  | 'threads'
  | 'pinterest';

export type PostStatus =
  | 'draft'
  | 'scheduled'
  | 'scheduled_on_platform'
  | 'publishing'
  | 'published'
  | 'failed';

export type PublishMode = 'publish_now' | 'native_schedule' | 'local_queue';

export interface PlatformConfig {
  id: SocialPlatform;
  name: string;
  shortName: string;
  icon: string;
  color: string;
  bgTint: string;
  charLimit: number;
  supportsVideo: boolean;
  supportsShortsReels: boolean;
  supportsNativeSchedule: boolean;
  fields: {
    hasTitle?: boolean;
    hasFirstComment?: boolean;
    hasCoverSelect?: boolean;
    hasPrivacy?: boolean;
    hasShortsReelsToggle?: boolean;
    hasDuetStitch?: boolean;
    hasCategory?: boolean;
    hasTags?: boolean;
    hasMadeForKids?: boolean;
    hasCollaborators?: boolean;
    hasAudioName?: boolean;
    hasAiLabel?: boolean;
    hasPinterestFields?: boolean;
  };
}

export interface PlatformSpecificContent {
  title?: string;
  caption: string;
  isShortOrReel?: boolean;
  postType?: 'reel' | 'short' | 'video' | 'post' | 'story';
  firstComment?: string;
  coverUrl?: string;
  thumbOffsetMs?: number;
  privacy?: 'public' | 'unlisted' | 'private' | 'friends';
  // Universal AI & Commercial Disclosures (All 8 Platforms)
  isAiGenerated?: boolean;
  containsSyntheticMedia?: boolean;
  isCreatedWithAi?: boolean;
  paidPromotion?: boolean;
  sponsorHandle?: string;
  // YouTube specific settings
  categoryId?: string;
  tags?: string[];
  madeForKids?: boolean;
  embeddable?: boolean;
  license?: 'youtube' | 'creativeCommon';
  notifySubscribers?: boolean;
  publicStatsViewable?: boolean;
  defaultLanguage?: string;
  playlistId?: string;
  allowAutoChapters?: boolean;
  commentModeration?:
    | 'all'
    | 'holdPotentiallyInappropriate'
    | 'holdAll'
    | 'disable';
  // Instagram / Facebook specific settings
  shareToFeed?: boolean;
  collaborators?: string;
  userTags?: string;
  audioName?: string;
  locationName?: string;
  altText?: string;
  disableComments?: boolean;
  secret?: boolean;
  callToActionType?:
    | 'NONE'
    | 'LEARN_MORE'
    | 'WATCH_MORE'
    | 'SHOP_NOW'
    | 'SIGN_UP';
  // TikTok specific settings
  allowDuet?: boolean;
  allowStitch?: boolean;
  allowComments?: boolean;
  commercialContent?: boolean;
  commercialYourBrand?: boolean;
  commercialBrandedContent?: boolean;
  autoAddMusic?: boolean;
  highQualityUpload?: boolean;
  // X / Pinterest / LinkedIn / Threads specific settings
  boardId?: string;
  destinationLink?: string;
  replyControl?: 'everyone' | 'accounts_you_follow' | 'mentioned_only';
  xReplySettings?: 'everyone' | 'following' | 'mentionedUsers' | 'subscribers';
  sensitiveContent?: boolean;
  topicTag?: string;
}

export interface ScheduledPost {
  id: string;
  userId: string;
  status: PostStatus;
  publishMode?: PublishMode;
  scheduledAt: string; // ISO 8601 string
  publishedAt?: string;
  createdAt: string;
  mediaUrl: string;
  mediaType: 'video' | 'image';
  mediaFileName: string;
  mediaDurationSec?: number;
  mediaAspectRatio?: string;
  mediaSizeMb?: number;
  coverUrl?: string;
  thumbOffsetMs?: number;
  globalCaption: string;
  shortenerEnabled?: boolean;
  targetPlatforms: SocialPlatform[];
  platformOverrides: Partial<Record<SocialPlatform, PlatformSpecificContent>>;
  publishedUrls?: Partial<Record<SocialPlatform, string>>;
  platformStatusNotes?: Partial<Record<SocialPlatform, string>>;
  postizPostId?: string;
  videoAssetId?: string;
  errorMessage?: string;
}

export interface PlatformCredentials {
  accessToken?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  accountId?: string; // ig_user_id, page_id, channel_id, board_id, open_id
}

export interface ConnectedAccount {
  id: string;
  platform: SocialPlatform;
  accountName: string;
  handle: string;
  avatarUrl: string;
  isConnected: boolean;
  connectedAt?: string;
  tokenExpiresAt?: string;
  tokenStatus?: 'valid' | 'expired' | 'unverified';
  tokenStatusNote?: string;
  followersCount: number;
  postsCount?: number;
  viewsCount?: number;
  postizIntegrationId?: string;
  postizChannelName?: string;
  authMode?: 'oauth' | 'api_key';
  hasCustomCredentials?: boolean;
  credentials?: PlatformCredentials;
}

export interface AnalyticsMetric {
  date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  platform: SocialPlatform;
}

export interface BrandSettings {
  brandName: string;
  timezone: string;
  notificationEmail: string;
  autoOptimalTime?: boolean;
  defaultPublishMode?: PublishMode;
}
