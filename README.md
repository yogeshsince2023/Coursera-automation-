# Coursera Auto-Pilot (Chrome Extension) 🚀

An autonomous, production-grade Chrome extension built to accelerate and automate Coursera learning paths with intelligent green tick verification, background tab playback, and smart navigation.

---

## ✨ Features

- ⚡ **16x Accelerated Video Playback:** Seamlessly plays video lectures at up to 16x speed while meeting all completion requirements.
- 🟢 **Green Tick Verification:** Specifically inspects Coursera's sidebar syllabus for the **green completion checkmark** before advancing to the next lesson item.
- ⏭️ **Auto-Skip & Sequential Progression:** Automatically marks reading items as complete and skips discussions, quizzes, and non-video checkpoints sequentially.
- 🔄 **Plays in Background Tabs:** Advanced Page Visibility spoofing and background service worker heartbeats ensure videos continue playing even when you switch tabs or minimize the browser window.
- 📊 **Real-Time On-Screen Status:** Sleek floating pill at the top-right displays active state, current playback percentage, and navigation status.
- 🛡️ **Anti-Looping Engine:** Freezes finished videos at the end so Coursera's player never restarts or replays the same video from `0:00`.

---

## 🚀 Quick Start (No Coding / No Setup Required!)

Anyone can install and use this extension in **less than 1 minute** without installing Node.js or any programming tools:

### Step 1: Download the Extension
1. Click the green **`< > Code`** button at the top of this repository and select **Download ZIP**.
2. Extract the downloaded `.zip` file on your computer.

### Step 2: Load into Google Chrome
1. Open Google Chrome and type `chrome://extensions/` in the address bar (or go to `Menu (⋮)` -> `Extensions` -> `Manage Extensions`).
2. Turn **ON** the **Developer mode** toggle in the top-right corner.
3. Click the **Load unpacked** button in the top-left corner.
4. Browse to the extracted folder and select the **`extension`** folder.

### Step 3: Open Coursera
1. Open any lecture on [coursera.org](https://www.coursera.org/).
2. You will see the **Coursera Auto-Pilot: ACTIVE** badge at the top right.
3. Relax and let it autonomously pace through your lessons!

---

## 🛠️ For Developers (Build from Source)

If you wish to modify the TypeScript source code, you can build it using WXT, React, and Vite:

```bash
# 1. Install dependencies
npm install

# 2. Run test verification suite
npm run test

# 3. Build production bundle (outputs to .output/chrome-mv3 and extension/)
npm run build
```

---

## 📂 Project Architecture

```text
├── extension/                 # Ready-to-load precompiled Chrome extension (Load this unpacked!)
│   ├── manifest.json          # Chrome Manifest V3 configuration
│   ├── background.js          # Service worker keep-alive heartbeat
│   ├── content-scripts/       # Automation & DOM injection scripts
│   ├── popup.html             # Popup control panel
│   └── icons/                 # Extension icons
├── entrypoints/
│   ├── background.ts          # MV3 Service Worker (Background pacer)
│   ├── content.ts             # Injected content script & overlay
│   └── popup/                 # React + Tailwind popup dashboard
├── src/
│   ├── automation/            # XState state machine orchestrator
│   ├── platforms/coursera/    # Coursera DOM adapter & green tick detector
│   ├── stealth/               # Humanized clicking & anti-detection
│   └── types/                 # TypeScript interfaces
├── scripts/
│   └── verify-adapter.ts      # Automated verification test suite
├── package.json
└── tsconfig.json
```

---

## ⚖️ License
MIT License. Created for educational and productivity enhancement purposes.

