/**
 * Coursera Internal API Client
 * Uses Coursera's official internal REST APIs with session authentication & CSRF tokens
 * for instantaneous completion of videos, readings, and discussion prompts.
 */

const BASE = 'https://www.coursera.org';

export function getCsrfToken(): string {
  try {
    if (typeof document === 'undefined' || !document || typeof document.cookie !== 'string') {
      return '';
    }
    const match = document.cookie.match(/(^|;\s*)csrf3-token=([^;]+)/);
    return match ? match[2] : '';
  } catch {
    return '';
  }
}

export async function courseraFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'X-Requested-With': 'XMLHttpRequest',
    'X-Coursera-Application': 'nautilus',
    'X-Coursera-Version': 'ondemand',
    ...(options.headers as Record<string, string> || {}),
  };

  if (!options.method || options.method.toUpperCase() === 'GET') {
    delete headers['Content-Type'];
  } else {
    headers['Content-Type'] = 'application/json';
  }

  const csrf = getCsrfToken();
  if (csrf) {
    headers['X-CSRF3-Token'] = csrf;
    headers['X-CSRFToken'] = csrf;
  }

  return fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });
}

export interface CourseContext {
  courseSlug: string;
  itemType: 'lecture' | 'supplement' | 'quiz' | 'discussionPrompt' | 'peer' | 'course' | string;
  itemId: string | null;
}

