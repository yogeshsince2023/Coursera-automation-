export type ActivityType = 'video' | 'reading' | 'quiz' | 'discussion' | 'modal' | 'assignment' | 'unknown';

export type ActivityStatus = 'pending' | 'in_progress' | 'completed' | 'manual_review_needed' | 'failed';

export interface CourseItem {
  id?: number;
  courseId: string;
  courseName: string;
  moduleName?: string;
  itemId: string;
  itemType: ActivityType;
  title: string;
  url: string;
  status: ActivityStatus;
  progressPercentage?: number;
  lastAttemptAt?: number;
  completedAt?: number;
}

export interface AutomationSettings {
  enabled: boolean;
  autoVideo: boolean;
  autoReading: boolean;
  autoNext: boolean;
  autoQuiz: boolean;
  autoDiscussion: boolean;
  fastVideo: boolean;
  stealthDelayMin: number;
  stealthDelayMax: number;
  videoSpeed: number;
}

export const DEFAULT_SETTINGS: AutomationSettings = {
  enabled: true,
  autoVideo: true,
  autoReading: true,
  autoNext: true,
  autoQuiz: true,
  autoDiscussion: true,
  fastVideo: true, // Continuous accelerated playback (16.0x) ensures fast completion while satisfying watch requirements
  stealthDelayMin: 1000,
  stealthDelayMax: 2000,
  videoSpeed: 16.0
};

export interface AutomationLog {
  id?: number;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  itemUrl?: string;
}
