import type { ActivityType } from '../../types';
import { human } from '../../stealth/human';
import type { PlatformAdapter } from '../coursera/adapter';

export class LinkedInLearningAdapter implements PlatformAdapter {
  public name = 'LinkedIn Learning';
  private videoEndedTimestamp: number | null = null;

  private selectors = {
    nextButton: [
      'button[data-control-name="next_item"]',
      'a[data-control-name="next_item"]',
      'button[data-test-id="next-button"]',
      'button[aria-label*="next item" i]',
      'button[aria-label*="next video" i]',
      'button[aria-label*="next" i]',
      'button.classroom-nav__next-button',
      'div.classroom-layout-sidebar button.next-item',
    ],
    video: [
      'video',
      'div.classroom-video-player video',
      'div.video-player video',
      'video.vjs-tech',
    ],
    playButton: [
      'button[data-control-name="play_button"]',
      'button[aria-label*="Play" i]',
      'button.vjs-big-play-button',
      'button.classroom-player-controls__play-button',
    ],
    quizOptions: [
      'div.classroom-quiz input[type="radio"]',
      'div.quiz-question input[type="radio"]',
      'fieldset input[type="radio"]',
    ],
    quizSubmit: [
      'button[data-control-name="quiz_submit"]',
      'button[data-control-name="quiz_next"]',
      'button[data-test-id="quiz-submit-btn"]',
      'button[aria-label*="Submit" i]',
      'button[aria-label*="Next question" i]',
    ],
  };

