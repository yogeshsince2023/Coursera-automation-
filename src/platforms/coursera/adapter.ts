import type { ActivityType } from '../../types';
import { human } from '../../stealth/human';
import * as courseraApi from './api';

export interface PlatformAdapter {
  name?: string;
  detectActivity(): ActivityType;
  handleVideo(speed: number, fastVideo: boolean): Promise<boolean>;
  handleReading(): Promise<boolean>;
  handleQuiz(): Promise<boolean>;
  handleDiscussion(): Promise<boolean>;
  handleModal(): Promise<boolean>;
  clickNext(): Promise<boolean>;
  isActivityCompleted(): boolean;
  getVideoProgress(): { current: number; duration: number; percent: number; speed: number } | null;
  hasGreenCompletionTick(): boolean;
  findVideoElement(): HTMLVideoElement | null;
  completeAllItems?(onProgress?: (current: number, total: number) => void): Promise<{ success: boolean; completed: number; total: number; message: string }>;
}

export class CourseraAdapter implements PlatformAdapter {
  public name = 'Coursera';
  private videoEndedTimestamp: number | null = null;
  private cachedUserId: string | null = null;
  private cachedCourseId: string | null = null;
  private lastCompletedItemId: string | null = null;

  private selectors = {
    // Next / Advance Navigation
    nextButton: [
      '#nextLessonBtn',
      'button[data-testid="next-item"]',
      'a[data-testid="next-item"]',
      'button[data-testid="next-item-button"]',
      'a[data-testid="next-item-button"]',
      'button[data-track-component="next_item_button"]',
      'a[data-track-component="next_item_button"]',
      'button[data-e2e="next-item-button"]',
      'a[data-e2e="next-item-button"]',
      'button[data-e2e="next-lesson-button"]',
      'button[aria-label*="Go to" i]',
      'a[aria-label*="Go to" i]',
      'button[aria-label*="Next item" i]',
      'a[aria-label*="Next item" i]',
      'button[aria-label="Next item"]',
      'a[aria-label="Next item"]',
      'button[aria-label="Go to next item"]',
      'a[aria-label="Go to next item"]',
      'button[aria-label="Next"]',
      'button[data-testid="next-button"]',
      'a[data-testid="next-button"]',
      'button[data-testid*="go-to" i]',
      'a[data-testid*="go-to" i]',
      'div[data-testid="item-navigation-container"] button',
      'div[data-testid="item-navigation-container"] a',
      'div.rc-ItemNavigation button',
      'div.rc-ItemNavigation a',
      'button[data-track-component="resume_course_button"]',
      'button[data-testid="resume-course-btn"]',
      'a[data-track-component="resume_course_button"]',
      'a[data-testid="resume-course-btn"]'
    ],
    // Mark as completed
    completeButton: [
      '#markDoneBtn',
      'button[data-testid="mark-complete"]',
      'button[data-testid="mark-completed"]',
      'button[data-testid="mark-as-completed-button"]',
      'button[data-testid="mark-complete-button"]',
      'button[data-track-component*="mark_as_completed" i]',
      'button[data-track-component*="mark_complete" i]',
      'button[data-e2e="complete-button"]',
      'button[data-e2e="mark-complete-button"]',
      'button.rc-MarkAsCompleteButton',
      'button.rc-MarkAsCompletedButton',
      'button[aria-label*="Mark as complete" i]'
    ],
    // Video
    video: [
      '#mockVideo',
      'video',
      'video[preload]',
      '.vjs-tech',
      'div[data-testid="video-player"] video'
    ],
    videoPlayButton: [
      'button.vjs-big-play-button',
      '.vjs-big-play-button',
      'button.rc-VideoPlayButton',
      'button[data-e2e="play-button"]',
      'button[data-track-component="play_button"]',
      'button[data-testid="play-button"]',
      'button.vjs-play-control[title*="Play" i]',
      'button.vjs-play-control[aria-label*="Play" i]',
      'button[aria-label="Play Video" i]',
      'button[aria-label="Play video" i]',
      'button[aria-label="Play" i]',
      '.vjs-poster'
    ],
    videoAutoAdvance: [
      'button[data-track-component="autoplay_next_button"]',
      'button[aria-label="Play next"]',
      'button[aria-label*="Play next" i]',
      'div[class*="countdown"] button'
    ],
    // In-video quiz / prompt
    inVideoPrompt: [
      'button[aria-label*="Skip question" i]',
      'button[aria-label*="Skip" i]',
      'button[aria-label*="Continue" i]',
      'button[aria-label*="Resume video" i]',
      'button[data-testid*="skip" i]',
      'button[data-testid*="continue" i]',
      '.rc-VideoQuiz button',
      'div[class*="VideoQuiz"] button',
      'div[class*="InVideoQuiz"] button',
      'button.rc-InVideoQuiz__skip-button',
      'button.rc-InVideoQuiz__submit-button'
    ],
    // Reading
    reading: [
      '#readingContainer',
      '.rc-ReadingItem',
      'div[data-testid="reading-content"]',
      '[data-testid="supplement-component"]',
      '.cml-wrapper',
      '.reading-content'
    ],
    // Quiz / Assessment
    quiz: [
      '.rc-QuizItem',
      'div[data-testid="quiz-content"]',
      '.rc-FormPartsQuestion',
      'form[data-testid="quiz-form"]',
      '[data-testid="quiz-container"]',
      '[data-testid="exam-item"]'
    ],
    quizStartButton: [
      'button[data-testid="start-assignment-btn"]',
      'a[data-testid="start-assignment-btn"]',
      'button[data-track-component="start_assignment_button"]',
      'button[data-e2e="start-quiz-button"]',
      'button[data-testid="resume-assignment-btn"]',
      'button[data-testid="try-again-btn"]'
    ],
    quizSubmit: [
      '#submitQuizBtn',
      'button[data-testid="submit-button"]',
      'button[data-testid="quiz-submit-button"]',
      'button[data-e2e="submit-quiz-button"]',
      'button[data-track-component="submit_button"]',
      'button.rc-SubmitButton',
      'form button[type="submit"]',
      'button[aria-label*="Submit" i]'
    ],
    quizHonorCode: [
      'input[type="checkbox"][id*="agreement" i]',
      'input[type="checkbox"][id*="honor" i]',
      'input[type="checkbox"][name*="agreement" i]',
      'input[data-testid*="honor-code" i]',
      'input[data-testid*="agreement" i]'
    ],
    quizSignatureInput: [
      'input[placeholder*="full name" i]',
      'input[id*="signature" i]',
      'input[data-testid*="signature" i]',
      'input[placeholder*="type your name" i]'
    ],
    // Discussion
    discussion: [
      '.rc-DiscussionPromptItem',
      'div[data-testid="discussion-prompt"]',
      '[data-testid="discussion-forum-thread"]',
      '#view-discussion textarea'
    ],
    discussionReplyButton: [
      'button[data-track-component="create_thread"]',
      'button[data-track-component="reply_button"]',
      'button[data-e2e="discussion-reply-button"]'
    ],
    // Modals & Popups
    celebrationModal: [
      'div[role="dialog"] button.cds-button--primary',
      'div[role="dialog"] button[data-testid*="next" i]',
      'div[role="dialog"] button[data-testid*="continue" i]',
      'div[class*="modal"] button:has-text("Continue")',
      'div[class*="modal"] button:has-text("Next")'
    ]
  };

