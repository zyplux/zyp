import { probeSandbox, runSandboxedBash, SandboxState } from '@totvibe/sandbox/index';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test as base } from 'vitest';

import { writeStubHelper } from '#fixtures/sandbox-helper';

const makeScratchDir = () => mkdtemp(path.join(tmpdir(), 'totvibe-sandbox-'));

const sandbox = { makeScratchDir, probeSandbox, runSandboxedBash, SandboxState, writeStubHelper };
export const test = base.extend<{ sandbox: typeof sandbox }>({
  sandbox: async ({}, provide) => {
    await provide(sandbox);
  },
});
