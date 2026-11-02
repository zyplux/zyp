import type { ToolInvocation } from '@totvibe/core/index';
import type { PolicyDecisionRecord } from '@totvibe/safety/index';
import type { ToolAction } from '@totvibe/safety/index';

import { AuditLedger, decidePolicy, policyGate, resolveAction } from '@totvibe/safety/index';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test as base } from 'vitest';
import * as z from 'zod';

export type { ApprovalRequest, PolicyDecisionRecord } from '@totvibe/safety/index';

const commandAction = (command: string) =>
  ({
    command,
    input: { command },
    name: 'run_bash',
    risk: 'mutate',
  }) satisfies ToolAction;

const mutatingInvocation: ToolInvocation = {
  input: { command: 'touch note.txt' },
  name: 'run_bash',
  risk: 'mutate',
};

const readInvocation: ToolInvocation = {
  input: { path: 'README.md' },
  name: 'read_file',
  risk: 'read',
};

const runNext = () => Promise.resolve('tool output');

const recordedGate = (
  options: Partial<Parameters<typeof policyGate>[0]> & Pick<Parameters<typeof policyGate>[0], 'approve'>,
) => {
  const records: PolicyDecisionRecord[] = [];
  const gate = policyGate({
    onDecision: record => {
      records.push(record);
    },
    ...options,
  });
  return { gate, records };
};
const AuditRecordSchema = z.object({
  absolute: z.boolean(),
  decision: z.string(),
  input: z.unknown(),
  reason: z.string(),
  risk: z.string(),
  time: z.string(),
  tool: z.string(),
});
const safety = {
  AuditLedger,
  AuditRecordSchema,
  commandAction,
  decidePolicy,
  mkdtemp,
  mutatingInvocation,
  path,
  policyGate,
  readFile,
  readInvocation,
  recordedGate,
  resolveAction,
  runNext,
  tmpdir,
  z,
};
export const test = base.extend<{ safety: typeof safety }>({
  safety: async ({}, provide) => {
    await provide(safety);
  },
});
