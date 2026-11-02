import { vi } from 'vitest';

vi.mock('@totvibe/core/ai-core', async importOriginal => {
  const realAiCore = await importOriginal<typeof import('@totvibe/core/ai-core')>();
  const { streamScriptedReply } = await import('#model-mock');
  return { ...realAiCore, streamText: streamScriptedReply };
});
