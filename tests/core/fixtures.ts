import { mkdtemp, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as z from 'zod';
export type { AgentEvent, Middleware, ToolCallRequest, ToolContext } from '@totvibe/core/index';
import type { AgentDeps, AgentEvent, ToolDef } from '@totvibe/core/index';

import {
  buildModelToolSet,
  compose,
  createSession,
  EventBus,
  findLatestSessionId,
  JsonlLog,
  loadSessionMessages,
  passthrough,
  runAgent,
  runToolCalls,
  SessionStore,
} from '@totvibe/core/index';
import { defineTool } from '@totvibe/core/index';
import { test as base } from 'vitest';

import {
  abortedTurn,
  failingTurn,
  resetModelReply,
  scriptModelTurns,
  streamScriptedReply,
  textTurn,
  toolCallTurn,
} from '#model-mock';

export type { ModelMessage } from 'ai';

const TextInputSchema = z.object({ text: z.string() });

const echoTool: ToolDef<{ text: string }> = defineTool({
  description: 'Echoes its input back.',
  execute: ({ text }) => Promise.resolve(`echo: ${text}`),
  inputSchema: TextInputSchema,
  name: 'echo',
  risk: 'read',
});

const failingTool: ToolDef<{ text: string }> = defineTool({
  description: 'Always fails.',
  execute: () => Promise.reject(new Error('tool exploded')),
  inputSchema: TextInputSchema,
  name: 'explode',
  risk: 'read',
});

const makeMutatingTool = (log: string[]) =>
  defineTool({
    description: 'Records its input.',
    execute: ({ text }) => {
      log.push(text);
      return Promise.resolve(`recorded: ${text}`);
    },
    inputSchema: TextInputSchema,
    name: 'record',
    risk: 'mutate',
  });

const agentDeps: (overrides?: Partial<AgentDeps>) => AgentDeps = (overrides = {}) => ({
  cwd: '/tmp',
  model: 'scripted-model',
  system: 'fixture system prompt',
  tools: [echoTool],
  ...overrides,
});

const collectEvents = async (events: AsyncGenerator<AgentEvent>) => {
  const collected: AgentEvent[] = await Array.fromAsync(events);
  return collected;
};

const eventTypes = (events: AgentEvent[]) => events.map(event => event.type);

const scratchDir = () => mkdtemp(path.join(tmpdir(), 'totvibe-core-'));
const CountRecordSchema = z.object({ n: z.number() });
const EmptyRecordSchema = z.object({});
const executeToolCall = async (
  ...[definitions, call, context, middleware]: [
    Parameters<typeof runToolCalls>[0],
    Parameters<typeof runToolCalls>[1][number],
    Parameters<typeof runToolCalls>[2],
    Parameters<typeof runToolCalls>[3],
  ]
) => {
  const [outcome] = await runToolCalls(definitions, [call], context, middleware);
  return outcome;
};
const core = {
  abortedTurn,
  agentDeps,
  buildModelToolSet,
  collectEvents,
  compose,
  CountRecordSchema,
  createSession,
  echoTool,
  EmptyRecordSchema,
  EventBus,
  eventTypes,
  executeToolCall,
  failingTool,
  failingTurn,
  findLatestSessionId,
  JsonlLog,
  loadSessionMessages,
  makeMutatingTool,
  mkdtemp,
  passthrough,
  path,
  resetModelReply,
  runAgent,
  runToolCalls,
  scratchDir,
  scriptModelTurns,
  SessionStore,
  streamScriptedReply,
  textTurn,
  tmpdir,
  toolCallTurn,
  utimes,
  z: z,
};
export const test = base.extend<{ core: typeof core }>({
  core: async ({}, provide) => {
    await provide(core);
  },
});
