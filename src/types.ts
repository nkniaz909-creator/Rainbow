export type LanguageCode =
  | 'bn'
  | 'en'
  | 'ar'
  | 'hi'
  | 'ur'
  | 'zh-CN'
  | 'zh-TW'
  | 'ja'
  | 'ko'
  | 'es'
  | 'pt'
  | 'fr'
  | 'de'
  | 'ru'
  | 'tr'
  | 'id'
  | 'ms'
  | 'th'
  | 'vi'
  | 'it';

export type ThemeMode = 'light' | 'dark';

export type VideoCategory =
  | 'Entertainment'
  | 'Education'
  | 'Technology'
  | 'Gaming'
  | 'News'
  | 'Sports'
  | 'Music'
  | 'Islamic'
  | 'Comedy'
  | 'Travel'
  | 'Cooking'
  | 'Science'
  | 'Movies'
  | 'Lifestyle'
  | 'Other';

export const VIDEO_CATEGORIES: VideoCategory[] = [
  'Entertainment',
  'Education',
  'Technology',
  'Gaming',
  'News',
  'Sports',
  'Music',
  'Islamic',
  'Comedy',
  'Travel',
  'Cooking',
  'Science',
  'Movies',
  'Lifestyle',
  'Other',
];

export interface UserProfile {
  uid: string;
  displayName: string;
  username: string;
  photoURL?: string;
  coverURL?: string;
  bio?: string;
  followersCount: number;
  followingCount: number;
  videosCount: number;
  isPrivate: boolean;
  showSavedPublicly?: boolean;
  whoCanMessage: 'everyone' | 'following' | 'nobody';
  isMinor: boolean;
  isRestricted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPrefs {
  followers: boolean;
  likes: boolean;
  comments: boolean;
  replies: boolean;
  uploads: boolean;
  system: boolean;
}

export interface UserPrivateSettings {
  uid: string;
  email?: string;
  phoneNumber?: string;
  birthYear?: number;
  language: LanguageCode;
  theme: ThemeMode;
  autoplay: boolean;
  shortsAutoplay: boolean;
  dataSaver: boolean;
  notificationPrefs?: NotificationPrefs;
  updatedAt: string;
}

export interface VideoItem {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorUsername: string;
  creatorPhotoURL?: string;
  title: string;
  description?: string;
  videoUrl: string;
  storagePath: string;
  thumbnailUrl?: string;
  thumbnailPath?: string;
  duration: number;
  isShort: boolean;
  category: VideoCategory | string;
  tags?: string[];
  visibility: 'public' | 'private';
  status: 'active' | 'restricted' | 'removed';
  viewsCount: number;
  likesCount: number;
  dislikesCount: number;
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommentItem {
  id: string;
  videoId?: string;
  postId?: string;
  authorId: string;
  authorName: string;
  authorUsername?: string;
  authorPhotoURL?: string;
  text: string;
  parentId?: string;
  status: 'active' | 'removed';
  createdAt: string;
  updatedAt?: string;
}

export interface SocialPost {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername?: string;
  authorPhotoURL?: string;
  text?: string;
  imageUrl?: string;
  imagePath?: string;
  sharedVideoId?: string;
  sharedVideoTitle?: string;
  sharedVideoThumb?: string;
  visibility: 'public' | 'followers' | 'private';
  status: 'active' | 'removed';
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  recipientId: string;
  actorId: string;
  actorName: string;
  actorPhotoURL?: string;
  type: 'follow' | 'like' | 'comment' | 'reply' | 'upload' | 'system';
  targetId?: string;
  targetType?: 'video' | 'post' | 'user' | 'announcement';
  message: string;
  read: boolean;
  createdAt: string;
}

export interface ConversationItem {
  id: string;
  participants: string[];
  participantNames?: Record<string, string>;
  participantPhotos?: Record<string, string>;
  lastMessage?: string;
  lastSenderId?: string;
  lastMessageAt?: string;
  createdAt: string;
}

export interface MessageItem {
  id: string;
  senderId: string;
  text: string;
  readBy: string[];
  createdAt: string;
}

export interface ReportItem {
  id: string;
  reporterId: string;
  targetType: 'video' | 'account' | 'comment' | 'post';
  targetId: string;
  parentId?: string;
  reason: string;
  details?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  reviewedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  authorId: string;
  createdAt: string;
}

export type AppRoute =
  | 'home'
  | 'shorts'
  | 'upload'
  | 'following'
  | 'feed'
  | 'watch'
  | 'profile'
  | 'notifications'
  | 'messages'
  | 'search'
  | 'studio'
  | 'settings'
  | 'auth'
  | 'admin';

export const RAINBOW_LOGO_PATH = '/assets/aistudio/1795425570471_537187a9.jpg';
