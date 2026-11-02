import { test as base } from 'vitest';

import {
  expectGrantCommandConfirmation,
  expectInputPromptWhenConnected,
  expectProviderCommandOpensDialog,
  expectProviderDialogWhenUnconnected,
  expectStreamedModelReply,
} from '#shared-stories';

import { tuiHarness } from './harness';

const tui = {
  expectGrantCommandConfirmation,
  expectInputPromptWhenConnected,
  expectProviderCommandOpensDialog,
  expectProviderDialogWhenUnconnected,
  expectStreamedModelReply,
  tuiHarness,
};
export const test = base.extend<{ tui: typeof tui }>({
  tui: async ({}, provide) => {
    await provide(tui);
  },
});
