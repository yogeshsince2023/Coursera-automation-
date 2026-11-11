import { createActor } from 'xstate';
import { automationMachine } from '../src/automation/orchestrator';
import { CourseraAdapter } from '../src/platforms/coursera/adapter';
import { human } from '../src/stealth/human';
import { DEFAULT_SETTINGS, type AutomationSettings } from '../src/types';

export default defineContentScript({
  matches: [
    '*://*.coursera.org/*',
    '<all_urls>'
  ],
  runAt: 'document_idle',
  main() {
    console.log('%c[Study Assistant TS]%c Content script injected and active on page!', 'color:#4f46e5;font-weight:bold;font-size:14px', 'color:inherit');

    // 1. Inject Visibility & Background Throttling Bypass directly into page context
    try {
      const script = document.createElement('script');
      script.textContent = `
        (function() {
          try {
            Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
            Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
            Object.defineProperty(document, 'webkitHidden', { get: () => false, configurable: true });
            Object.defineProperty(document, 'webkitVisibilityState', { get: () => 'visible', configurable: true });
          } catch(e) {}

          const stopEvents = function(e) {
            e.stopImmediatePropagation();
          };
          window.addEventListener('visibilitychange', stopEvents, true);
          document.addEventListener('visibilitychange', stopEvents, true);
          window.addEventListener('blur', stopEvents, true);
          window.addEventListener('focusout', stopEvents, true);

          // Prevent Coursera video player from pausing on tab blur/change
          document.addEventListener('pause', function(e) {
            const el = e.target;
            if (el && el.tagName === 'VIDEO') {
              if (!el.ended && (el.duration <= 0 || el.currentTime < el.duration - 0.75)) {
                setTimeout(() => {
                  if (el.paused && !el.ended) {
                    el.play().catch(() => {});
                  }
                }, 50);
              }
            }
          }, true);
        })();
      `;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    } catch (e) {
      console.warn('[Study Assistant TS] Visibility injection note:', e);
    }

    try {
      Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
      Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
    } catch {}
    window.addEventListener('visibilitychange', (e) => e.stopImmediatePropagation(), true);
    document.addEventListener('visibilitychange', (e) => e.stopImmediatePropagation(), true);

    try {
      let currentSettings: AutomationSettings = {
        ...DEFAULT_SETTINGS,
        enabled: true,
        autoVideo: true,
        autoReading: true,
        autoNext: true,
        autoQuiz: true,
        autoDiscussion: true,
        fastVideo: true,
        videoSpeed: 16.0
      };

      const adapter = new CourseraAdapter();

      const orchestratorActor = createActor(automationMachine, {
        input: {
          adapter,
          settings: currentSettings,
          consecutiveErrors: 0
        }
      });

      // Floating indicator badge
      function ensureOverlay(): HTMLElement {
        let overlay = document.getElementById('study-assistant-overlay');
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.id = 'study-assistant-overlay';
          overlay.style.cssText = `
            position: fixed;
            top: 14px;
            right: 140px;
            z-index: 2147483647;
            background: rgba(15, 23, 42, 0.96);
            backdrop-filter: blur(8px);
            color: #f8fafc;
            border: 1.5px solid #6366f1;
            border-radius: 20px;
            padding: 6px 14px;
            font-size: 12px;
            font-weight: 600;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            gap: 8px;
            user-select: none;
            cursor: pointer;
            transition: all 0.2s ease;
          `;
          overlay.innerHTML = `
            <span style="width:10px;height:10px;border-radius:50%;background:#10b981;display:inline-block;box-shadow:0 0 8px #10b981;" id="study-status-dot"></span>
            <span id="study-status-text">Coursera Auto-Pilot: ACTIVE</span>
          `;
          (document.body || document.documentElement).appendChild(overlay);

          overlay.addEventListener('click', () => {
            currentSettings.enabled = !currentSettings.enabled;
            try {
              chrome.storage.local.set({ enabled: currentSettings.enabled });
            } catch {}
            orchestratorActor.send({ type: 'UPDATE_SETTINGS', settings: currentSettings });
            updateOverlay(currentSettings.enabled, currentSettings.enabled ? 'Running' : 'Paused');
            if (currentSettings.enabled) {
              human.startIdleHeartbeat();
              orchestratorActor.send({ type: 'TICK' });
            } else {
              human.stopIdleHeartbeat();
            }
          });
        }
        return overlay;
      }

      ensureOverlay();

      const STATE_LABELS: Record<string, string> = {
        idle: 'Ready / Waiting',
        detecting: 'Analyzing Lesson',
        handlingVideo: 'Playing Video (16x Accelerated)',
        waitingCompletion: 'Watching & Syncing Video',
        handlingReading: 'Reading Item ➔ Skipping',
        handlingQuiz: 'Quiz Assessment ➔ Skipping',
        handlingDiscussion: 'Discussion Prompt ➔ Skipping',
        handlingModal: 'Closing Dialog',
        advancing: 'Advancing to Next Item ➔',
        cooldown: 'Loading Next Lesson...',
        recovery: 'Auto-Recovering'
      };

      function updateOverlay(active: boolean, stateName?: string) {
        ensureOverlay();
        const dot = document.getElementById('study-status-dot');
        const text = document.getElementById('study-status-text');
        if (dot && text) {
          if (!active) {
            dot.style.background = '#ef4444';
            dot.style.boxShadow = 'none';
            text.textContent = 'Coursera Auto-Pilot: PAUSED (Click to Start)';
            return;
          }

          dot.style.background = '#10b981';
          dot.style.boxShadow = '0 0 8px #10b981';

          // Immediate green tick indication
          if (adapter.hasGreenCompletionTick()) {
            text.textContent = '✅ Completed (Green Tick) ➔ Advancing';
            return;
          }

          const currentSnap = stateName || String(orchestratorActor.getSnapshot()?.value || 'idle');
          if (currentSnap === 'handlingVideo' || currentSnap === 'waitingCompletion') {
            const prog = adapter.getVideoProgress();
            if (prog && prog.duration > 0) {
              const formatSec = (s: number) => {
                const m = Math.floor(s / 60);
                const sec = Math.floor(s % 60);
                return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
              };
              text.textContent = `📹 Playing (16x): ${prog.percent}% (${formatSec(prog.current)} / ${formatSec(prog.duration)})`;
              return;
            }
          }

          const friendly = STATE_LABELS[currentSnap] || currentSnap.toUpperCase();
          text.textContent = `Coursera Auto-Pilot: ${friendly}`;
        }
      }

      orchestratorActor.subscribe((snapshot) => {
        console.log('[Orchestrator State Transition]:', snapshot.value);
        updateOverlay(currentSettings.enabled, String(snapshot.value));
      });

      // Periodic UI ticker for real-time video percentage
      setInterval(() => {
        if (currentSettings.enabled) {
          updateOverlay(true);
        }
      }, 1000);

      // Start engine
      human.startIdleHeartbeat();
      orchestratorActor.start();
      orchestratorActor.send({ type: 'TICK' });

      // SPA Navigation Monitoring (history pushState/replaceState/popstate & URL polling)
      let lastUrl = window.location.href;
      const onUrlChange = () => {
        if (window.location.href !== lastUrl) {
          console.log('[Study Assistant TS] Route changed to:', window.location.href);
          lastUrl = window.location.href;
          if (currentSettings.enabled) {
            orchestratorActor.send({ type: 'ROUTE_CHANGE' });
          }
        }
      };

      window.addEventListener('popstate', onUrlChange);

      try {
        const origPushState = history.pushState;
        history.pushState = function (...args) {
          origPushState.apply(this, args);
          setTimeout(onUrlChange, 100);
        };
        const origReplaceState = history.replaceState;
        history.replaceState = function (...args) {
          origReplaceState.apply(this, args);
          setTimeout(onUrlChange, 100);
        };
      } catch {}

      setInterval(onUrlChange, 1000);

      // Direct Message Listener from Background and Popup
      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message.action === 'BACKGROUND_HEARTBEAT') {
          if (currentSettings.enabled) {
            // Keep background video playing uninterrupted at 16x
            const vid = adapter.findVideoElement();
            if (vid) {
              const isEnded = vid.ended || (vid.duration > 0 && vid.currentTime >= vid.duration - 0.75);
              if (!isEnded) {
                try {
                  if (vid.playbackRate !== 16.0) vid.playbackRate = 16.0;
                  if (vid.paused) vid.play().catch(() => {});
                } catch {}
              }
            }

            const snap = orchestratorActor.getSnapshot();
            if (snap?.value === 'idle') {
              orchestratorActor.send({ type: 'TICK' });
            }
          }
          sendResponse({ acknowledged: true });
          return true;
        }

        console.log('[Study Assistant TS] Received message action:', message);
        if (message.action === 'SKIP_VIDEO') {
          const video = adapter.findVideoElement();
          if (video && video.duration) {
            try {
              video.currentTime = video.duration - 0.5;
              video.dispatchEvent(new Event('timeupdate', { bubbles: true }));
              video.play().catch(() => {});
            } catch {
              video.playbackRate = 16.0;
            }
          }
          setTimeout(() => adapter.clickNext(), 1000);
          sendResponse({ success: true });
        } else if (message.action === 'NEXT_ITEM') {
          adapter.clickNext().then((ok) => sendResponse({ success: ok }));
          return true;
        } else if (message.action === 'MARK_READING') {
          adapter.handleReading().then(() => sendResponse({ success: true }));
          return true;
        }
        return true;
      });

      // Storage sync: Default to ACTIVE on startup
      try {
        chrome.storage.local.get(null, (stored) => {
          currentSettings.enabled = true;
          if (stored) {
            currentSettings = { ...currentSettings, ...stored, enabled: true };
          }
          try { chrome.storage.local.set({ enabled: true }); } catch {}
          orchestratorActor.send({ type: 'UPDATE_SETTINGS', settings: currentSettings });
          updateOverlay(true, 'Running');
          human.startIdleHeartbeat();
          orchestratorActor.send({ type: 'TICK' });
        });

        chrome.storage.onChanged.addListener((changes) => {
          for (const [key, change] of Object.entries(changes)) {
            if (key in currentSettings) {
              (currentSettings as any)[key] = change.newValue;
            }
          }
          orchestratorActor.send({ type: 'UPDATE_SETTINGS', settings: currentSettings });
          if (changes.enabled) {
            if (changes.enabled.newValue) {
              human.startIdleHeartbeat();
              orchestratorActor.send({ type: 'TICK' });
              updateOverlay(true, 'Running');
            } else {
              human.stopIdleHeartbeat();
              updateOverlay(false, 'Paused');
            }
          }
        });
      } catch (err) {
        console.warn('[Study Assistant TS] Storage sync notice:', err);
      }

      // Safe heartbeat: pulse TICK when idle
      setInterval(() => {
        if (currentSettings.enabled) {
          const snap = orchestratorActor.getSnapshot();
          if (snap.value === 'idle') {
            orchestratorActor.send({ type: 'TICK' });
          }
        }
      }, 1000);

    } catch (e) {
      console.error('[Study Assistant TS] Startup error:', e);
    }
  }
});
