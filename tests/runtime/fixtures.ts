import type { ServerEvent } from '@totvibe/protocol';
import type { InitialConfig, RuntimeHost } from '@totvibe/runtime';

import { DEFAULT_PROVIDER, findProvider, PROVIDERS } from '@totvibe/protocol';
import {
  buildModel,
  bunHost,
  createRuntime,
  dispatchClientCommand,
  isConnected,
  loadInitialConfig,
  validateApiKey,
} from '@totvibe/runtime';
import { mkdir, utimes, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test as base } from 'vitest';
import { vi } from 'vitest';

import { buildConfig, CONNECTED_PROVIDER_KEYS } from '#fixtures/config';
import { scriptModelTurns, setModelReply, textTurn, toolCallTurn } from '#model-mock';

const PROVIDER_KEY_ENV_VARS = [
  'DASHSCOPE_API_KEY',
  'ZAI_API_KEY',
  'ZHIPU_API_KEY',
  'MOONSHOT_API_KEY',
  'MIMO_API_KEY',
  'DEEPSEEK_API_KEY',
  'GEMINI_API_KEY',
  'MINIMAX_API_KEY',
  'MISTRAL_API_KEY',
];

const isolateEnv = (connectedKeys: Record<string, string> = {}) => {
  for (const name of PROVIDER_KEY_ENV_VARS) vi.stubEnv(name, undefined);
  for (const [name, value] of Object.entries(connectedKeys)) vi.stubEnv(name, value);
};

const HTTP_OK = 200;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_INTERNAL_SERVER_ERROR = 500;

const stubFetch = (reply: Error | number) => {
  const stub: typeof globalThis.fetch = Object.assign(
    () =>
      reply instanceof Error ? Promise.reject(reply) : Promise.resolve(new Response(undefined, { status: reply })),
    { preconnect: () => void 0 },
  );
  vi.stubGlobal('fetch', stub);
};

const makeScratchDir = () => mkdtemp(path.join(tmpdir(), 'totvibe-runtime-'));

const captureHost = () => {
  const saved: Record<string, string>[] = [];
  const host: RuntimeHost = {
    saveEnvVars: updates => {
      saved.push(updates);
      for (const [name, value] of Object.entries(updates)) vi.stubEnv(name, value);
      return Promise.resolve();
    },
  };
  return { host, saved };
};

const EVENT_WAIT_MAX_PASSES = 500;
const EVENT_WAIT_PASS_DELAY_MS = 2;

const makeRuntime = async (overrides: Partial<InitialConfig> = {}, host?: RuntimeHost) => {
  const dataDir = await makeScratchDir();
  const config: InitialConfig = {
    ...buildConfig(),
    cwd: dataDir,
    paths: { auditPath: path.join(dataDir, 'audit.jsonl'), sessionsDir: path.join(dataDir, 'sessions') },
    ...overrides,
  };
  const runtime = createRuntime(config, host ?? captureHost().host);
  const events: ServerEvent[] = [];
  runtime.subscribe(event => {
    events.push(event);
  });
  const expectEvent = async (describes: string, isMatch: (event: ServerEvent) => boolean) => {
    for (let pass = 0; pass < EVENT_WAIT_MAX_PASSES; pass += 1) {
      const found = events.find(event => isMatch(event));
      if (found) return found;
      await new Promise(resolve => setTimeout(resolve, EVENT_WAIT_PASS_DELAY_MS));
    }
    throw new Error(`runtime never emitted an event that ${describes}`);
  };
  return { config, events, expectEvent, runtime };
};

const clearConfigEnv = () => {
  isolateEnv();
  for (const name of [
    'AI_PROVIDER',
    'MODEL',
    'AUTO_APPROVE',
    'TOTVIBE_DATA_DIR',
    'TOTVIBE_SANDBOX_NET',
    'TOTVIBE_APPROVAL_TIMEOUT_MS',
    'TOTVIBE_MAX_STEPS',
    'TOTVIBE_TOKEN_BUDGET',
    'TOTVIBE_WALL_CLOCK_MS',
  ]) {
    vi.stubEnv(name, undefined);
  }
};
const seedSession = async (sessionsDir: string, sessionId: string, text: string, modifiedAt: Date) => {
  const sessionPath = path.join(sessionsDir, `${sessionId}.jsonl`);
  await writeFile(sessionPath, `${JSON.stringify({ message: { content: text, role: 'user' } })}\n`);
  await utimes(sessionPath, modifiedAt, modifiedAt);
};
const seedSessions = async (sessions: { id: string; modifiedAt: Date; text: string }[]) => {
  clearConfigEnv();
  const dataDir = await makeScratchDir();
  vi.stubEnv('TOTVIBE_DATA_DIR', dataDir);
  const sessionsDir = path.join(dataDir, 'sessions');
  await mkdir(sessionsDir, { recursive: true });
  for (const { id, modifiedAt, text } of sessions) await seedSession(sessionsDir, id, text, modifiedAt);
};

const runtime = {
  buildConfig,
  buildModel,
  bunHost,
  captureHost,
  clearConfigEnv,
  CONNECTED_PROVIDER_KEYS,
  createRuntime,
  DEFAULT_PROVIDER,
  dispatchClientCommand,
  findProvider,
  HTTP_FORBIDDEN,
  HTTP_INTERNAL_SERVER_ERROR,
  HTTP_OK,
  HTTP_UNAUTHORIZED,
  isConnected,
  isolateEnv,
  loadInitialConfig,
  makeRuntime,
  makeScratchDir,
  mkdir,
  path,
  PROVIDERS,
  scriptModelTurns,
  seedSession,
  seedSessions,
  setModelReply,
  stubFetch,
  textTurn,
  toolCallTurn,
  utimes,
  validateApiKey,
  writeFile,
};
export const test = base.extend<{ runtime: typeof runtime }>({
  runtime: async ({}, provide) => {
    await provide(runtime);
  },
});
