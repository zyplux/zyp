import { describe, expect } from 'vitest';

import { type SessionInfo, test } from '#view';

const session: SessionInfo = {
  cwd: '~/project',
  isProviderDialogOpen: false,
  modelId: 'qwen3.7-max',
  providerName: 'qwen',
};

describe('1.1 rendering agent events into the conversation', () => {
  test('1.1.1 streams assistant text into one growing message', ({ view: fixture }) => {
    const store = fixture.makeStore();
    fixture.applyServerEvent(store, { event: { text: 'Hello', type: 'text' }, type: 'agent' });
    fixture.applyServerEvent(store, { event: { text: ' world', type: 'text' }, type: 'agent' });
    expect(store.get(fixture.messagesAtom).map(message => message.text)).toEqual(['Hello world']);
    fixture.applyServerEvent(store, { role: 'user', text: 'thanks', type: 'message' });
    fixture.applyServerEvent(store, { event: { text: 'Anytime', type: 'text' }, type: 'agent' });
    expect(store.get(fixture.messagesAtom).map(message => message.text)).toEqual(['Hello world', 'thanks', 'Anytime']);
  });

  test('1.1.2 records a tool call with a preview of its input', ({ view: fixture }) => {
    const store = fixture.makeStore();
    fixture.applyServerEvent(store, {
      event: { id: 't1', input: { path: 'notes.txt' }, name: 'read_file', type: 'tool_call' },
      type: 'agent',
    });
    expect(store.get(fixture.messagesAtom)[0]).toMatchObject({
      role: 'tool',
      text: '⏺ read_file {"path":"notes.txt"}',
    });
  });

  test('1.1.3 records a tool error against the tool name', ({ view: fixture }) => {
    const store = fixture.makeStore();
    fixture.applyServerEvent(store, {
      event: { error: 'No such file: ghost.txt', id: 't1', name: 'read_file', type: 'tool_error' },
      type: 'agent',
    });
    expect(store.get(fixture.messagesAtom)[0]?.text).toBe('✗ read_file: No such file: ghost.txt');
  });

  test('1.1.4 ends the turn by stopping the stream and reporting the finish reason', ({ view: fixture }) => {
    const store = fixture.makeStore();
    fixture.applyServerEvent(store, { streaming: true, type: 'streaming' });
    fixture.applyServerEvent(store, { event: { finishReason: 'stop', type: 'turn_end' }, type: 'agent' });
    expect(store.get(fixture.streamingAtom)).toBe(false);
    expect(store.get(fixture.agentStatusAtom)).toBe('ready · stop');
  });

  test('1.1.5 surfaces aborts and errors in the status line', ({ view: fixture }) => {
    const store = fixture.makeStore();
    fixture.applyServerEvent(store, { event: { type: 'aborted' }, type: 'agent' });
    expect(store.get(fixture.agentStatusAtom)).toBe('aborted');
    fixture.applyServerEvent(store, { event: { error: 'boom', type: 'error' }, type: 'agent' });
    expect(store.get(fixture.agentStatusAtom)).toBe('error');
    expect(store.get(fixture.messagesAtom).at(-1)?.text).toBe('error: boom');
  });

  test('1.1.6 leaves the conversation untouched for bookkeeping events', ({ view: fixture }) => {
    const store = fixture.makeStore();
    fixture.applyServerEvent(store, { event: { type: 'turn_start' }, type: 'agent' });
    fixture.applyServerEvent(store, { event: { text: 'thinking', type: 'reasoning' }, type: 'agent' });
    fixture.applyServerEvent(store, {
      event: { id: 't1', name: 'read_file', output: 'x', type: 'tool_result' },
      type: 'agent',
    });
    fixture.applyServerEvent(store, {
      event: { message: { content: 'hi', role: 'user' }, type: 'message' },
      type: 'agent',
    });
    expect(store.get(fixture.messagesAtom)).toEqual([]);
  });
});