  public isVisible(el: HTMLElement | null): boolean {
    if (!el) return false;
    try {
      if (el.tagName === 'VIDEO') return true;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
      }
      return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    } catch {
      return false;
    }
  }

  private queryFirst(selectorList: string[]): HTMLElement | null {
    for (const sel of selectorList) {
      try {
        const elements = Array.from(document.querySelectorAll<HTMLElement>(sel));
        for (const el of elements) {
          if (this.isVisible(el)) return el;
        }
      } catch (e) {}
    }
    return null;
  }

  public findVideoElement(): HTMLVideoElement | null {
    // 1. Direct query
    const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video'));
    for (const v of videos) {
      if (this.isVisible(v)) return v;
    }

    // 2. Query inside iframes
    const iframes = Array.from(document.querySelectorAll<HTMLIFrameElement>('iframe'));
    for (const frame of iframes) {
      try {
        const frameDoc = frame.contentDocument || frame.contentWindow?.document;
        if (frameDoc) {
          const v = frameDoc.querySelector('video') as HTMLVideoElement | null;
          if (v) return v;
        }
      } catch {}
    }

    return document.querySelector<HTMLVideoElement>('video');
  }

  public detectActivity(): ActivityType {
    const url = window.location.href.toLowerCase();

    // 1. Check for Active Dialogs / Modals (celebration, confirmation)
    const dialog = document.querySelector('div[role="dialog"], div[class*="Modal"], div[class*="modal"]');
    if (dialog && this.isVisible(dialog as HTMLElement)) {
      const text = dialog.textContent?.toLowerCase() || '';
      if (
        text.includes('congratulations') ||
        text.includes('next week') ||
        text.includes('next module') ||
        text.includes('submit assignment') ||
        text.includes('are you sure')
      ) {
        return 'modal';
      }
    }

    // In-video quiz popup
    if (this.queryFirst(this.selectors.inVideoPrompt)) {
      return 'modal';
    }

    // 2. Authoritative Video Detection:
    if (url.includes('/lecture/') || url.includes('/video/')) return 'video';
    if (this.findVideoElement()) return 'video';

    // Check active item in the syllabus drawer:
    const activeItem = document.querySelector(
      '[aria-current="page"], [aria-current="true"], li.active, [class*="activeItem" i], [class*="selectedItem" i]'
    );
    if (activeItem) {
      const txt = activeItem.textContent?.toLowerCase() || '';
      if (txt.includes('video')) return 'video';
      if (txt.includes('reading')) return 'reading';
      if (txt.includes('quiz') || txt.includes('assignment') || txt.includes('exam')) return 'quiz';
      if (txt.includes('discussion')) return 'discussion';
    }

    // Also check links in syllabus drawer matching current URL path
    const currentPath = window.location.pathname;
    const links = document.querySelectorAll<HTMLAnchorElement>('a[href*="/learn/"]');
    for (const a of Array.from(links)) {
      try {
        if (new URL(a.href, window.location.origin).pathname === currentPath) {
          const itemText = (a.closest('li, [role="listitem"]') || a).textContent?.toLowerCase() || '';
          if (itemText.includes('video')) return 'video';
          if (itemText.includes('reading')) return 'reading';
          if (itemText.includes('quiz') || itemText.includes('assignment')) return 'quiz';
          if (itemText.includes('discussion')) return 'discussion';
        }
      } catch {}
    }

    // 3. Other URL Routing Patterns
    if (url.includes('/supplement/') || url.includes('/reading/')) return 'reading';
    if (url.includes('/quiz/') || url.includes('/exam/') || url.includes('/assignment/')) return 'quiz';
    if (url.includes('/discussionprompt/') || url.includes('/discuss')) return 'discussion';

    // 4. Fallback to Visible DOM Elements
    if (this.queryFirst(this.selectors.quizStartButton) || this.queryFirst(this.selectors.quiz)) return 'quiz';
    if (this.queryFirst(this.selectors.reading)) return 'reading';
    if (this.queryFirst(this.selectors.discussion)) return 'discussion';

    return 'unknown';
  }

  public async handleModal(): Promise<boolean> {
    console.log('[Adapter] Handling active modal/prompt...');
    await human.sleep(600, 1200);

    // In-video prompt / continue button
    const inVideoBtn = this.queryFirst(this.selectors.inVideoPrompt);
    if (inVideoBtn) {
      console.log('[Adapter] Dismissing in-video prompt');
      await human.naturalClick(inVideoBtn);
      await human.sleep(800, 1500);
      return true;
    }

    // Dialog confirm / continue button
    const dialogBtn = this.queryFirst(this.selectors.celebrationModal);
    if (dialogBtn) {
      console.log('[Adapter] Clicking modal continue/submit button');
      await human.naturalClick(dialogBtn);
      await human.sleep(1200, 2000);
      return true;
    }

    // Generic fallback for any visible button in dialog
    const dialogButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('div[role="dialog"] button, .modal button'));
    for (const btn of dialogButtons) {
      if (!this.isVisible(btn)) continue;
      const txt = btn.textContent?.trim().toLowerCase() || '';
      if (
        txt.includes('continue') ||
        txt.includes('next') ||
        txt.includes('submit') ||
        txt.includes('yes') ||
        txt.includes('got it') ||
        txt.includes('close')
      ) {
        console.log('[Adapter] Clicking dialog action button:', txt);
        await human.naturalClick(btn);
        await human.sleep(1000, 2000);
        return true;
      }
    }

    return false;
  }

  public async handleVideo(speed: number, fastVideo: boolean): Promise<boolean> {
    // 1. Dismiss any lockout toast or warning banner if visible
    const lockoutCloseBtn = document.querySelector<HTMLButtonElement>(
      'div[class*="toast" i] button, div[role="alert"] button, button[aria-label*="close" i]'
    );
    if (lockoutCloseBtn && this.isVisible(lockoutCloseBtn)) {
      lockoutCloseBtn.click();
    }

    // 2. Check for in-video quiz/prompt (Skip or Continue or radio options)
    const inVideoPrompt = this.queryFirst(this.selectors.inVideoPrompt);
    if (inVideoPrompt) {
      console.log('[Adapter] In-video quiz/prompt detected. Interacting...');
      const quizOptions = Array.from(document.querySelectorAll<HTMLElement>(
        '.rc-VideoQuiz input[type="radio"], div[class*="VideoQuiz"] input[type="radio"], div[class*="InVideoQuiz"] input[type="radio"]'
      ));
      for (const opt of quizOptions) {
        if (this.isVisible(opt)) {
          opt.click();
          break;
        }
      }
      inVideoPrompt.click();
    }

    // 3. Locate video element
    const video = this.findVideoElement();
    if (!video) {
      // Trigger play trigger button if visible (some players require initial click to attach <video>)
      for (const sel of this.selectors.videoPlayButton) {
        const btn = document.querySelector<HTMLElement>(sel);
        if (btn && this.isVisible(btn)) {
          console.log('[Adapter] Clicking video play trigger:', sel);
          btn.click();
          break;
        }
      }
      return false;
    }

    // 4. API Instant Completion Trigger (Direct Coursera server completion)
    const context = courseraApi.getCourseContext();
    if (context && context.itemType === 'lecture' && context.itemId && this.lastCompletedItemId !== context.itemId) {
      (async () => {
        try {
          if (!this.cachedCourseId && context.courseSlug) {
            this.cachedCourseId = await courseraApi.getCourseId(context.courseSlug);
          }
          if (!this.cachedUserId) {
            this.cachedUserId = await courseraApi.getUserId(this.cachedCourseId);
          }
          if (this.cachedUserId && this.cachedCourseId && context.itemId) {
            const res = await courseraApi.markLectureCompleted(
              this.cachedUserId,
              this.cachedCourseId,
              context.courseSlug,
              context.itemId
            );
            if (res.success) {
              this.lastCompletedItemId = context.itemId;
              console.log('[Adapter] Video lecture marked completed via official Coursera API!');
            }
          }
        } catch (e) {
          console.warn('[Adapter] API lecture completion note:', e);
        }
      })();
    }

    // 5. Playback rate: fastVideo accelerates up to 16x; normal playback speeds up to 2x
    const targetSpeed = fastVideo ? 16.0 : Math.min(speed || 2.0, 2.0);
    try {
      if (video.playbackRate !== targetSpeed) {
        video.playbackRate = targetSpeed;
      }
    } catch {
      try { video.playbackRate = 8.0; } catch { video.playbackRate = 2.0; }
    }

    // 6. VIDEO COMPLETION CHECK (CRITICAL: Handled BEFORE any unpause logic!)
    const isEnded = video.ended || (video.duration > 0 && video.currentTime >= video.duration - 0.75);
    if (isEnded) {
      // FREEZE at end so it NEVER loops or replays the same video from 0:00!
      try {
        video.pause();
      } catch {}

      if (!this.videoEndedTimestamp) {
        this.videoEndedTimestamp = Date.now();
        console.log('[Adapter] Video playback reached end. Waiting for green checkmark or sync...');
      }

      // Check and click any "Mark as completed" button below the video
      const completeBtns = Array.from(document.querySelectorAll<HTMLButtonElement>(
        'button[data-testid*="complete" i], button.rc-MarkAsCompletedButton, #markDoneBtn, button[data-track-component*="completed" i]'
      ));
      for (const btn of completeBtns) {
        if (this.isVisible(btn)) {
          const txt = btn.textContent?.toLowerCase() || '';
          if (!txt.includes('completed')) {
            console.log('[Adapter] Clicking video "Mark as completed" button');
            btn.click();
            break;
          }
        }
      }

      // Click post-video auto-advance countdown if present
      const autoAdvanceBtn = this.queryFirst(this.selectors.videoAutoAdvance);
      if (autoAdvanceBtn) {
        console.log('[Adapter] Clicking post-video auto-advance');
        autoAdvanceBtn.click();
      }

      return true;
    }

    // 7. Video is STILL PLAYING: Ensure playback is actively unpaused
    this.videoEndedTimestamp = null;
    if (video.paused) {
      for (const sel of this.selectors.videoPlayButton) {
        const btn = document.querySelector<HTMLElement>(sel);
        if (btn && this.isVisible(btn)) {
          btn.click();
          break;
        }
      }
      try {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {});
        }
      } catch {}
    }

    return true;
  }

  public getVideoProgress(): { current: number; duration: number; percent: number; speed: number } | null {
    const video = this.findVideoElement();
    if (!video || !video.duration || isNaN(video.duration) || video.duration <= 0) {
      return null;
    }
    const percent = Math.min(100, Math.floor((video.currentTime / video.duration) * 100));
    return {
      current: Math.floor(video.currentTime),
      duration: Math.floor(video.duration),
      percent,
      speed: video.playbackRate || 1.0
    };
  }

  public async handleReading(): Promise<boolean> {
    console.log('[Adapter] Reading item encountered. Attempting completion via API & DOM...');
    const context = courseraApi.getCourseContext();
    if (context && (context.itemType === 'supplement' || context.itemId)) {
      try {
        if (!this.cachedCourseId && context.courseSlug) {
          this.cachedCourseId = await courseraApi.getCourseId(context.courseSlug);
        }
        if (!this.cachedUserId) {
          this.cachedUserId = await courseraApi.getUserId(this.cachedCourseId);
        }
        if (this.cachedUserId && this.cachedCourseId && context.itemId) {
          await courseraApi.markSupplementCompleted(this.cachedUserId, this.cachedCourseId, context.itemId);
          console.log('[Adapter] Reading marked completed via API!');
        }
      } catch (e) {
        console.warn('[Adapter] Reading API notice:', e);
      }
    }

    const completeBtns = Array.from(document.querySelectorAll<HTMLButtonElement>(
      'button[data-testid*="complete" i], button.rc-MarkAsCompletedButton, #markDoneBtn, button[data-track-component*="completed" i], button[aria-label*="Mark as complete" i]'
    ));
    for (const btn of completeBtns) {
      if (this.isVisible(btn)) {
        btn.removeAttribute('disabled');
        btn.removeAttribute('aria-disabled');
        await human.naturalClick(btn);
        await human.sleep(300, 600);
        break;
      }
    }
    return true;
  }

  public async handleQuiz(): Promise<boolean> {
    console.log('[Adapter] Quiz / Assessment item encountered. Skipping per configuration...');
    await human.sleep(300, 600);
    return true;
  }

  public async handleDiscussion(): Promise<boolean> {
    console.log('[Adapter] Discussion prompt encountered. Replying to mark complete...');
    const context = courseraApi.getCourseContext();
    if (context && (context.itemType === 'discussionPrompt' || context.itemId)) {
      try {
        if (!this.cachedCourseId && context.courseSlug) {
          this.cachedCourseId = await courseraApi.getCourseId(context.courseSlug);
        }
        if (this.cachedCourseId && context.itemId) {
          await courseraApi.postDiscussionAnswer(
            this.cachedCourseId,
            context.itemId,
            'Valuable insights and perspectives on this topic. Thank you for the detailed explanations!'
          );
          console.log('[Adapter] Discussion answer posted via API!');
        }
      } catch (e) {
        console.warn('[Adapter] Discussion API notice:', e);
      }
    }

    // DOM fallback: fill text input and submit if present
    try {
      const editor = document.querySelector<HTMLElement>(
        'div[contenteditable="true"], textarea, div[role="textbox"]'
      );
      if (editor && this.isVisible(editor)) {
        if (editor.tagName === 'TEXTAREA') {
          (editor as HTMLTextAreaElement).value = 'Valuable insights and clear explanations. Thank you for sharing!';
          editor.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          editor.textContent = 'Valuable insights and clear explanations. Thank you for sharing!';
          editor.dispatchEvent(new Event('input', { bubbles: true }));
        }
        await human.sleep(300, 600);
        const submitBtn = document.querySelector<HTMLButtonElement>(
          'button[data-testid*="submit" i], button[data-testid*="reply" i], button[data-testid*="post" i], button[aria-label*="Reply" i]'
        );
        if (submitBtn && this.isVisible(submitBtn)) {
          await human.naturalClick(submitBtn);
        }
      }
    } catch {}

    return true;
  }

  public async completeAllItems(
    onProgress?: (current: number, total: number) => void
  ): Promise<{ success: boolean; completed: number; total: number; message: string }> {
    return courseraApi.bulkCompleteAllItems(onProgress);
  }

  public async clickNext(): Promise<boolean> {
    console.log('[Adapter] Attempting to navigate Next...');
    this.videoEndedTimestamp = null;

    // 1. High Priority: Find and click the exact "Go to next item" button in footer
    const candidateButtons = Array.from(
      document.querySelectorAll<HTMLElement>(
        'button, a[role="button"], a, [data-testid="next-item"], [data-track-component="next_item_button"]'
      )
    );

    for (const btn of candidateButtons) {
      if (!this.isVisible(btn)) continue;
      const txt = (btn.textContent || '').trim().toLowerCase();
      const aria = (btn.getAttribute('aria-label') || '').trim().toLowerCase();
      const testid = (btn.getAttribute('data-testid') || '').toLowerCase();
      const track = (btn.getAttribute('data-track-component') || '').toLowerCase();

      if (
        txt.includes('go to next item') ||
        txt.includes('go to next lesson') ||
        txt.includes('go to next') ||
        txt === 'go to' ||
        aria.includes('go to next') ||
        aria.includes('next item') ||
        testid === 'next-item' ||
        testid === 'next-button' ||
        track === 'next_item_button' ||
        btn.id === 'nextLessonBtn'
      ) {
        if (!btn.hasAttribute('disabled') && btn.getAttribute('aria-disabled') !== 'true') {
          console.log('[Adapter] High-priority click on "Go to next item" button:', txt || aria || testid);
          await human.naturalClick(btn);
          return true;
        }
      }
    }

    // 2. Syllabus Sidebar Navigation: Advance sequentially to next unique course item
    const currentUrl = window.location.href.split('?')[0].split('#')[0];
    const currentPath = window.location.pathname;

    const allCourseLinks = Array.from(
      document.querySelectorAll<HTMLAnchorElement>(
        'a[href*="/lecture/"], a[href*="/supplement/"], a[href*="/quiz/"], a[href*="/discussionprompt/"], nav[aria-label*="Course" i] a, div[class*="NavigationDrawer" i] a, div[class*="ItemNavigation" i] a'
      )
    );

    // Deduplicate by normalized pathname so we don't click the same link twice
    const uniqueCourseLinks: HTMLAnchorElement[] = [];
    const seenPaths = new Set<string>();
    for (const a of allCourseLinks) {
      if (!a.href) continue;
      try {
        const path = new URL(a.href, window.location.origin).pathname;
        if (!seenPaths.has(path)) {
          seenPaths.add(path);
          uniqueCourseLinks.push(a);
        }
      } catch {}
    }

    if (uniqueCourseLinks.length > 0) {
      const activeIdx = uniqueCourseLinks.findIndex((a) => {
        try {
          const cleanHref = a.href.split('?')[0].split('#')[0];
          const path = new URL(a.href, window.location.origin).pathname;
          return currentUrl === cleanHref || currentPath === path;
        } catch {
          return false;
        }
      });

      if (activeIdx !== -1 && activeIdx + 1 < uniqueCourseLinks.length) {
        const nextLink = uniqueCourseLinks[activeIdx + 1];
        console.log('[Adapter] Syllabus sequential advance: Navigating to next item:', nextLink.href);
        await human.naturalClick(nextLink);

        setTimeout(() => {
          if (window.location.pathname === currentPath && nextLink.href) {
            window.location.href = nextLink.href;
          }
        }, 1200);
        return true;
      }
    }

    // 3. Fallback Next Button
    const nextBtn = this.queryFirst(this.selectors.nextButton);
    if (nextBtn && !nextBtn.hasAttribute('disabled') && nextBtn.getAttribute('aria-disabled') !== 'true') {
      console.log('[Adapter] Clicking fallback Next button:', nextBtn);
      await human.naturalClick(nextBtn);
      return true;
    }

    console.log('[Adapter] Next button / link not found');
    return false;
  }

  public hasGreenCompletionTick(): boolean {
    try {
      const currentPath = window.location.pathname;
      const currentUrl = window.location.href.split('?')[0].split('#')[0];

      // 1. Locate the currently active item in the syllabus drawer
      let activeContainer: HTMLElement | null = null;
      const activeElement = document.querySelector<HTMLElement>(
        '[aria-current="page"], [aria-current="true"], li.active, [class*="activeItem" i], [class*="selectedItem" i]'
      );
      if (activeElement) {
        activeContainer = (activeElement.closest('li, [role="listitem"], div[class*="item" i]') as HTMLElement) || activeElement;
      }

      if (!activeContainer) {
        const allCourseLinks = Array.from(
          document.querySelectorAll<HTMLAnchorElement>(
            'a[href*="/lecture/"], a[href*="/supplement/"], a[href*="/quiz/"], a[href*="/discussionprompt/"], a[href*="/item/"]'
          )
        );

        for (const a of allCourseLinks) {
          if (!a.href) continue;
          const cleanHref = a.href.split('?')[0].split('#')[0];
          let linkPath = '';
          try {
            linkPath = new URL(a.href, window.location.origin).pathname;
          } catch {}

          if (cleanHref === currentUrl || (linkPath && linkPath === currentPath)) {
            activeContainer = (a.closest('li, [role="listitem"], div[class*="item" i]') as HTMLElement) || a;
            break;
          }
        }
      }

      if (activeContainer) {
        // Specifically check for completed icon/tick on THIS active lesson
        const completedNode = activeContainer.querySelector(
          '[aria-label*="Completed" i], [data-testid*="completed" i], .rc-CompletedIcon, [data-testid*="complete-icon" i]'
        );
        if (completedNode) {
          console.log('[Adapter] Green completion tick verified via aria-label/test-id on active lesson!');
          return true;
        }

        // Check SVGs inside this active item for explicit green completed tick
        const svgs = activeContainer.querySelectorAll('svg');
        for (const svg of Array.from(svgs)) {
          const aria = (svg.getAttribute('aria-label') || '').toLowerCase();
          if (aria.includes('complete') && !aria.includes('incomplete') && !aria.includes('not complete')) {
            console.log('[Adapter] Green completion tick verified via SVG aria-label:', aria);
            return true;
          }

          const fill = (svg.getAttribute('fill') || '').toLowerCase();
          const color = (svg.getAttribute('color') || '').toLowerCase();
          const style = (svg.getAttribute('style') || '').toLowerCase();
          const html = svg.outerHTML.toLowerCase();

          // STRICT: Only genuine green colors (NEVER blue / primary theme!)
          const isGreen =
            fill.includes('rgb(31, 122, 31)') ||
            fill.includes('rgb(0, 126, 51)') ||
            fill.includes('rgb(0, 103, 66)') ||
            fill.includes('rgb(19, 115, 51)') ||
            fill.includes('rgb(22, 101, 52)') ||
            fill.includes('rgb(34, 197, 94)') ||
            fill.includes('rgb(5, 150, 105)') ||
            fill.includes('#1f7a1f') ||
            fill.includes('#007e33') ||
            fill.includes('#006742') ||
            fill.includes('#059669') ||
            fill.includes('#137333') ||
            fill.includes('#166534') ||
            fill.includes('#22c55e') ||
            color.includes('green') ||
            color.includes('#1f7a1f') ||
            color.includes('#006742') ||
            style.includes('rgb(31, 122, 31)') ||
            style.includes('rgb(0, 103, 66)') ||
            style.includes('#1f7a1f') ||
            style.includes('#006742') ||
            html.includes('rc-completedicon') ||
            html.includes('cds-icon--green') ||
            html.includes('statusicon-completed') ||
            (html.includes('success') && !html.includes('blue'));

          if (isGreen) {
            console.log('[Adapter] Green completion tick verified via green SVG styling!');
            return true;
          }
        }
      }

      // Check on-page completion badge
      const onPageMarker = document.querySelector<HTMLElement>(
        '[data-testid*="item-completed" i], .rc-CompletedBanner, div[class*="CompletedBadge" i]'
      );
      if (onPageMarker && this.isVisible(onPageMarker)) {
        console.log('[Adapter] Green completion tick verified on page body!');
        return true;
      }
    } catch (e) {
      console.warn('[Adapter] Green tick verification error:', e);
    }

    return false;
  }

  public isActivityCompleted(): boolean {
    const activity = this.detectActivity();

    // 1. Page loading or undetermined: hold, do NOT advance!
    if (activity === 'unknown') {
      return false;
    }

    // 2. VIDEO ACTIVITY:
    if (activity === 'video') {
      // Immediate Pass: If Coursera already shows the green checkmark for this video in the sidebar
      if (this.hasGreenCompletionTick()) {
        console.log('[Adapter] Video confirmed complete with green tick! Ready to advance.');
        return true;
      }

      // If official Coursera API successfully marked this video complete
      const context = courseraApi.getCourseContext();
      if (context?.itemId && this.lastCompletedItemId === context.itemId) {
        console.log('[Adapter] Video confirmed complete via official API call!');
        return true;
      }

      const video = this.findVideoElement();
      if (!video) {
        // Video element not mounted yet: do NOT skip!
        return false;
      }

      if (!video.duration || isNaN(video.duration) || video.duration <= 0) {
        return false;
      }

      // STRICT: Video MUST have reached the end!
      const isEnded = video.ended || (video.currentTime >= video.duration - 0.75);
      if (!isEnded) {
        // Video is still playing: definitely NOT completed!
        return false;
      }

      // Freeze at end so it never replays from 0:00
      try {
        video.pause();
      } catch {}

      if (!this.videoEndedTimestamp) {
        this.videoEndedTimestamp = Date.now();
        console.log('[Adapter] Video playback ended. Waiting specifically for Coursera to display the green tick...');
      }

      // Check if green tick appears now
      if (this.hasGreenCompletionTick()) {
        console.log('[Adapter] Green completion tick appeared after video ended!');
        return true;
      }

      // Grace period: allow 5s after video end if Coursera's server is slow to update UI icon
      const elapsed = Date.now() - this.videoEndedTimestamp;
      if (elapsed >= 5000) {
        console.log('[Adapter] Video completed 5s ago (grace period elapsed). Advancing.');
        return true;
      }

      return false;
    }

    // 3. READING, QUIZ, DISCUSSION:
    // User requested: "if the disccussion quiz or reading any appear then skip it"
    return true;
  }
}
