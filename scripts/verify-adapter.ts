import { CourseraAdapter } from '../src/platforms/coursera/adapter';
import { LinkedInLearningAdapter } from '../src/platforms/linkedin/adapter';
import { getPlatformAdapter } from '../src/platforms';
import { automationMachine } from '../src/automation/orchestrator';
import { createActor } from 'xstate';
import { DEFAULT_SETTINGS } from '../src/types';

// Mock minimal DOM for Node
class MockElement {
  public tagName: string;
  public id: string = '';
  public className: string = '';
  public attributes: Record<string, string> = {};
  public style: Record<string, string> = {};
  public textContent: string = '';
  public offsetWidth: number = 200;
  public offsetHeight: number = 40;
  public scrollHeight: number = 100;
  public clientHeight: number = 100;
  public scrollTop: number = 0;
  public listeners: Record<string, Function[]> = {};

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  getAttribute(name: string) {
    return this.attributes[name] || null;
  }
  setAttribute(name: string, val: string) {
    this.attributes[name] = val;
  }
  hasAttribute(name: string) {
    return name in this.attributes;
  }
  removeAttribute(name: string) {
    delete this.attributes[name];
  }
  getClientRects() {
    return [{ width: this.offsetWidth, height: this.offsetHeight }];
  }
  getBoundingClientRect() {
    return { left: 100, top: 100, width: this.offsetWidth, height: this.offsetHeight, right: 300, bottom: 140 };
  }
  scrollIntoView() {}
  appendChild(child: any) {}
  contains(child: any) { return true; }
  addEventListener(event: string, fn: Function) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }
  dispatchEvent(evt: any) {
    if (this.listeners[evt.type]) {
      this.listeners[evt.type].forEach(fn => fn(evt));
    }
  }
  click() {
    this.dispatchEvent({ type: 'click' });
  }
}

class MockVideoElement extends MockElement {
  public paused: boolean = true;
  public ended: boolean = false;
  public duration: number = 60;
  public currentTime: number = 0;
  public playbackRate: number = 1.0;
  public muted: boolean = false;
  public volume: number = 1.0;
  public defaultMuted: boolean = false;

  constructor() {
    super('VIDEO');
  }

  async play() {
    this.paused = false;
    this.dispatchEvent({ type: 'play' });
  }
  pause() {
    this.paused = true;
    this.dispatchEvent({ type: 'pause' });
  }
}

// Global DOM setup
const elements: MockElement[] = [];
const mockDocument = {
  body: new MockElement('BODY'),
  querySelectorAll: (selector: string) => {
    return elements.filter(el => {
      if (selector === 'video') return el.tagName === 'VIDEO';
      if (selector.includes('data-testid="next-item"') && el.getAttribute('data-testid') === 'next-item') return true;
      if (selector.includes('item-completed') && (el.getAttribute('data-testid') || '').includes('item-completed')) return true;
      if (selector.includes('complete') && (el.className.includes('complete') || (el.getAttribute('data-testid') || '').includes('completed'))) return true;
      return false;
    });
  },
  querySelector: (selector: string) => {
    return mockDocument.querySelectorAll(selector)[0] || null;
  },
  getElementById: (id: string) => {
    return elements.find(el => el.id === id) || null;
  },
  createElement: (tag: string) => new MockElement(tag),
  dispatchEvent: () => {}
};

(global as any).document = mockDocument;
(global as any).window = {
  location: { href: 'https://www.coursera.org/learn/machine-learning/lecture/1a2b3c', pathname: '/learn/machine-learning/lecture/1a2b3c', origin: 'https://www.coursera.org' },
  innerWidth: 1920,
  innerHeight: 1080,
  getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
  dispatchEvent: () => {},
  addEventListener: () => {},
  setInterval: () => 1,
  clearInterval: () => {}
};
(global as any).MouseEvent = class { constructor(public type: string, public props: any) {} };
(global as any).PointerEvent = class { constructor(public type: string, public props: any) {} };
(global as any).Event = class { constructor(public type: string) {} };

