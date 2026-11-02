import { describe, expect } from 'vitest';

import type { ModelMessage } from '#core';

import { type AgentEvent, test } from '#core';

const MINUTE_MS = 60_000;

describe('3.1 broadcasting agent events', () => {
  test('3.1.1 delivers events to every subscriber until it unsubscribes', ({ core: fixture }) => {
    const bus = new fixture.EventBus();
    const first: AgentEvent[] = [];
    const second: AgentEvent[] = [];
    const unsubscribeFirst = bus.subscribe(event => {
      first.push(event);
    });
    bus.subscribe(event => {
      second.push(event);
    });
    bus.publish({ type: 'turn_start' });
    unsubscribeFirst();
    bus.publish({ finishReason: 'stop', type: 'turn_end' });
    expect(first).toEqual([{ type: 'turn_start' }]);
    expect(second).toEqual([{ type: 'turn_start' }, { finishReason: 'stop', type: 'turn_end' }]);
  });
});

describe('3.2 appending records to a jsonl log', () => {
  test('3.2.1 appends records in order and reads them back through a schema', async ({ core: fixture }) => {
    const dir = await fixture.scratchDir();
    const log = new fixture.JsonlLog(fixture.path.join(dir, 'nested', 'log.jsonl'));
    log.append({ n: 1 });
    log.append({ n: 2 });
    await log.flushed();
    const records = await log.readAll(fixture.CountRecordSchema);
    expect(records).toEqual([{ n: 1 }, { n: 2 }]);
  });

  test('3.2.2 reads an absent log as an empty history', async ({ core: fixture }) => {
    const dir = await fixture.scratchDir();
    const log = new fixture.JsonlLog(fixture.path.join(dir, 'missing.jsonl'));
    expect(await log.readAll(fixture.EmptyRecordSchema)).toEqual([]);
  });
});

describe('3.3 persisting and resuming sessions', () => {
  test('3.3.1 persists only message events and loads them back', async ({ core: fixture }) => {
    const dir = await fixture.scratchDir();
    const store = new fixture.SessionStore(dir, 's1');
    const message: ModelMessage = { content: 'hello', role: 'user' };
    store.persist({ message, type: 'message' });
    store.persist({ finishReason: 'stop', type: 'turn_end' });
    await store.flushed();
    expect(await fixture.loadSessionMessages(dir, 's1')).toEqual([message]);
  });

  test('3.3.2 finds the most recently modified session id', async ({ core: fixture }) => {
    const dir = await fixture.scratchDir();
    const older = new fixture.SessionStore(dir, 'older');
    older.persist({ message: { content: 'a', role: 'user' }, type: 'message' });
    await older.flushed();
    const newer = new fixture.SessionStore(dir, 'newer');
    newer.persist({ message: { content: 'b', role: 'user' }, type: 'message' });
    await newer.flushed();
    const past = new Date(Date.now() - MINUTE_MS);
    await fixture.utimes(fixture.path.join(dir, 'older.jsonl'), past, past);
    expect(await fixture.findLatestSessionId(dir)).toBe('newer');
    expect(await fixture.findLatestSessionId(fixture.path.join(dir, 'nowhere'))).toBeUndefined();
  });

  test('3.3.3 creates sessions with a fresh id and empty history by default', ({ core: fixture }) => {
    const session = fixture.createSession();
    expect(session.id).toMatch(/[0-9a-f-]{36}/);
    expect(session.messages).toEqual([]);
    const seeded = fixture.createSession('s9', [{ content: 'hi', role: 'user' }]);
    expect(seeded).toEqual({ id: 's9', messages: [{ content: 'hi', role: 'user' }] });
  });
});
