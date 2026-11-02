import { cleanup, fireEvent, render } from '@testing-library/react';
import { createRuntime } from '@totvibe/runtime';
import { type AgentController, applyServerEvent, type Store } from '@totvibe/view';
import { Root } from '@totvibe/web/root';
import { act } from 'react';

import { buildConfig } from '#fixtures/config';
import { createHarness, isolateScene, type RenderOptions, type Scene } from '#shared-stories/harness';

const EVENTUALLY_MAX_PASSES = 50;

const createInProcessController = (store: Store) => {
  const runtime = createRuntime(buildConfig());
  runtime.subscribe(event => {
    applyServerEvent(store, event);
  });
  const controller: AgentController = {
    cancel: () => {
      runtime.cancel();
    },
    openKeyPage: () => void 0,
    resolveApproval: isGranted => {
      runtime.resolveApproval(isGranted);
    },
    saveApiKey: (providerName, apiKey) => {
      void runtime.saveApiKey(providerName, apiKey);
    },
    selectProvider: (providerName, modelId) => {
      runtime.selectProvider(providerName, modelId);
    },
    submit: text => {
      runtime.submit(text);
    },
    testConnection: providerName => {
      void runtime.testConnection(providerName);
    },
  };
  return {
    controller,
    start: () => {
      runtime.start();
    },
  };
};

const visibleText = () => {
  const haystack = [document.body.textContent];
  for (const input of document.querySelectorAll('input')) {
    haystack.push(input.placeholder, input.value);
  }
  return haystack.join(' ');
};

const inputBar = () => {
  const input = document.querySelector<HTMLInputElement>('.input-bar input');
  if (!input) throw new Error('input bar is not rendered');
  return input;
};

const renderScene = async ({ connectedProviderKeys }: RenderOptions) => {
  const restoreScene = isolateScene(connectedProviderKeys);

  await act(async () => {
    render(<Root create={createInProcessController} />);
    await Promise.resolve();
  });

  const flush = () =>
    act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

  return {
    act: {
      type: async text => {
        fireEvent.change(inputBar(), { target: { value: text } });
        await flush();
      },
      typeAndSubmit: async text => {
        const input = inputBar();
        fireEvent.change(input, { target: { value: text } });
        const form = input.closest('form');
        if (form) fireEvent.submit(form);
        await flush();
      },
    },
    assert: {
      eventuallyShows: async text => {
        for (let pass = 0; pass < EVENTUALLY_MAX_PASSES; pass += 1) {
          if (visibleText().includes(text)) return;
          await flush();
        }
        if (!visibleText().includes(text)) {
          throw new Error(`expected web UI to eventually show ${JSON.stringify(text)}`);
        }
      },
      hides: text => {
        if (visibleText().includes(text)) {
          throw new Error(`expected web UI to hide ${JSON.stringify(text)}`);
        }
      },
      shows: text => {
        if (!visibleText().includes(text)) {
          throw new Error(`expected web UI to show ${JSON.stringify(text)}`);
        }
      },
    },
    dispose: () => {
      cleanup();
      restoreScene();
      return Promise.resolve();
    },
  } satisfies Scene;
};

export const webHarness = createHarness(renderScene);