  private isVisible(el: HTMLElement): boolean {
    if (!el) return false;
    try {
      if (typeof window !== 'undefined') {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          return false;
        }
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
      } catch {}
    }
    return null;
  }

  public findVideoElement(): HTMLVideoElement | null {
    const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video'));
    for (const v of videos) {
      if (this.isVisible(v)) return v;
    }
    return document.querySelector<HTMLVideoElement>('video');
  }

  public detectActivity(): ActivityType {
    const url = window.location.href.toLowerCase();

    // 1. Modals / Dialogs
    const dialog = document.querySelector('div[role="dialog"], div.artdeco-modal');
    if (dialog && this.isVisible(dialog as HTMLElement)) {
      return 'modal';
    }

    // 2. Quiz / Knowledge Checks
    if (url.includes('/quiz/') || document.querySelector('div.classroom-quiz, div[data-test-id*="quiz"]')) {
      return 'quiz';
    }

    // 3. Video activity (primary on LinkedIn Learning)
    if (url.includes('/learning/') || this.findVideoElement()) {
      return 'video';
    }

    return 'unknown';
  }

  public async handleModal(): Promise<boolean> {
    console.log('[LinkedIn Adapter] Handling active dialog...');
    const modalButtons = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        'div[role="dialog"] button, div.artdeco-modal button'
      )
    );
    for (const btn of modalButtons) {
      if (this.isVisible(btn)) {
        const txt = btn.textContent?.trim().toLowerCase() || '';
        if (txt.includes('continue') || txt.includes('next') || txt.includes('got it') || txt.includes('dismiss')) {
          await human.naturalClick(btn);
          return true;
        }
      }
    }
    return false;
  }

  public async handleVideo(speed: number, fastVideo: boolean): Promise<boolean> {
    const video = this.findVideoElement();
    if (!video) {
      // Click play trigger if visible
      for (const sel of this.selectors.playButton) {
        const btn = document.querySelector<HTMLElement>(sel);
        if (btn && this.isVisible(btn)) {
          btn.click();
          break;
        }
      }
      return false;
    }

    // 1. Mute video for reliable playback in background tabs
    video.muted = true;
    video.volume = 0;
    video.defaultMuted = true;

    // 2. Playback speed acceleration (16x for rapid completion)
    const targetSpeed = fastVideo ? 16.0 : Math.min(speed, 2.0);
    try {
      if (video.playbackRate !== targetSpeed) {
        video.playbackRate = targetSpeed;
      }
    } catch {
      try { video.playbackRate = 8.0; } catch { video.playbackRate = 2.0; }
    }

    // 3. Completion check
    const isEnded = video.ended || (video.duration > 0 && video.currentTime >= video.duration - 0.75);
    if (isEnded) {
      try { video.pause(); } catch {}
      if (!this.videoEndedTimestamp) {
        this.videoEndedTimestamp = Date.now();
        console.log('[LinkedIn Adapter] Video reached end. Waiting for completion checkmark...');
      }
      return true;
    }

    // 4. Video is playing: Ensure it is unpaused
    this.videoEndedTimestamp = null;
    if (video.paused) {
      for (const sel of this.selectors.playButton) {
        const btn = document.querySelector<HTMLElement>(sel);
        if (btn && this.isVisible(btn)) {
          btn.click();
          break;
        }
      }
      try {
        const p = video.play();
        if (p !== undefined) p.catch(() => {});
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
      speed: video.playbackRate || 1.0,
    };
  }

  public async handleReading(): Promise<boolean> {
    console.log('[LinkedIn Adapter] Reading / article encountered.');
    await human.sleep(500, 1000);
    return true;
  }

  public async handleQuiz(): Promise<boolean> {
    console.log('[LinkedIn Adapter] Quiz item encountered.');
    // Select first option if available
    const radio = this.queryFirst(this.selectors.quizOptions);
    if (radio) {
      radio.click();
      await human.sleep(300, 600);
    }
    const submitBtn = this.queryFirst(this.selectors.quizSubmit);
    if (submitBtn) {
      await human.naturalClick(submitBtn);
    }
    return true;
  }

  public async handleDiscussion(): Promise<boolean> {
    return true;
  }

  public hasGreenCompletionTick(): boolean {
    try {
      const currentUrl = window.location.href.split('?')[0].split('#')[0];
      const currentPath = window.location.pathname;

      // Check Table of Contents in LinkedIn sidebar
      const tocLinks = Array.from(
        document.querySelectorAll<HTMLAnchorElement>(
          'a.classroom-toc-item__link, a[data-control-name="toc_item"], div.classroom-toc-item a'
        )
      );

      for (const a of tocLinks) {
        if (!a.href) continue;
        const cleanHref = a.href.split('?')[0].split('#')[0];
        let linkPath = '';
        try { linkPath = new URL(a.href, window.location.origin).pathname; } catch {}

        if (cleanHref === currentUrl || (linkPath && linkPath === currentPath)) {
          const container = a.closest('li, div.classroom-toc-item, button.classroom-toc-item') as HTMLElement || a;
          const completedIndicator = container.querySelector(
            'svg[data-test-icon="check-small"], li-icon[type="check"], [aria-label*="completed" i], .is-completed'
          );
          if (completedIndicator) {
            console.log('[LinkedIn Adapter] Checkmark verified on active TOC item!');
            return true;
          }
        }
      }
    } catch (e) {
      console.warn('[LinkedIn Adapter] Completion tick check notice:', e);
    }
    return false;
  }

  public isActivityCompleted(): boolean {
    const activity = this.detectActivity();
    if (activity === 'unknown') return false;

    if (activity === 'video') {
      if (this.hasGreenCompletionTick()) return true;

      const video = this.findVideoElement();
      if (!video || !video.duration || isNaN(video.duration) || video.duration <= 0) return false;

      const isEnded = video.ended || (video.currentTime >= video.duration - 0.75);
      if (!isEnded) return false;

      if (!this.videoEndedTimestamp) {
        this.videoEndedTimestamp = Date.now();
        return false;
      }

      // 2s sync grace period
      if (Date.now() - this.videoEndedTimestamp >= 2000) {
        return true;
      }
      return false;
    }

    return true;
  }

  public async clickNext(): Promise<boolean> {
    console.log('[LinkedIn Adapter] Advancing to next lesson...');
    this.videoEndedTimestamp = null;

    // 1. Click Next button in video control bar / nav
    const nextBtn = this.queryFirst(this.selectors.nextButton);
    if (nextBtn) {
      console.log('[LinkedIn Adapter] Clicking next button:', nextBtn);
      nextBtn.click();
      await human.naturalClick(nextBtn);
      return true;
    }

    // 2. Sequential Table of Contents navigation
    const currentUrl = window.location.href.split('?')[0].split('#')[0];
    const currentPath = window.location.pathname;

    const tocLinks = Array.from(
      document.querySelectorAll<HTMLAnchorElement>(
        'a.classroom-toc-item__link, a[data-control-name="toc_item"]'
      )
    );

    const uniqueLinks: HTMLAnchorElement[] = [];
    const seen = new Set<string>();
    for (const a of tocLinks) {
      if (!a.href) continue;
      try {
        const path = new URL(a.href, window.location.origin).pathname;
        if (!seen.has(path)) {
          seen.add(path);
          uniqueLinks.push(a);
        }
      } catch {}
    }

    if (uniqueLinks.length > 0) {
      const activeIdx = uniqueLinks.findIndex((a) => {
        try {
          const path = new URL(a.href, window.location.origin).pathname;
          return currentPath === path || currentUrl === a.href.split('?')[0];
        } catch {
          return false;
        }
      });

      if (activeIdx !== -1 && activeIdx + 1 < uniqueLinks.length) {
        const nextTarget = uniqueLinks[activeIdx + 1];
        console.log('[LinkedIn Adapter] Navigating TOC to next item:', nextTarget.href);
        nextTarget.click();
        await human.naturalClick(nextTarget);

        const targetUrl = nextTarget.href;
        setTimeout(() => {
          if (window.location.pathname === currentPath) {
            window.location.href = targetUrl;
          }
        }, 1000);
        return true;
      }
    }

    return false;
  }
}
