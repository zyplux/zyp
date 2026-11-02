import { test as base } from 'vitest';

import {
  expectGrantCommandConfirmation,
  expectInputPromptWhenConnected,
  expectProviderCommandOpensDialog,
  expectProviderDialogWhenUnconnected,
  expectStreamedModelReply,
} from '#shared-stories';

import { webHarness } from './harness';

const web = {
  expectGrantCommandConfirmation,
  expectInputPromptWhenConnected,
  expectProviderCommandOpensDialog,
  expectProviderDialogWhenUnconnected,
  expectStreamedModelReply,
  webHarness,
};
export const test = base.extend<{ web: typeof web }>({
  web: async ({}, provide) => {
    await provide(web);
  },
});
