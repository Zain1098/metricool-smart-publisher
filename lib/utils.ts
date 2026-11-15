import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SocialPlatform, PlatformConfig } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const YOUTUBE_CATEGORIES = [
  { id: '28', label: 'Science & Technology' },
  { id: '27', label: 'Education' },
  { id: '24', label: 'Entertainment' },
  { id: '22', label: 'People & Blogs' },
  { id: '26', label: 'Howto & Style' },
  { id: '20', label: 'Gaming' },
  { id: '10', label: 'Music' },
  { id: '25', label: 'News & Politics' },
  { id: '17', label: 'Sports' },
  { id: '1', label: 'Film & Animation' },
];

export const PLATFORM_CONFIGS: Record<SocialPlatform, PlatformConfig> = {
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    shortName: 'YT',
    icon: 'Youtube',
    color: '#FF0033',
    bgTint: 'rgba(255, 0, 51, 0.12)',
    charLimit: 5000,
    supportsVideo: true,
    supportsShortsReels: true,
    supportsNativeSchedule: true,
    fields: {
      hasTitle: true,
      hasPrivacy: true,
      hasShortsReelsToggle: true,
      hasCoverSelect: true,
      hasCategory: true,
      hasTags: true,
      hasMadeForKids: true,
      hasFirstComment: true,
      hasAiLabel: true,
    },
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    shortName: 'IG',
    icon: 'Instagram',
    color: '#E1306C',
    bgTint: 'rgba(225, 48, 108, 0.12)',
    charLimit: 2200,
    supportsVideo: true,
    supportsShortsReels: true,
    supportsNativeSchedule: false,
    fields: {
      hasFirstComment: true,
      hasCoverSelect: true,
      hasShortsReelsToggle: true,
      hasCollaborators: true,
      hasAudioName: true,
      hasAiLabel: true,
    },
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    shortName: 'FB',
    icon: 'Facebook',
    color: '#1877F2',
    bgTint: 'rgba(24, 119, 242, 0.12)',
    charLimit: 63206,
    supportsVideo: true,
    supportsShortsReels: true,
    supportsNativeSchedule: true,
    fields: {
      hasTitle: true,
      hasFirstComment: true,
      hasCoverSelect: true,
      hasShortsReelsToggle: true,
      hasAiLabel: true,
    },
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    shortName: 'TT',
    icon: 'Video',
    color: '#00F2FE',
    bgTint: 'rgba(0, 242, 254, 0.12)',
    charLimit: 2200,
    supportsVideo: true,
    supportsShortsReels: true,
    supportsNativeSchedule: false,
    fields: {
      hasPrivacy: true,
      hasDuetStitch: true,
      hasCoverSelect: true,
      hasAiLabel: true,
    },
  },
  twitter: {
    id: 'twitter',
    name: 'X (Twitter)',
    shortName: 'X',
    icon: 'Twitter',
    color: '#1DA1F2',
    bgTint: 'rgba(29, 161, 242, 0.12)',
    charLimit: 280,
    supportsVideo: true,
    supportsShortsReels: false,
    supportsNativeSchedule: false,
    fields: {
      hasFirstComment: true,
      hasAiLabel: true,
    },
  },
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    shortName: 'IN',
    icon: 'Linkedin',
    color: '#0A66C2',
    bgTint: 'rgba(10, 102, 194, 0.12)',
    charLimit: 3000,
    supportsVideo: true,
    supportsShortsReels: false,
    supportsNativeSchedule: false,
    fields: {
      hasTitle: true,
      hasPrivacy: true,
      hasFirstComment: true,
      hasAiLabel: true,
    },
  },
  threads: {
    id: 'threads',
    name: 'Threads',
    shortName: 'TH',
    icon: 'AtSign',
    color: '#A855F7',
    bgTint: 'rgba(168, 85, 247, 0.12)',
    charLimit: 500,
    supportsVideo: true,
    supportsShortsReels: false,
    supportsNativeSchedule: false,
    fields: {
      hasFirstComment: true,
      hasAiLabel: true,
    },
  },
  pinterest: {
    id: 'pinterest',
    name: 'Pinterest',
    shortName: 'PIN',
    icon: 'Pin',
    color: '#E60023',
    bgTint: 'rgba(230, 0, 35, 0.12)',
    charLimit: 500,
    supportsVideo: true,
    supportsShortsReels: false,
    supportsNativeSchedule: false,
    fields: {
      hasTitle: true,
      hasPinterestFields: true,
      hasAiLabel: true,
    },
  },
};

export function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatTimeSec(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}
