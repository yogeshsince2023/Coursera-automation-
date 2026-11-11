import React, { useEffect, useState } from 'react';
import { Play, Pause, BookOpen, Video, HelpCircle, MessageSquare, FastForward, CheckCircle2 } from 'lucide-react';
import { DEFAULT_SETTINGS, type AutomationSettings } from '../../src/types';

export default function App() {
  const [settings, setSettings] = useState<AutomationSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    chrome.storage.local.get(null, (stored) => {
      if (stored) {
        setSettings((prev) => ({ ...prev, ...stored }));
      }
    });
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h1 className="text-base font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
            Study Assistant TS
          </h1>
          <p className="text-xs text-slate-400">Autonomous Course Pacer</p>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800 font-mono">
          v3.5
        </span>
      </div>

      {/* Main Switch */}
      <div className={`p-3 rounded-lg border flex items-center justify-between transition-colors ${
        settings.enabled ? 'bg-indigo-950/40 border-indigo-600/50' : 'bg-slate-800/40 border-slate-700'
      }`}>
        <div className="flex items-center gap-2">
          {settings.enabled ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4 text-slate-400" />}
          <span className="text-sm font-semibold">{settings.enabled ? 'ACTIVE' : 'PAUSED'}</span>
        </div>
        <button
          onClick={() => updateSetting('enabled', !settings.enabled)}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
            settings.enabled 
              ? 'bg-rose-500 hover:bg-rose-600 text-white' 
              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20'
          }`}
        >
          {settings.enabled ? 'Stop' : 'Start Engine'}
        </button>
      </div>

      {/* Module Toggles */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Automation Modules</div>

        <label className="flex items-center justify-between p-2 rounded bg-slate-800/50 hover:bg-slate-800 transition cursor-pointer text-xs">
          <span className="flex items-center gap-2">
            <Video className="w-3.5 h-3.5 text-indigo-400" /> Auto-play Videos
          </span>
          <input
            type="checkbox"
            checked={settings.autoVideo}
            onChange={(e) => updateSetting('autoVideo', e.target.checked)}
            className="rounded border-slate-700 text-indigo-600 focus:ring-0"
          />
        </label>

        <label className="flex items-center justify-between p-2 rounded bg-slate-800/50 hover:bg-slate-800 transition cursor-pointer text-xs">
          <span className="flex items-center gap-2">
            <FastForward className="w-3.5 h-3.5 text-amber-400" /> Fast-Forward Video
          </span>
          <input
            type="checkbox"
            checked={settings.fastVideo}
            onChange={(e) => updateSetting('fastVideo', e.target.checked)}
            className="rounded border-slate-700 text-indigo-600 focus:ring-0"
          />
        </label>

        <label className="flex items-center justify-between p-2 rounded bg-slate-800/50 hover:bg-slate-800 transition cursor-pointer text-xs">
          <span className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-sky-400" /> Auto-read & Scroll
          </span>
          <input
            type="checkbox"
            checked={settings.autoReading}
            onChange={(e) => updateSetting('autoReading', e.target.checked)}
            className="rounded border-slate-700 text-indigo-600 focus:ring-0"
          />
        </label>

        <label className="flex items-center justify-between p-2 rounded bg-slate-800/50 hover:bg-slate-800 transition cursor-pointer text-xs">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Auto-Advance (Next)
          </span>
          <input
            type="checkbox"
            checked={settings.autoNext}
            onChange={(e) => updateSetting('autoNext', e.target.checked)}
            className="rounded border-slate-700 text-indigo-600 focus:ring-0"
          />
        </label>

        <label className="flex items-center justify-between p-2 rounded bg-slate-800/50 hover:bg-slate-800 transition cursor-pointer text-xs">
          <span className="flex items-center gap-2">
            <HelpCircle className="w-3.5 h-3.5 text-fuchsia-400" /> Auto-Solve Quizzes
          </span>
          <input
            type="checkbox"
            checked={settings.autoQuiz}
            onChange={(e) => updateSetting('autoQuiz', e.target.checked)}
            className="rounded border-slate-700 text-indigo-600 focus:ring-0"
          />
        </label>

        <label className="flex items-center justify-between p-2 rounded bg-slate-800/50 hover:bg-slate-800 transition cursor-pointer text-xs">
          <span className="flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-teal-400" /> Auto-Reply Discussions
          </span>
          <input
            type="checkbox"
            checked={settings.autoDiscussion}
            onChange={(e) => updateSetting('autoDiscussion', e.target.checked)}
            className="rounded border-slate-700 text-indigo-600 focus:ring-0"
          />
        </label>
      </div>

      {/* Instant Action Controls */}
      <div className="space-y-1.5 pt-1">
        <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Instant Actions</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => sendAction('SKIP_VIDEO')}
            className="py-1.5 px-2 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-medium transition flex items-center justify-center gap-1.5"
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>Skip Video</span>
          </button>
          <button
            onClick={() => sendAction('NEXT_ITEM')}
            className="py-1.5 px-2 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs font-medium transition flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Next Item ➔</span>
          </button>
        </div>
      </div>

      {/* Quick Launch & Footer */}
      <div className="pt-2 border-t border-slate-800 space-y-2">
        <button
          onClick={() => chrome.tabs.create({ url: 'http://localhost:3000' })}
          className="w-full py-1.5 px-3 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 text-xs font-medium transition flex items-center justify-center gap-1.5"
        >
          <span>Open Test Simulator</span>
          <span className="text-[10px] text-slate-400 font-mono">:3000</span>
        </button>
        <div className="text-[11px] text-slate-500 text-center">
          Humanized Stealth & Visual Virtual Cursor Active
        </div>
      </div>
    </div>
  );
}
