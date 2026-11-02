import { testRender } from '@opentui/react/test-utils';
import { Root } from '@totvibe/tui/root';
import { act } from 'react';
import { expect } from 'vitest';

import { buildConfig } from '#fixtures/config';
import { createHarness, isolateScene, type RenderOptions, type Scene } from '#shared-stories/harness';

const EVENTUALLY_MAX_PASSES = 50;
const EVENTUALLY_PASS_DELAY_MS = 2;

const renderScene = async ({ connectedProviderKeys }: RenderOptions) => {
  type RenderSetup = Awaited<ReturnType<typeof testRender>>;
  type TuiScene = Scene & {
    pressArrow(direction: 'down' | 'up'): Promise<void>;
    pressEnter(): Promise<void>;
    pressEscape(): Promise<void>;
    pressKey(key: string): Promise<void>;
  };
  const restoreScene = isolateScene(connectedProviderKeys);
  let setup!: RenderSetup;
  await act(async () => {
    setup = await testRender(<Root config={buildConfig()} />, {
      exitOnCtrlC: false,
      height: 40,
      width: 120,
    });
    await setup.waitForVisualIdle();
  });

  const settle = async (interact: () => Promise<void> | void) => {
    await act(async () => {
      await interact();
    });
    await setup.flush();
  };

  const frameShows = (text: string) => {
    expect(setup.captureCharFrame()).toContain(text);
  };

  return {
    act: {
      type: text => settle(() => setup.mockInput.typeText(text)),
      typeAndSubmit: text =>
        settle(async () => {
          await setup.mockInput.typeText(text);
          setup.mockInput.pressEnter();
        }),
    },
    assert: {
      eventuallyShows: async text => {
        await act(async () => {
          for (let pass = 0; pass < EVENTUALLY_MAX_PASSES; pass += 1) {
            await setup.flush();
            if (setup.captureCharFrame().includes(text)) return;
            await new Promise(resolve => setTimeout(resolve, EVENTUALLY_PASS_DELAY_MS));
          }
        });
        frameShows(text);
      },
      hides: text => {
        expect(setup.captureCharFrame()).not.toContain(text);
      },
      shows: frameShows,
    },
    dispose: async () => {
      await act(async () => {
        await setup.flush();
        setup.renderer.destroy();
      });
      restoreScene();
    },
    pressArrow: direction =>
      settle(() => {
        setup.mockInput.pressArrow(direction);
      }),
    pressEnter: () =>
      settle(() => {
        setup.mockInput.pressEnter();
      }),
    pressEscape: () =>
      settle(() => {
        setup.mockInput.pressEscape();
      }),
    pressKey: key =>
      settle(() => {
        setup.mockInput.pressKey(key);
      }),
  } satisfies TuiScene;
};

export const tuiHarness = createHarness(renderScene);
