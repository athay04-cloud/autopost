export interface FacebookIdentity {
  id: string;
  name: string;
  type: 'personal' | 'page';
  badge: string;
  avatarColor: string;
  avatarInitials: string;
  description: string;
}

export interface FacebookGroup {
  id: string;
  name: string;
  category: 'ecommerce' | 'tech' | 'culinary' | 'jobs' | 'community' | 'general';
  memberCount: string;
  membersNumeric: number;
  privacy: 'public' | 'private';
  role: 'admin' | 'moderator' | 'member';
  avatarBg: string;
  avatarText: string;
  allowAnonymous: boolean;
  joinedYear: number;
}

export interface PostScenario {
  id: string;
  title: string;
  content: string;
  bgGradientId: string | null;
  attachmentType: 'none' | 'link' | 'photos' | 'video';
  linkUrl: string;
  linkPreview?: {
    title: string;
    description: string;
    domain: string;
    imageUrl?: string;
  };
  photoUrls: string[];
  videoUrl: string;
  isAnonymous: boolean;
  isCrossPost: boolean;
  firstCommentText: string;
}

export interface ExecutionParameters {
  threadCount: number; // 1-5
  delayMinSeconds: number; // e.g. 15
  delayMaxSeconds: number; // e.g. 45
  scheduleEnabled: boolean;
  scheduleDateTime: string;
  commentAfterPosting: boolean;
  firstCommentText: string;
  advancedCycle: boolean;
  cycleCount: number;
  delayBetweenCyclesMin: number;
  scenarioMode: 'random' | 'sequential';
}

export interface PostResultItem {
  id: string;
  groupId: string;
  groupName: string;
  identityName: string;
  scenarioTitle: string;
  renderedContent: string;
  bgGradientId: string | null;
  attachmentType: 'none' | 'link' | 'photos' | 'video';
  attachmentMeta?: {
    linkUrl?: string;
    linkTitle?: string;
    photoCount?: number;
    photoUrls?: string[];
    videoUrl?: string;
  };
  firstCommentApplied?: string;
  status: 'queued' | 'running' | 'success' | 'failed';
  threadId: number;
  postUrl?: string;
  timestamp: string;
  delayRemaining?: number;
  errorMessage?: string;
  anonymous?: boolean;
  isRealPost?: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
  details?: string;
}

export interface GroupPreset {
  id: string;
  name: string;
  groupIds: string[];
  isCustom?: boolean;
}
