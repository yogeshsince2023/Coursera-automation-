import React, { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  Zap,
  BookOpen,
  Video,
  HelpCircle,
  MessageSquare,
  CheckCircle2,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { DEFAULT_SETTINGS, type AutomationSettings } from '../../src/types';

export default function App() {
  const [settings, setSettings] = useState<AutomationSettings>({
    ...DEFAULT_SETTINGS,
    fastVideo: true,
  });
  const [bulkStatus, setBulkStatus] = useState<string | null>(null);
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [activePlatform, setActivePlatform] = useState<string>('Coursera / LinkedIn');

  useEffect(() => {
    chrome.storage.local.get(null, (stored) => {
      if (stored) {
        setSettings((prev) => ({
          ...prev,
          ...stored,
          fastVideo: true,
        }));
      }
    });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url || '';
      if (url.includes('coursera.org')) {
        setActivePlatform('Coursera Detected');
      } else if (url.includes('linkedin.com')) {
        setActivePlatform('LinkedIn Learning Detected');
      }
    });

    const listener = (msg: any) => {
      if (msg.action === 'BULK_PROGRESS') {
        setBulkStatus(`Completed ${msg.current}/${msg.total} items...`);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const updateSetting = <K extends keyof AutomationSettings>(key: K, value: AutomationSettings[K]) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    chrome.storage.local.set({ [key]: value });
  };

  const sendAction = async (action: string) => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { action });
      }
    } catch (e) {
      console.warn('Action dispatch notice:', e);
    }
  };

  const handleCompleteAll = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || (!tab.url?.includes('coursera.org') && !tab.url?.includes('linkedin.com'))) {
        alert('Please open an active Coursera or LinkedIn Learning course tab first.');
        return;
      }
      setIsBulkRunning(true);
      setBulkStatus('Starting full course completion...');
      chrome.tabs.sendMessage(tab.id, { action: 'COMPLETE_ALL' }, (res) => {
        setIsBulkRunning(false);
        if (chrome.runtime.lastError) {
          setBulkStatus(null);
          alert('Could not connect to active course page. Please refresh the page (F5) and try again.');
          return;
        }
        if (res?.message) {
          setBulkStatus(res.message);
          setTimeout(() => setBulkStatus(null), 4000);
        } else {
          setBulkStatus('All items completed!');
          setTimeout(() => setBulkStatus(null), 4000);
        }
      });
    } catch (e: any) {
      setIsBulkRunning(false);
      setBulkStatus(null);
      alert('Notice: ' + e?.message);
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-base font-bold bg-gradient-to-r from-indigo-400 via-sky-300 to-emerald-400 bg-clip-text text-transparent">
              Auto-Pilot Extension
            </h1>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800/80 font-mono font-semibold">
              v3.6
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">{activePlatform}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              settings.enabled
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
            }`}
          />
          <span className="text-xs font-semibold text-slate-300">
            {settings.enabled ? 'Active' : 'Paused'}
          </span>
        </div>
      </div>

      {/* Main Switch Card */}
      <div
        className={`p-3 rounded-xl border transition-all ${
          settings.enabled
            ? 'bg-gradient-to-br from-indigo-950/60 to-slate-900 border-indigo-500/40 shadow-lg shadow-indigo-950/30'
            : 'bg-slate-800/30 border-slate-800'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-lg ${
                settings.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {settings.enabled ? <Play className="w-4 h-4 fill-emerald-400" /> : <Pause className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200">
                {settings.enabled ? 'Automation Running' : 'Automation Paused'}
              </div>
              <div className="text-[11px] text-slate-400">
                {settings.enabled ? 'Auto-watching & completing' : 'Click start to resume'}
              </div>
            </div>
          </div>
          <button
            onClick={() => updateSetting('enabled', !settings.enabled)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              settings.enabled
                ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30'
            }`}
          >
            {settings.enabled ? 'Pause' : 'Start'}
          </button>
        </div>
      </div>

      {/* 1-Click Course Completion */}
      <div className="space-y-2">
        <button
          onClick={handleCompleteAll}
          disabled={isBulkRunning}
          className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <Sparkles className="w-4 h-4 text-amber-300 group-hover:rotate-12 transition-transform" />
          <span>{isBulkRunning ? 'Processing Course...' : 'Complete Entire Course (1-Click)'}</span>
        </button>

        {bulkStatus && (
          <div className="text-[11px] font-semibold text-center py-1.5 px-2 rounded-lg bg-indigo-950/80 border border-indigo-700/60 text-indigo-200 animate-pulse">
            {bulkStatus}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => sendAction('COMPLETE_ITEM')}
            className="py-2 px-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-emerald-300 border border-slate-700/80 text-xs font-semibold transition flex items-center justify-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>Complete Item</span>
          </button>
          <button
            onClick={() => sendAction('NEXT_ITEM')}
            className="py-2 px-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-sky-300 border border-slate-700/80 text-xs font-semibold transition flex items-center justify-center gap-1.5"
          >
            <span>Next Lesson</span>
            <ChevronRight className="w-3.5 h-3.5 text-sky-400" />
          </button>
        </div>
      </div>

      {/* Automation Features */}
      <div className="space-y-1.5 pt-1">
        <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
          Automation Modules
        </div>

        <div className="space-y-1.5">
          <label className="flex items-center justify-between p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 border border-slate-800/60 transition cursor-pointer text-xs">
            <span className="flex items-center gap-2 text-slate-200">
              <Video className="w-3.5 h-3.5 text-indigo-400" /> Auto-Complete Videos (API/16x)
            </span>
            <input
              type="checkbox"
              checked={settings.autoVideo}
              onChange={(e) => updateSetting('autoVideo', e.target.checked)}
              className="rounded border-slate-700 text-indigo-600 focus:ring-0 w-4 h-4 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 border border-slate-800/60 transition cursor-pointer text-xs">
            <span className="flex items-center gap-2 text-slate-200">
              <BookOpen className="w-3.5 h-3.5 text-sky-400" /> Auto-Complete Readings
            </span>
            <input
              type="checkbox"
              checked={settings.autoReading}
              onChange={(e) => updateSetting('autoReading', e.target.checked)}
              className="rounded border-slate-700 text-indigo-600 focus:ring-0 w-4 h-4 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 border border-slate-800/60 transition cursor-pointer text-xs">
            <span className="flex items-center gap-2 text-slate-200">
              <MessageSquare className="w-3.5 h-3.5 text-teal-400" /> Auto-Reply Discussions
            </span>
            <input
              type="checkbox"
              checked={settings.autoDiscussion}
              onChange={(e) => updateSetting('autoDiscussion', e.target.checked)}
              className="rounded border-slate-700 text-indigo-600 focus:ring-0 w-4 h-4 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 border border-slate-800/60 transition cursor-pointer text-xs">
            <span className="flex items-center gap-2 text-slate-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Auto-Advance (Next)
            </span>
            <input
              type="checkbox"
              checked={settings.autoNext}
              onChange={(e) => updateSetting('autoNext', e.target.checked)}
              className="rounded border-slate-700 text-indigo-600 focus:ring-0 w-4 h-4 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 border border-slate-800/60 transition cursor-pointer text-xs">
            <span className="flex items-center gap-2 text-slate-200">
              <HelpCircle className="w-3.5 h-3.5 text-fuchsia-400" /> Auto-Skip Quizzes
            </span>
            <input
              type="checkbox"
              checked={settings.autoQuiz}
              onChange={(e) => updateSetting('autoQuiz', e.target.checked)}
              className="rounded border-slate-700 text-indigo-600 focus:ring-0 w-4 h-4 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-2 border-t border-slate-800/80 text-center">
        <span className="text-[10px] text-slate-500 font-medium">
          Works in active and background tabs seamlessly
        </span>
      </div>
    </div>
  );
}