describe('1.2 tracking the session lifecycle', () => {
  test('1.2.1 init resets the conversation and seeds the session fields', ({ view: fixture }) => {
    const store = fixture.makeStore();
    fixture.applyServerEvent(store, { role: 'tool', text: 'stale', type: 'message' });
    fixture.applyServerEvent(store, { session, type: 'init' });
    expect(store.get(fixture.messagesAtom)).toEqual([]);
    expect(store.get(fixture.cwdAtom)).toBe('~/project');
    expect(store.get(fixture.providerNameAtom)).toBe('qwen');
    expect(store.get(fixture.modelIdAtom)).toBe('qwen3.7-max');
    expect(store.get(fixture.agentStatusAtom)).toBe('ready');
    expect(store.get(fixture.providerDialogOpenAtom)).toBe(false);
  });

  test('1.2.2 appends role-tagged messages with unique ids', ({ view: fixture }) => {
    const store = fixture.makeStore();
    fixture.applyServerEvent(store, { role: 'user', text: 'one', type: 'message' });
    fixture.applyServerEvent(store, { role: 'tool', text: 'two', type: 'message' });
    const messages = store.get(fixture.messagesAtom);
    expect(messages.map(message => message.role)).toEqual(['user', 'tool']);
    expect(new Set(messages.map(message => message.id)).size).toBe(messages.length);
  });

  test('1.2.3 tracks notices, streaming, status, approvals, and the sandbox', ({ view: fixture }) => {
    const store = fixture.makeStore();
    fixture.applyServerEvent(store, { text: 'Saved key', type: 'notice' });
    fixture.applyServerEvent(store, { streaming: true, type: 'streaming' });
    fixture.applyServerEvent(store, { status: 'thinking…', type: 'agent-status' });
    const request = { input: {}, name: 'run_bash', risk: 'mutate' as const };
    fixture.applyServerEvent(store, { request, type: 'approval-request' });
    const sandboxStatus = { available: true, degraded: false, enabled: true, hasLandlock: true, net: 'none' as const };
    fixture.applyServerEvent(store, { status: sandboxStatus, type: 'sandbox-status' });
    expect(store.get(fixture.noticeAtom)).toBe('Saved key');
    expect(store.get(fixture.streamingAtom)).toBe(true);
    expect(store.get(fixture.agentStatusAtom)).toBe('thinking…');
    expect(store.get(fixture.pendingApprovalAtom)).toEqual(request);
    expect(store.get(fixture.sandboxStatusAtom)).toEqual(sandboxStatus);
    fixture.applyServerEvent(store, { type: 'approval-request' });
    expect(store.get(fixture.pendingApprovalAtom)).toBeUndefined();
  });
});

describe('1.3 tracking providers and connections', () => {
  test('1.3.1 switches the active provider and model', ({ view: fixture }) => {
    const store = fixture.makeStore();
    fixture.applyServerEvent(store, { modelId: 'kimi-k2.6', providerName: 'kimi', type: 'provider-changed' });
    expect(store.get(fixture.providerNameAtom)).toBe('kimi');
    expect(store.get(fixture.modelIdAtom)).toBe('kimi-k2.6');
    expect(store.get(fixture.providerAtom).label).toBe('Moonshot Kimi');
  });

  test('1.3.2 falls back to the default provider for an unknown name', ({ view: fixture }) => {
    const store = fixture.makeStore();
    fixture.applyServerEvent(store, { modelId: 'x', providerName: 'nonexistent', type: 'provider-changed' });
    expect(store.get(fixture.providerAtom)).toBe(fixture.DEFAULT_PROVIDER);
  });

  test('1.3.3 tracks the connected provider set, connection status, and dialog', ({ view: fixture }) => {
    const store = fixture.makeStore();
    fixture.applyServerEvent(store, { names: ['qwen', 'kimi'], type: 'connected-providers' });
    fixture.applyServerEvent(store, { status: 'rejected', type: 'connection-status' });
    fixture.applyServerEvent(store, { open: true, type: 'provider-dialog' });
    expect(store.get(fixture.connectedProvidersAtom)).toEqual(new Set(['kimi', 'qwen']));
    expect(store.get(fixture.connectionStatusAtom)).toBe('rejected');
    expect(store.get(fixture.providerDialogOpenAtom)).toBe(true);
  });
});
