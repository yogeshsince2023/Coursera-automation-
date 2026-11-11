export default defineBackground(() => {
  console.log('[Background Service Worker] Coursera Study Assistant active.');

  chrome.runtime.onInstalled.addListener(() => {
    try {
      chrome.storage.local.set({ enabled: true });
    } catch {}
  });

  // Background Keep-Alive & Active Tab Pacer:
  // Chrome throttles timers in inactive/background tabs. Pinging open Coursera tabs
  // ensures continuous 16x video playback and auto-advancing even when the tab is hidden!
  setInterval(() => {
    try {
      chrome.tabs.query({ url: '*://*.coursera.org/*' }, (tabs) => {
        if (!tabs || chrome.runtime.lastError) return;
        for (const tab of tabs) {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { action: 'BACKGROUND_HEARTBEAT' }).catch(() => {});
          }
        }
      });
    } catch {}
  }, 1000);
});
