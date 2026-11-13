# Autonomous Study Assistant (Coursera & LinkedIn Learning) 🚀

An autonomous, production-grade Chrome extension built to accelerate and automate course completions on **Coursera** and **LinkedIn Learning** with intelligent green tick verification, background tab playback, discussion auto-replying, and smart navigation.

---

## ✨ Features

- ⚡ **Direct API Instant Completion (Coursera):** Utilizes Coursera's official internal REST APIs with session authentication and CSRF token propagation to complete video lectures and reading supplements directly on the server in ~200ms.
- 💬 **Discussion Prompt Auto-Reply:** Automatically submits discussion replies to discussion prompts so they turn into **green checkmarks** without getting stuck!
- 🚀 **1-Click "Complete All" Button:** Floating on-screen badge includes a `⚡ Complete All` button to complete all eligible videos and readings across the entire course in one click.
- 💼 **LinkedIn Learning Platform Support:** Full native support for `linkedin.com/learning/*` featuring 16x video playback acceleration, automatic audio muting, chapter quiz progression, and table-of-contents checkmark tracking.
- 🟢 **Green Tick Verification:** Specifically inspects syllabus drawers and DOM elements for genuine green completion icons before advancing to the next item.
- 🔄 **Plays in Background Tabs:** Advanced Page Visibility spoofing and background service worker heartbeats ensure videos continue playing uninterrupted even when you switch tabs or minimize the browser window.
- 📊 **Real-Time On-Screen Status:** Sleek floating pill at the top-right displays active state, current playback percentage, platform name, and navigation status.
- 🛡️ **Anti-Looping Engine:** Freezes finished videos at the end so players never restart or replay the same video from `0:00`.

---

## 🚀 Quick Start (No Coding / Zero Setup Required!)

Anyone can install and use this extension in **less than 1 minute** without installing Node.js or any programming tools:

### Step 1: Download the Extension
1. Click the green **`< > Code`** button at the top of this repository and select **Download ZIP**.
2. Extract the downloaded `.zip` file on your computer.

### Step 2: Load into Google Chrome
1. Open Google Chrome and type `chrome://extensions/` in the address bar (or go to `Menu (⋮)` -> `Extensions` -> `Manage Extensions`).
2. Turn **ON** the **Developer mode** toggle in the top-right corner.
3. Click the **Load unpacked** button in the top-left corner.
4. Browse to the extracted folder and select the **`extension`** folder.

### Step 3: Open Coursera or LinkedIn Learning
1. Open any lecture on [coursera.org](https://www.coursera.org/) or [linkedin.com/learning](https://www.linkedin.com/learning/).
2. You will see the **Auto-Pilot: ACTIVE** floating badge at the top right.
3. Relax and let it autonomously pace through your lessons or click `⚡ Complete All`!

---

## 🛠️ For Developers (Build from Source)

If you wish to modify the TypeScript source code, you can build it using WXT, React, and Vite:

```bash
# 1. Install dependencies
npm install

# 2. Run test verification suite (9/9 checks)
npm run test

# 3. Build production bundle (outputs to .output/chrome-mv3 and extension/)
npm run build
```

---

## 📂 Project Architecture

```text
├── extension/                 # Ready-to-load precompiled Chrome extension (Load this unpacked!)
│   ├── manifest.json          # Chrome Manifest V3 configuration (Coursera + LinkedIn)
│   ├── background.js          # Service worker keep-alive heartbeat
│   ├── content-scripts/       # Automation & DOM injection scripts
│   ├── popup.html             # Popup control panel
│   └── icons/                 # Extension icons
├── entrypoints/
│   ├── background.ts          # MV3 Service Worker (Background pacer)
│   ├── content.ts             # Injected content script, platform routing & overlay
│   └── popup/                 # React + Tailwind popup dashboard
├── src/
│   ├── automation/            # XState state machine orchestrator
│   ├── platforms/             # Platform adapters & multi-platform factory
│   │   ├── index.ts           # Automatic platform detector (Coursera vs LinkedIn)
│   │   ├── coursera/          # Coursera DOM adapter & authenticated REST API client
│   │   └── linkedin/          # LinkedIn Learning DOM adapter & video pacer
│   ├── stealth/               # Humanized clicking & anti-detection
│   └── types/                 # TypeScript interfaces
├── scripts/
│   └── verify-adapter.ts      # Automated verification test suite (9 checks)
├── package.json
└── tsconfig.json
```

---

## ⚖️ License
MIT License. Created for educational and productivity enhancement purposes.

