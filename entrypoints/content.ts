import { createActor } from 'xstate';
import { automationMachine } from '../src/automation/orchestrator';
import { getPlatformAdapter, type PlatformAdapter } from '../src/platforms';
import { human } from '../src/stealth/human';
import { DEFAULT_SETTINGS, type AutomationSettings } from '../src/types';

export default defineContentScript({
  matches: [
    '*://*.coursera.org/*',
    '*://*.linkedin.com/*',
    'http://localhost/*' // popup's "Open Test Simulator"
  ],
  runAt: 'document_idle',
  main() {
    console.log('%c[Study Assistant TS]%c Content script injected and active on page!', 'color:#4f46e5;font-weight:bold;font-size:14px', 'color:inherit');

    // 1. CSP-compliant Visibility & Background Tab Bypass (Zero inline script injection)
    try {
      Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
      Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
      Object.defineProperty(document, 'webkitHidden', { get: () => false, configurable: true });
      Object.defineProperty(document, 'webkitVisibilityState', { get: () => 'visible', configurable: true });
    } catch {}

    const stopEvents = (e: Event) => {
      e.stopImmediatePropagation();
    };
    window.addEventListener('visibilitychange', stopEvents, true);
    document.addEventListener('visibilitychange', stopEvents, true);
    window.addEventListener('blur', stopEvents, true);
    window.addEventListener('focusout', stopEvents, true);

    // Prevent video player from pausing on tab blur/change
    document.addEventListener('pause', (e: Event) => {
      const el = e.target as HTMLVideoElement;
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
        videoSpeed: 2.0
      };

      const adapter: PlatformAdapter = getPlatformAdapter();
      const platformName = adapter.name || 'Coursera';

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
            gap: 10px;
            user-select: none;
            transition: all 0.2s ease;
          `;

          const statusBtn = document.createElement('div');
          statusBtn.id = 'study-status-btn';
          statusBtn.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;';
          statusBtn.innerHTML = `
            <span style="width:10px;height:10px;border-radius:50%;background:#10b981;display:inline-block;box-shadow:0 0 8px #10b981;" id="study-status-dot"></span>
            <span id="study-status-text">${platformName} Auto-Pilot: ACTIVE</span>
          `;

          statusBtn.addEventListener('click', () => {
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

          overlay.appendChild(statusBtn);

          // If platform has bulk completion capabilities (e.g. Coursera API), render one-click complete button
          if (typeof adapter.completeAllItems === 'function') {
            const bulkBtn = document.createElement('button');
            bulkBtn.id = 'study-bulk-btn';
            bulkBtn.textContent = '⚡ Complete All';
            bulkBtn.style.cssText = `
              background: linear-gradient(135deg, #6366f1, #4f46e5);
              color: white;
              border: none;
              border-radius: 12px;
              padding: 3px 8px;
              font-size: 11px;
              font-weight: 700;
              cursor: pointer;
              transition: transform 0.1s, opacity 0.2s;
            `;
            bulkBtn.addEventListener('mouseenter', () => { bulkBtn.style.transform = 'scale(1.05)'; });
            bulkBtn.addEventListener('mouseleave', () => { bulkBtn.style.transform = 'scale(1)'; });
            bulkBtn.addEventListener('click', async (e) => {
              e.stopPropagation();
              const proceed = confirm('Complete all videos and reading supplements in this course right now?');
              if (!proceed) return;

              bulkBtn.disabled = true;
              bulkBtn.textContent = '⏳ Starting...';
              try {
                const res = await adapter.completeAllItems!((cur, tot) => {
                  bulkBtn.textContent = `⏳ ${cur}/${tot}`;
                });
                alert(res.message);
                bulkBtn.textContent = '✅ Done!';
                setTimeout(() => {
                  window.location.reload();
                }, 1000);
              } catch (err: any) {
                alert('Completion notice: ' + (err?.message || 'Check connection'));
                bulkBtn.textContent = '⚡ Complete All';
                bulkBtn.disabled = false;
              }
            });
            overlay.appendChild(bulkBtn);
          }

          (document.body || document.documentElement).appendChild(overlay);
        }
        return overlay;
      }

      ensureOverlay();

      const STATE_LABELS: Record<string, string> = {
        idle: 'Ready / Waiting',
        detecting: 'Analyzing Lesson',
        handlingVideo: 'Accelerating Video',
        waitingCompletion: 'Watching & Syncing Video',
        handlingReading: 'Reading Item ➔ Completed',
        handlingQuiz: 'Quiz Assessment ➔ Skipping',
        handlingDiscussion: 'Discussion Prompt ➔ Completed',
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
            text.textContent = `${platformName} Auto-Pilot: PAUSED`;
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
              text.textContent = `📹 Playing: ${prog.percent}% (${formatSec(prog.current)} / ${formatSec(prog.duration)})`;
              return;
            }
          }

          const friendly = STATE_LABELS[currentSnap] || currentSnap.toUpperCase();
          text.textContent = `${platformName} Auto-Pilot: ${friendly}`;
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
            // Keep background video playing uninterrupted at 2x
            const vid = adapter.findVideoElement();
            if (vid) {
              const isEnded = vid.ended || (vid.duration > 0 && vid.currentTime >= vid.duration - 0.75);
              if (!isEnded) {
                try {
                  if (vid.playbackRate !== 2.0) vid.playbackRate = 2.0;
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
        if (message.action === 'COMPLETE_ITEM' || message.action === 'SKIP_VIDEO') {
          (async () => {
            const act = adapter.detectActivity();
            console.log('[Study Assistant TS] Immediate complete requested for activity:', act);
            if (act === 'video') {
              await adapter.handleVideo(16.0, true);
              const video = adapter.findVideoElement();
              if (video && video.duration) {
                try {
                  video.currentTime = video.duration - 0.5;
                  video.dispatchEvent(new Event('timeupdate', { bubbles: true }));
                  video.play().catch(() => {});
                } catch {}
              }
              setTimeout(() => adapter.clickNext(), 1000);
            } else if (act === 'reading') {
              await adapter.handleReading();
              setTimeout(() => adapter.clickNext(), 600);
            } else if (act === 'discussion') {
              await adapter.handleDiscussion();
              setTimeout(() => adapter.clickNext(), 600);
            } else {
              await adapter.clickNext();
            }
          })();
          sendResponse({ success: true });
          return true;
        } else if (message.action === 'NEXT_ITEM') {
          adapter.clickNext().then((ok) => sendResponse({ success: ok }));
          return true;
        } else if (message.action === 'MARK_READING') {
          adapter.handleReading().then(() => sendResponse({ success: true }));
          return true;
        } else if (message.action === 'COMPLETE_ALL') {
          if (typeof adapter.completeAllItems === 'function') {
            adapter.completeAllItems((c, t) => {
              chrome.runtime.sendMessage({ action: 'BULK_PROGRESS', current: c, total: t }).catch(() => {});
            }).then((res) => {
              sendResponse(res);
            });
            return true;
          } else {
            sendResponse({ success: false, message: 'Platform does not support bulk completion' });
            return true;
          }
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
