import { describe, expect } from 'vitest';

import { test } from '#core';

const echoCall = { input: { text: 'hi' }, toolCallId: 'call-1', toolName: 'echo' };

describe('1.1 streaming a plain reply', () => {
  test('1.1.1 yields the user message, streamed text, and turn end', async ({ core: fixture }) => {
    fixture.scriptModelTurns(fixture.textTurn('pong'));
    const session = fixture.createSession('s1');
    const events = await fixture.collectEvents(fixture.runAgent(session, 'ping', fixture.agentDeps()));
    expect(fixture.eventTypes(events)).toEqual(['message', 'turn_start', 'text', 'message', 'turn_end']);
    expect(events.find(event => event.type === 'text')).toEqual({ text: 'pong', type: 'text' });
    expect(session.messages).toEqual([
      { content: 'ping', role: 'user' },
      { content: 'pong', role: 'assistant' },
    ]);
  });

  test('1.1.2 relays reasoning deltas as reasoning events', async ({ core: fixture }) => {
    fixture.scriptModelTurns(
      fixture.textTurn('done', {
        parts: [
          { text: 'thinking hard', type: 'reasoning-delta' },
          { text: 'done', type: 'text-delta' },
        ],
      }),
    );
    const events = await fixture.collectEvents(fixture.runAgent(fixture.createSession(), 'go', fixture.agentDeps()));
    expect(events).toContainEqual({ text: 'thinking hard', type: 'reasoning' });
  });
});

describe('1.2 executing tool calls between turns', () => {
  test('1.2.1 runs the requested tool and feeds the result into the next turn', async ({ core: fixture }) => {
    fixture.scriptModelTurns(fixture.toolCallTurn([echoCall]), fixture.textTurn('all done'));
    const session = fixture.createSession();
    const events = await fixture.collectEvents(fixture.runAgent(session, 'use the tool', fixture.agentDeps()));
    expect(events).toContainEqual({ id: 'call-1', input: { text: 'hi' }, name: 'echo', type: 'tool_call' });
    expect(events).toContainEqual({ id: 'call-1', name: 'echo', output: 'echo: hi', type: 'tool_result' });
    expect(events.at(-1)).toEqual({ finishReason: 'stop', type: 'turn_end' });
    const toolMessage = session.messages.find(message => message.role === 'tool');
    expect(toolMessage?.content).toEqual([
      { output: { type: 'text', value: 'echo: hi' }, toolCallId: 'call-1', toolName: 'echo', type: 'tool-result' },
    ]);
  });

  test('1.2.2 reports a call to an unknown tool as a tool error', async ({ core: fixture }) => {
    fixture.scriptModelTurns(
      fixture.toolCallTurn([{ input: {}, toolCallId: 'call-9', toolName: 'teleport' }]),
      fixture.textTurn('sorry'),
    );
    const events = await fixture.collectEvents(
      fixture.runAgent(fixture.createSession(), 'try it', fixture.agentDeps()),
    );
    const toolError = events.find(event => event.type === 'tool_error');
    if (toolError?.type !== 'tool_error') throw new Error('expected a tool_error event');
    expect(toolError.error).toContain('Unknown tool "teleport"');
  });
});

describe('1.3 surviving model failures', () => {
  test('1.3.1 emits an error event when the model fails and no fallback exists', async ({ core: fixture }) => {
    fixture.scriptModelTurns(fixture.failingTurn(new Error('rate limited')));
    const events = await fixture.collectEvents(fixture.runAgent(fixture.createSession(), 'hello', fixture.agentDeps()));
    expect(events.at(-1)).toEqual({ error: 'rate limited', type: 'error' });
  });

  test('1.3.2 retries the turn on the fallback model when the primary fails', async ({ core: fixture }) => {
    fixture.scriptModelTurns(fixture.failingTurn(new Error('primary down')), fixture.textTurn('fallback says hi'));
    const events = await fixture.collectEvents(
      fixture.runAgent(fixture.createSession(), 'hello', fixture.agentDeps({ fallbackModel: 'fallback-model' })),
    );
    expect(events).toContainEqual({ text: 'fallback says hi', type: 'text' });
    expect(events.at(-1)).toEqual({ finishReason: 'stop', type: 'turn_end' });
  });

  test('1.3.3 emits an error event when the fallback model also fails', async ({ core: fixture }) => {
    fixture.scriptModelTurns(
      fixture.failingTurn(new Error('primary down')),
      fixture.failingTurn(new Error('fallback down')),
    );
    const events = await fixture.collectEvents(
      fixture.runAgent(fixture.createSession(), 'hello', fixture.agentDeps({ fallbackModel: 'fallback-model' })),
    );
    expect(events.at(-1)).toEqual({ error: 'fallback down', type: 'error' });
  });
});

describe('1.4 enforcing limits and cancellation', () => {
  test('1.4.1 stops with max_steps when the model keeps calling tools', async ({ core: fixture }) => {
    fixture.scriptModelTurns(
      fixture.toolCallTurn([echoCall]),
      fixture.toolCallTurn([echoCall]),
      fixture.textTurn('never reached'),
    );
    const events = await fixture.collectEvents(
      fixture.runAgent(fixture.createSession(), 'loop', fixture.agentDeps({ maxSteps: 2 })),
    );
    expect(events.at(-1)).toEqual({ finishReason: 'max_steps', type: 'turn_end' });
  });

  test('1.4.2 stops with token_budget once usage exceeds the budget', async ({ core: fixture }) => {
    fixture.scriptModelTurns(
      fixture.toolCallTurn([echoCall], { usage: { inputTokens: 400, outputTokens: 200 } }),
      fixture.textTurn('never reached'),
    );
    const events = await fixture.collectEvents(
      fixture.runAgent(fixture.createSession(), 'spend', fixture.agentDeps({ tokenBudget: 500 })),
    );
    expect(events.at(-1)).toEqual({ finishReason: 'token_budget', type: 'turn_end' });
  });

  test('1.4.3 stops with wall_clock once the deadline passes', async ({ core: fixture }) => {
    fixture.scriptModelTurns(fixture.toolCallTurn([echoCall]), fixture.textTurn('never reached'));
    const events = await fixture.collectEvents(
      fixture.runAgent(fixture.createSession(), 'slow', fixture.agentDeps({ wallClockMs: -1 })),
    );
    expect(events.at(-1)).toEqual({ finishReason: 'wall_clock', type: 'turn_end' });
  });

  test('1.4.4 yields aborted when the signal is already cancelled', async ({ core: fixture }) => {
    const controller = new AbortController();
    controller.abort();
    fixture.scriptModelTurns(fixture.textTurn('never reached'));
    const events = await fixture.collectEvents(
      fixture.runAgent(fixture.createSession(), 'stop', fixture.agentDeps({ signal: controller.signal })),
    );
    expect(events.at(-1)).toEqual({ type: 'aborted' });
  });

  test('1.4.5 yields aborted when the stream reports an abort mid-turn', async ({ core: fixture }) => {
    fixture.scriptModelTurns(fixture.abortedTurn());
    const events = await fixture.collectEvents(fixture.runAgent(fixture.createSession(), 'stop', fixture.agentDeps()));
    expect(events.at(-1)).toEqual({ type: 'aborted' });
  });
});
