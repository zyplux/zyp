import { ClientCommandSchema, DEFAULT_PROVIDER, findProvider, PROVIDERS, ServerEventSchema } from '@totvibe/protocol';
import { test as base } from 'vitest';
export type { ClientCommand, ServerEvent } from '@totvibe/protocol';

const protocol = { ClientCommandSchema, DEFAULT_PROVIDER, findProvider, PROVIDERS, ServerEventSchema };
export const test = base.extend<{ protocol: typeof protocol }>({
  protocol: async ({}, provide) => {
    await provide(protocol);
  },
});