async function runTests() {
  console.log('=== RUNNING COURSERA AUTOCOMPLETE ENGINE VERIFICATION ===\n');
  const adapter = new CourseraAdapter();

  // Test 1: URL Detection
  console.log('Test 1: Activity Detection');
  window.location.href = 'https://www.coursera.org/learn/test/lecture/abc';
  if (adapter.detectActivity() !== 'video') throw new Error('Expected video activity');
  window.location.href = 'https://www.coursera.org/learn/test/supplement/def';
  if (adapter.detectActivity() !== 'reading') throw new Error('Expected reading activity');
  window.location.href = 'https://www.coursera.org/learn/test/quiz/ghi';
  if (adapter.detectActivity() !== 'quiz') throw new Error('Expected quiz activity');
  window.location.href = 'https://www.coursera.org/learn/test/discussionprompt/jkl';
  if (adapter.detectActivity() !== 'discussion') throw new Error('Expected discussion activity');
  console.log('  PASS: All URL activities detected correctly.\n');

  // Test 2: Premature Completion Guard (When video is not yet mounted)
  console.log('Test 2: Video Loading Guard (Prevent early skip)');
  window.location.href = 'https://www.coursera.org/learn/test/lecture/abc';
  elements.length = 0; // No video in DOM yet
  const completedBeforeMount = adapter.isActivityCompleted();
  if (completedBeforeMount !== false) {
    throw new Error('FAIL: isActivityCompleted returned true when video is not in DOM!');
  }
  console.log('  PASS: isActivityCompleted correctly returned FALSE when video is not yet loaded.\n');

  // Test 3: Active Video Guard (When video is playing)
  console.log('Test 3: Active Video Playback Guard');
  const mockVid = new MockVideoElement();
  mockVid.duration = 120;
  mockVid.currentTime = 25; // 25s in
  mockVid.paused = false;
  elements.push(mockVid);

  const completedWhilePlaying = adapter.isActivityCompleted();
  if (completedWhilePlaying !== false) {
    throw new Error('FAIL: isActivityCompleted returned true while video is actively playing!');
  }
  console.log('  PASS: isActivityCompleted correctly returned FALSE while video is playing.\n');

  // Test 4: Video Handling & Stealth Settings
  console.log('Test 4: handleVideo Playback & Pacing');
  mockVid.paused = true;
  await adapter.handleVideo(2.0, false);
  if (mockVid.paused) throw new Error('FAIL: handleVideo did not resume playback!');
  if (mockVid.muted) throw new Error('FAIL: handleVideo muted the video!');
  if (mockVid.playbackRate !== 2.0) throw new Error(`FAIL: playbackRate is ${mockVid.playbackRate}, expected 2.0!`);
  console.log('  PASS: Video resumed at 2.0x playback rate with sound on.\n');

  // Test 5: End of Video & Server Grace Period
  console.log('Test 5: Video End & Server Grace Period');
  mockVid.currentTime = 120;
  mockVid.ended = true;

  // Immediate check: Grace period has NOT passed yet (0ms)
  const completedImmediately = adapter.isActivityCompleted();
  if (completedImmediately !== false) {
    throw new Error('FAIL: isActivityCompleted returned true immediately without grace period!');
  }
  console.log('  PASS: Grace period initialized, immediate return is FALSE.');

  // Wait 5.1s for grace period
  console.log('  Waiting 5.1s for server sync grace period...');
  await new Promise(r => setTimeout(r, 5100));
  const completedAfterGrace = adapter.isActivityCompleted();
  if (completedAfterGrace !== true) {
    throw new Error('FAIL: isActivityCompleted did not return true after grace period!');
  }
  console.log('  PASS: Grace period settled. isActivityCompleted returned TRUE.\n');

  // Test 6: Navigation / Advance
  console.log('Test 6: Navigation Advance');
  const nextBtn = new MockElement('BUTTON');
  nextBtn.setAttribute('data-testid', 'next-item');
  let clicked = false;
  nextBtn.addEventListener('click', () => { clicked = true; });
  elements.push(nextBtn);

  const advanced = await adapter.clickNext();
  if (!advanced || !clicked) {
    throw new Error('FAIL: clickNext did not click primary Next button!');
  }
  console.log('  PASS: clickNext executed natural click on Next item button.\n');

  // Test 7: State Machine Orchestrator Loop
  console.log('Test 7: Orchestrator State Transitions');
  mockVid.ended = false;
  mockVid.currentTime = 10;
  const orchestrator = createActor(automationMachine, {
    input: {
      adapter,
      settings: { ...DEFAULT_SETTINGS, enabled: true },
      consecutiveErrors: 0
    }
  });

  const states: string[] = [];
  orchestrator.subscribe(s => {
    states.push(String(s.value));
  });

  orchestrator.start();
  orchestrator.send({ type: 'TICK' });

  await new Promise(r => setTimeout(r, 500));
  console.log('  Orchestrator transition sequence:', states.join(' -> '));
  if (!states.includes('waitingCompletion')) {
    throw new Error('FAIL: Orchestrator did not enter waitingCompletion state!');
  }
  console.log('  PASS: Orchestrator holds in waitingCompletion state as expected.');

  orchestrator.stop();

  // Test 8: Green Completion Tick Detection
  console.log('Test 8: Green Completion Tick Verification');
  const tickEl = new MockElement('DIV');
  tickEl.setAttribute('data-testid', 'item-completed');
  elements.push(tickEl);
  if (!adapter.hasGreenCompletionTick()) {
    throw new Error('FAIL: hasGreenCompletionTick did not detect item-completed testid!');
  }
  if (!adapter.isActivityCompleted()) {
    throw new Error('FAIL: isActivityCompleted did not immediately return true when green tick is present!');
  }
  console.log('  PASS: Green completion tick detected and activity immediately marked completed.\n');

  // Test 9: LinkedIn Learning Adapter & Factory Verification
  console.log('Test 9: LinkedIn Learning Platform Support');
  (globalThis as any).window.location = {
    href: 'https://www.linkedin.com/learning/threat-modeling-fundamentals/pasta-threat-model',
    pathname: '/learning/threat-modeling-fundamentals/pasta-threat-model',
    hostname: 'www.linkedin.com',
    origin: 'https://www.linkedin.com'
  };
  const liAdapter = getPlatformAdapter();
  if (liAdapter.name !== 'LinkedIn Learning') {
    throw new Error(`FAIL: Platform adapter expected LinkedIn Learning but got ${liAdapter.name}`);
  }
  const liActivity = liAdapter.detectActivity();
  if (liActivity !== 'video') {
    throw new Error(`FAIL: LinkedIn learning activity expected video, got ${liActivity}`);
  }
  console.log('  PASS: LinkedIn Learning adapter detected and handles video activity.\n');

  console.log('\n======================================================');
  console.log('ALL VERIFICATION SUITE CHECKS PASSED SUCCESSFULLY (9/9)');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('\nTEST RUN FAILED:', err);
  process.exit(1);
});
