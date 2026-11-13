import type { PlatformAdapter } from './coursera/adapter';
import { CourseraAdapter } from './coursera/adapter';
import { LinkedInLearningAdapter } from './linkedin/adapter';

export function getPlatformAdapter(): PlatformAdapter {
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname.toLowerCase();
    if (host.includes('linkedin.com')) {
      console.log('[Study Assistant] LinkedIn Learning platform detected.');
      return new LinkedInLearningAdapter();
    }
  }
  console.log('[Study Assistant] Coursera platform detected.');
  return new CourseraAdapter();
}

export * from './coursera/adapter';
export * from './linkedin/adapter';

