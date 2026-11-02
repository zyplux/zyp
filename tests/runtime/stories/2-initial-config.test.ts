import { describe, expect, vi } from 'vitest';

import { test } from '#runtime';

const GLM_CONTEXT_WINDOW = 204_800;
const TOKEN_BUDGET_CONTEXT_WINDOWS = 8;
const DEFAULT_MAX_STEPS = 24;
const DEFAULT_WALL_CLOCK_MS = 600_000;
const OVERRIDDEN_MAX_STEPS = 5;
const OVERRIDDEN_APPROVAL_TIMEOUT_MS = 1000;
const MINUTE_MS = 60_000;

describe('2.1 resolving the provider', () => {
  test('2.1.1 defaults to the default provider and its model', async ({ runtime: fixture }) => {
    fixture.clearConfigEnv();
    const config = await fixture.loadInitialConfig({ sandbox: true });
    expect(config.providerName).toBe('glm');
    expect(config.modelId).toBe('glm-5.1');
    expect(config.autoApprove).toBe(false);
    expect(config.sandbox).toBe(true);
    expect(config.sandboxNet).toBe('none');
    expect(config.cwd).toBe(process.cwd());
    expect(config.system).toContain('totvibe');
  });

  test('2.1.2 honors provider, model, approval, and network overrides from the environment', async ({
    runtime: fixture,
  }) => {
    fixture.clearConfigEnv();
    vi.stubEnv('AI_PROVIDER', 'QWEN');
    vi.stubEnv('MODEL', 'qwen-experimental');
    vi.stubEnv('AUTO_APPROVE', '1');
    vi.stubEnv('TOTVIBE_SANDBOX_NET', 'inherit');
    const config = await fixture.loadInitialConfig({ sandbox: false });
    expect(config.providerName).toBe('qwen');
    expect(config.modelId).toBe('qwen-experimental');
    expect(config.autoApprove).toBe(true);
    expect(config.sandbox).toBe(false);
    expect(config.sandboxNet).toBe('inherit');
  });

  test('2.1.3 rejects an unknown provider naming the known ones', async ({ runtime: fixture }) => {
    fixture.clearConfigEnv();
    vi.stubEnv('AI_PROVIDER', 'skynet');
    await expect(fixture.loadInitialConfig({ sandbox: true })).rejects.toThrow(
      /Unknown AI_PROVIDER "skynet".*glm.*qwen/,
    );
  });
});

describe('2.2 deriving agent limits', () => {
  test('2.2.1 defaults the limits from the provider metadata', async ({ runtime: fixture }) => {
    fixture.clearConfigEnv();
    const { limits } = await fixture.loadInitialConfig({ sandbox: true });
    expect(limits).toEqual({
      approvalTimeoutMs: 0,
      maxSteps: DEFAULT_MAX_STEPS,
      tokenBudget: GLM_CONTEXT_WINDOW * TOKEN_BUDGET_CONTEXT_WINDOWS,
      wallClockMs: DEFAULT_WALL_CLOCK_MS,
    });
  });

  test('2.2.2 honors positive integer overrides and ignores invalid ones', async ({ runtime: fixture }) => {
    fixture.clearConfigEnv();
    vi.stubEnv('TOTVIBE_MAX_STEPS', String(OVERRIDDEN_MAX_STEPS));
    vi.stubEnv('TOTVIBE_APPROVAL_TIMEOUT_MS', String(OVERRIDDEN_APPROVAL_TIMEOUT_MS));
    vi.stubEnv('TOTVIBE_TOKEN_BUDGET', 'not-a-number');
    vi.stubEnv('TOTVIBE_WALL_CLOCK_MS', '-3');
    const { limits } = await fixture.loadInitialConfig({ sandbox: true });
    expect(limits.maxSteps).toBe(OVERRIDDEN_MAX_STEPS);
    expect(limits.approvalTimeoutMs).toBe(OVERRIDDEN_APPROVAL_TIMEOUT_MS);
    expect(limits.tokenBudget).toBe(GLM_CONTEXT_WINDOW * TOKEN_BUDGET_CONTEXT_WINDOWS);
    expect(limits.wallClockMs).toBe(DEFAULT_WALL_CLOCK_MS);
  });
});

describe('2.3 resolving the session and data paths', () => {
  test('2.3.1 starts a fresh session under the data directory by default', async ({ runtime: fixture }) => {
    fixture.clearConfigEnv();
    const dataDir = await fixture.makeScratchDir();
    vi.stubEnv('TOTVIBE_DATA_DIR', dataDir);
    const config = await fixture.loadInitialConfig({ sandbox: true });
    expect(config.sessionId).toMatch(/[0-9a-f-]{36}/);
    expect(config.initialMessages).toEqual([]);
    expect(config.paths).toEqual({
      auditPath: fixture.path.join(dataDir, 'audit.jsonl'),
      sessionsDir: fixture.path.join(dataDir, 'sessions'),
    });
  });

  test('2.3.2 continues the most recently saved session', async ({ runtime: fixture }) => {
    await fixture.seedSessions([
      { id: 'older', modifiedAt: new Date(Date.now() - MINUTE_MS), text: 'first' },
      { id: 'newer', modifiedAt: new Date(), text: 'second' },
    ]);
    const config = await fixture.loadInitialConfig({ continueLast: true, sandbox: true });
    expect(config.sessionId).toBe('newer');
    expect(config.initialMessages).toEqual([{ content: 'second', role: 'user' }]);
  });

  test('2.3.3 resumes an explicitly named session', async ({ runtime: fixture }) => {
    await fixture.seedSessions([{ id: 'chosen', modifiedAt: new Date(), text: 'kept' }]);
    const config = await fixture.loadInitialConfig({ resume: 'chosen', sandbox: true });
    expect(config.sessionId).toBe('chosen');
    expect(config.initialMessages).toEqual([{ content: 'kept', role: 'user' }]);
  });
});
