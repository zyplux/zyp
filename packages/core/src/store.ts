import { readdir } from 'node:fs/promises';
import path from 'node:path';
import * as z from 'zod';

import type { ModelMessage } from './ai-core';
import type { AgentEvent } from './interfaces';

import { modelMessageSchema } from './contracts';
import { JsonlLog } from './jsonl';

const MessageRecordSchema = z.object({ message: modelMessageSchema });

export class SessionStore {
  private readonly log: JsonlLog;

  constructor(
    private readonly dir: string,
    private readonly sessionId: string,
  ) {
    this.log = new JsonlLog(sessionFilePath(dir, sessionId));
  }

  flushed() {
    return this.log.flushed();
  }

  persist(event: AgentEvent) {
    type MessageRecord = {
      message: ModelMessage;
    };
    if (event.type !== 'message') return;
    const { message } = event;
    this.log.append({ message } satisfies MessageRecord);
  }
}

const sessionFilePath = (dir: string, sessionId: string) => path.join(dir, `${sessionId}.jsonl`);

export const loadSessionMessages = async (dir: string, sessionId: string) => {
  const log = new JsonlLog(sessionFilePath(dir, sessionId));
  const records = await log.readAll(MessageRecordSchema);
  return records.map(record => record.message);
};

export const findLatestSessionId = async (dir: string) => {
  let entries: { fileModTime: number; name: string }[];
  try {
    const names = await readdir(dir);
    entries = await Promise.all(
      names
        .filter(name => name.endsWith('.jsonl'))
        .map(async name => {
          const stat = await Bun.file(path.join(dir, name)).stat();
          return { fileModTime: stat.mtimeMs, name: name.slice(0, -'.jsonl'.length) };
        }),
    );
  } catch {
    return;
  }
  const [latest] = entries.toSorted((a, b) => b.fileModTime - a.fileModTime);
  return latest?.name;
};
