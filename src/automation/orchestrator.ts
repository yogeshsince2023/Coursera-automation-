import { setup, fromPromise } from 'xstate';
import type { PlatformAdapter } from '../platforms/coursera/adapter';
import type { AutomationSettings } from '../types';

export interface AutomationContext {
  adapter: PlatformAdapter;
  settings: AutomationSettings;
  consecutiveErrors: number;
}

export const automationMachine = setup({
  types: {
    context: {} as AutomationContext,
    input: {} as AutomationContext,
    events: {} as
      | { type: 'TICK' }
      | { type: 'STOP' }
      | { type: 'ROUTE_CHANGE' }
      | { type: 'NAVIGATE_SUCCESS' }
      | { type: 'ERROR' }
      | { type: 'UPDATE_SETTINGS'; settings: AutomationSettings }
  },
  actors: {
    handleModalActor: fromPromise(async ({ input }: { input: AutomationContext }) => {
      return await input.adapter.handleModal();
    }),
    handleVideoActor: fromPromise(async ({ input }: { input: AutomationContext }) => {
      // Always enforce accelerated 16x video playback for fast, seamless module completion
      return await input.adapter.handleVideo(16.0, true);
    }),
    waitingCompletionActor: fromPromise(async ({ input }: { input: AutomationContext }) => {
      console.log('[Orchestrator] Waiting for video completion & verification...');
      const maxWait = 7200000; // 2 hour safety ceiling
      const startTime = Date.now();
      while (Date.now() - startTime < maxWait) {
        if (!input.settings.enabled) return false;
        if (input.adapter.isActivityCompleted()) {
          console.log('[Orchestrator] Video activity completion verified!');
          return true;
        }
        await input.adapter.handleVideo(16.0, true);
        await new Promise((r) => setTimeout(r, 1000));
      }
      return true;
    }),
    handleReadingActor: fromPromise(async ({ input }: { input: AutomationContext }) => {
      return await input.adapter.handleReading();
    }),
    handleQuizActor: fromPromise(async ({ input }: { input: AutomationContext }) => {
      return await input.adapter.handleQuiz();
    }),
    handleDiscussionActor: fromPromise(async ({ input }: { input: AutomationContext }) => {
      return await input.adapter.handleDiscussion();
    }),
    advancingActor: fromPromise(async ({ input }: { input: AutomationContext }) => {
      return await input.adapter.clickNext();
    })
  }
}).createMachine({
  id: 'automationOrchestrator',
  initial: 'idle',
  context: ({ input }) => ({ ...input }),
  states: {
    idle: {
      on: {
        TICK: 'detecting',
        ROUTE_CHANGE: 'detecting',
        UPDATE_SETTINGS: {
          actions: ({ context, event }) => {
            Object.assign(context.settings, event.settings);
          }
        }
      }
    },
    detecting: {
      always: [
        {
          target: 'handlingModal',
          guard: ({ context }) => context.adapter.detectActivity() === 'modal'
        },
        {
          target: 'handlingVideo',
          guard: ({ context }) => context.adapter.detectActivity() === 'video' && context.settings.autoVideo
        },
        {
          target: 'handlingReading',
          guard: ({ context }) => context.adapter.detectActivity() === 'reading' && context.settings.autoReading
        },
        {
          target: 'handlingQuiz',
          guard: ({ context }) => context.adapter.detectActivity() === 'quiz' && context.settings.autoQuiz
        },
        {
          target: 'handlingDiscussion',
          guard: ({ context }) => context.adapter.detectActivity() === 'discussion' && context.settings.autoDiscussion
        },
        {
          target: 'idle'
        }
      ]
    },
    handlingModal: {
      invoke: {
        src: 'handleModalActor',
        input: ({ context }) => context,
        onDone: { target: 'advancing' },
        onError: { target: 'recovery' }
      }
    },
    handlingVideo: {
      invoke: {
        src: 'handleVideoActor',
        input: ({ context }) => context,
        onDone: { target: 'waitingCompletion' },
        onError: { target: 'waitingCompletion' }
      }
    },
    waitingCompletion: {
      invoke: {
        src: 'waitingCompletionActor',
        input: ({ context }) => context,
        onDone: { target: 'advancing' },
        onError: { target: 'advancing' }
      },
      on: {
        ROUTE_CHANGE: 'detecting'
      }
    },
    handlingReading: {
      invoke: {
        src: 'handleReadingActor',
        input: ({ context }) => context,
        onDone: { target: 'advancing' },
        onError: { target: 'recovery' }
      }
    },
    handlingQuiz: {
      invoke: {
        src: 'handleQuizActor',
        input: ({ context }) => context,
        onDone: { target: 'advancing' },
        onError: { target: 'recovery' }
      }
    },
    handlingDiscussion: {
      invoke: {
        src: 'handleDiscussionActor',
        input: ({ context }) => context,
        onDone: { target: 'advancing' },
        onError: { target: 'recovery' }
      }
    },
    advancing: {
      invoke: {
        src: 'advancingActor',
        input: ({ context }) => context,
        onDone: { target: 'cooldown' },
        onError: { target: 'recovery' }
      }
    },
    cooldown: {
      on: {
        ROUTE_CHANGE: 'detecting'
      },
      after: {
        2500: 'idle'
      }
    },
    recovery: {
      on: {
        ROUTE_CHANGE: 'detecting'
      },
      after: {
        2500: 'idle'
      }
    }
  }
});