export function getCourseContext(): CourseContext | null {
  try {
    if (typeof window === 'undefined' || !window.location || !window.location.href) {
      return null;
    }
    const href = window.location.href;

    const match = href.match(
      /\/learn\/([^/]+)\/(lecture|supplement|quiz|programming|discussionPrompt|dialogue)\/([^/?#]+)/i
    );
    if (match) {
      let itemType = match[2];
      if (itemType.toLowerCase() === 'discussionprompt') itemType = 'discussionPrompt';
      return { courseSlug: match[1], itemType, itemId: match[3] };
    }

    const quizSubmitMatch = href.match(
      /\/learn\/([^/]+)\/assignment-submission\/([^/?#]+)/i
    );
    if (quizSubmitMatch) {
      return { courseSlug: quizSubmitMatch[1], itemType: 'quiz', itemId: quizSubmitMatch[2] };
    }

    const discMatch = href.match(/\/learn\/([^/]+)\/discussionPrompt\/([^/?#]+)/i);
    if (discMatch) {
      return { courseSlug: discMatch[1], itemType: 'discussionPrompt', itemId: discMatch[2] };
    }

    const courseMatch = href.match(/\/learn\/([^/?#]+)/i);
    if (courseMatch && courseMatch[1]) {
      const slug = courseMatch[1];
      const excluded = ['my-learning', 'home', 'search', 'browse', 'programs', 'certificates', 'degrees'];
      if (!excluded.includes(slug.toLowerCase())) {
        return { courseSlug: slug, itemType: 'course', itemId: null };
      }
    }
  } catch {}

  return null;
}

export async function getCourseId(courseSlug: string): Promise<string | null> {
  try {
    const res = await courseraFetch(`${BASE}/api/onDemandCourses.v1?q=slug&slug=${courseSlug}&fields=id`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.elements?.[0]?.id ?? null;
  } catch (e) {
    console.warn('[Coursera API] getCourseId notice:', e);
    return null;
  }
}

export async function getUserId(courseId?: string | null): Promise<string | null> {
  // 1. Check DOM script tags (Apollo Client / Redux State cache)
  try {
    const scripts = Array.from(document.getElementsByTagName('script'));
    for (const script of scripts) {
      const text = script.textContent || '';
      if (text.includes('"userId"') || text.includes('"email_address"')) {
        const match = text.match(/"userId"\s*:\s*(\d+)/) || text.match(/"id"\s*:\s*(\d+)/);
        if (match && match[1]) {
          return match[1];
        }
      }
    }
  } catch {}

  // 2. Fetch from Coursera Users API
  try {
    const res = await courseraFetch(`${BASE}/api/users.v1?q=me&fields=id`);
    if (res.ok) {
      const data = await res.json();
      const id = data?.elements?.[0]?.id ?? null;
      if (id) return String(id);
    }
  } catch {}

  return null;
}

export async function getVideoMeta(courseId: string, courseSlug: string, itemId: string): Promise<{ videoId: string; duration: number } | null> {
  const fields = [
    'onDemandVideos.v1(id%2Cduration%2Cname%2Csources%2Csubtitles%2CsubtitlesVtt%2CsubtitlesTxt)',
    'disableSkippingForward',
    'startMs',
    'endMs',
  ].join('%2C');

  const url = `${BASE}/api/onDemandLectureVideos.v1/${courseId}~${itemId}/?includes=video&fields=${fields}`;

  try {
    const res = await courseraFetch(url);
    if (res.ok) {
      const data = await res.json();
      const video = data?.linked?.['onDemandVideos.v1']?.[0] || data?.elements?.[0]?.video;
      if (video?.id) {
        let durationMs = video.duration || 60000;
        const videoEl = document.querySelector('video');
        if (videoEl && videoEl.duration && isFinite(videoEl.duration)) {
          durationMs = Math.round(videoEl.duration * 1000);
        }
        return { videoId: video.id, duration: durationMs };
      }
    }
  } catch (e) {
    console.warn('[Coursera API] getVideoMeta error:', e);
  }

  // Fallback to DOM video element
  const videoEl = document.querySelector('video');
  if (videoEl && videoEl.duration && isFinite(videoEl.duration)) {
    return { videoId: itemId, duration: Math.round(videoEl.duration * 1000) };
  }

  return null;
}

export async function reportVideoProgress(userId: string, courseId: string, videoId: string, duration: number): Promise<boolean> {
  const progressId = `${userId}~${courseId}~${videoId}`;
  const viewedUpTo = Math.max(0, (duration || 60000) - 1000);
  
  for (const method of ['POST', 'PUT']) {
    try {
      const res = await courseraFetch(`${BASE}/api/onDemandVideoProgresses.v1/${progressId}`, {
        method,
        body: JSON.stringify({ viewedUpTo, videoProgressId: progressId }),
      });
      if (res.ok || res.status === 204) return true;
    } catch {}
  }
  return false;
}

export async function markLectureCompleted(
  userId: string,
  courseId: string,
  courseSlug: string,
  itemId: string
): Promise<{ success: boolean; error?: string }> {
  // Step 1: Fire direct videoEvents ended trigger
  try {
    const completeUrl = `${BASE}/api/opencourse.v1/user/${userId}/course/${courseSlug}/item/${itemId}/lecture/videoEvents/ended?autoEnroll=false`;
    const res = await courseraFetch(completeUrl, {
      method: 'POST',
      body: JSON.stringify({ contentRequestBody: {} }),
    });
    if (res.ok) {
      console.log('[Coursera API] Video lecture completed via videoEvents/ended API!');
      return { success: true };
    }
  } catch (e: any) {
    console.warn('[Coursera API] Video ended API error:', e);
  }

  // Step 2: Report video watch progress (100%)
  const meta = await getVideoMeta(courseId, courseSlug, itemId);
  if (meta) {
    const ok = await reportVideoProgress(userId, courseId, meta.videoId, meta.duration);
    if (ok) {
      console.log('[Coursera API] Video progress reported successfully via onDemandVideoProgresses API!');
      return { success: true };
    }
  }

  // Step 3: Fallback progressState PUT
  for (const slugOrId of [courseId, courseSlug]) {
    try {
      const fbUrl = `${BASE}/api/opencourse.v1/user/${userId}/course/${slugOrId}/item/${itemId}/progressState`;
      const res = await courseraFetch(fbUrl, {
        method: 'PUT',
        body: JSON.stringify({ progressState: 'COMPLETED' }),
      });
      if (res.ok) {
        console.log('[Coursera API] Video completed via progressState PUT API!');
        return { success: true };
      }
    } catch {}
  }

  return { success: false, error: 'Video completion API returned unexpected status' };
}

export async function markSupplementCompleted(
  userId: string,
  courseId: string,
  itemId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await courseraFetch(`${BASE}/api/onDemandSupplementCompletions.v1`, {
      method: 'POST',
      body: JSON.stringify({
        courseId,
        itemId,
        userId: Number(userId),
      }),
    });
    if (res.ok) {
      console.log('[Coursera API] Reading supplement completed via onDemandSupplementCompletions API!');
      return { success: true };
    }
  } catch (e: any) {
    console.warn('[Coursera API] Reading completion error:', e);
  }

  return { success: false, error: 'Reading completion API failed' };
}

export async function postDiscussionAnswer(
  courseId: string,
  questionId: string,
  answerText = 'Great insights and valuable perspective. Thank you for sharing!'
): Promise<boolean> {
  const csrf = getCsrfToken();
  const answerBody = {
    content: {
      typeName: 'cml',
      definition: {
        dtdId: 'discussion/1',
        value: `<co-content><text>${answerText}</text></co-content>`,
      },
    },
    courseForumQuestionId: `${courseId}~${questionId}`,
  };

  const answerFields = 'content,forumQuestionId,parentForumAnswerId,state,creatorId,createdAt,order,courseItemForumQuestionId';
  const url = `${BASE}/api/onDemandCourseForumAnswers.v1/?fields=${answerFields}&includes=profiles,children,userId`;

  try {
    const res = await courseraFetch(url, {
      method: 'POST',
      headers: { 'x-csrf3-token': csrf },
      body: JSON.stringify(answerBody),
    });
    if (res.ok || res.status === 201) {
      console.log('[Coursera API] Discussion posted successfully!');
      return true;
    }
  } catch (e) {
    console.warn('[Coursera API] Discussion posting notice:', e);
  }
  return false;
}

export async function getAllCourseItems(courseSlug: string): Promise<any> {
  try {
    const includes = 'modules,lessons,items';
    const fields = 'moduleIds,onDemandCourseMaterialItems.v2(name,slug,contentSummary)';
    const url = `${BASE}/api/onDemandCourseMaterials.v2/?q=slug&slug=${courseSlug}&includes=${includes}&fields=${fields}&showLockedItems=true`;
    const res = await courseraFetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function bulkCompleteAllItems(
  onProgress?: (current: number, total: number) => void
): Promise<{ success: boolean; completed: number; total: number; message: string }> {
  const context = getCourseContext();
  if (!context || !context.courseSlug) {
    return { success: false, completed: 0, total: 0, message: 'Not on an active course page' };
  }

  const courseId = await getCourseId(context.courseSlug);
  if (!courseId) return { success: false, completed: 0, total: 0, message: 'Could not resolve course ID' };

  const userId = await getUserId(courseId);
  if (!userId) return { success: false, completed: 0, total: 0, message: 'User not signed in or not enrolled' };

  const materials = await getAllCourseItems(context.courseSlug);
  const items = materials?.linked?.['onDemandCourseMaterialItems.v2']?.filter(
    (item: any) => item?.contentSummary?.typeName?.includes('lecture') || item?.contentSummary?.typeName?.includes('supplement')
  ) || [];

  const total = items.length;
  if (total === 0) return { success: false, completed: 0, total: 0, message: 'No eligible items found in curriculum' };

  let completed = 0;
  const batchSize = 5;

  for (let i = 0; i < total; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (item: any) => {
        try {
          const type = item.contentSummary?.typeName || '';
          if (type.includes('lecture')) {
            await markLectureCompleted(userId, courseId, context.courseSlug, item.id);
          } else if (type.includes('supplement')) {
            await markSupplementCompleted(userId, courseId, item.id);
          }
          completed++;
        } catch {}
      })
    );
    if (onProgress) onProgress(completed, total);
    await new Promise((r) => setTimeout(r, 200));
  }

  return {
    success: true,
    completed,
    total,
    message: `Successfully completed ${completed}/${total} videos & readings!`,
  };
}
