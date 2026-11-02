import type { AnyToolDef, ToolContext } from '@totvibe/core/index';

import { SandboxState } from '@totvibe/sandbox/index';
import { createBuiltinTools, type ToolOptions } from '@totvibe/tools';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test as base } from 'vitest';

import { writeStubHelper } from '#fixtures/sandbox-helper';

const OUTPUT_CHAR_CAP = 100_000;

const makeToolbox = async (options: ToolOptions = {}) => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'totvibe-tools-'));
  const sandbox = new SandboxState(cwd);
  const tools: AnyToolDef[] = createBuiltinTools(sandbox, options);
  const context: ToolContext = { cwd };
  const run = async (name: string, input: unknown) => {
    const tool = tools.find(definition => definition.name === name);
    if (!tool) throw new Error(`no such builtin tool: ${name}`);
    return tool.execute(input, context);
  };
  return { cwd, run, sandbox, tools };
};

const tools = { makeToolbox, mkdir, OUTPUT_CHAR_CAP, path, symlink, writeFile, writeStubHelper };
export const test = base.extend<{ tools: typeof tools }>({
  tools: async ({}, provide) => {
    await provide(tools);
  },
});
