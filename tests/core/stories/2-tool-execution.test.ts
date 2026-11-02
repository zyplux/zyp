import { describe, expect } from 'vitest';

import { type Middleware, test, type ToolCallRequest, type ToolContext } from '#core';

const context: ToolContext = { cwd: '/tmp' };

const echoCall = (id: string, text: string) => ({
  input: { text },
  toolCallId: id,
  toolName: 'echo',
});

describe('2.1 executing a single tool call', () => {
  test('2.1.1 runs the tool through the middleware and returns its output', async ({ core: fixture }) => {
    const seen: string[] = [];
    const spy: Middleware = (invocation, next) => {
      seen.push(invocation.name);
      return next();
    };
    const outcome = await fixture.executeToolCall([fixture.echoTool], echoCall('c1', 'hi'), context, spy);
    expect(outcome).toEqual({ isError: false, text: 'echo: hi', toolCallId: 'c1', toolName: 'echo' });
    expect(seen).toEqual(['echo']);
  });

  test('2.1.2 returns an error outcome for an unknown tool', async ({ core: fixture }) => {
    const outcome = await fixture.executeToolCall(
      [fixture.echoTool],
      { input: {}, toolCallId: 'c1', toolName: 'teleport' },
      context,
      fixture.passthrough,
    );
    expect(outcome?.isError).toBe(true);
    expect(outcome?.text).toContain('Unknown tool "teleport"');
  });

  test('2.1.3 captures a thrown tool error as an error outcome', async ({ core: fixture }) => {
    const outcome = await fixture.executeToolCall(
      [fixture.failingTool],
      { input: { text: 'x' }, toolCallId: 'c1', toolName: 'explode' },
      context,
      fixture.passthrough,
    );
    expect(outcome).toEqual({ isError: true, text: 'tool exploded', toolCallId: 'c1', toolName: 'explode' });
  });
});

describe('2.2 batching read-only calls', () => {
  test('2.2.1 preserves outcome order across mixed read-only and mutating calls', async ({ core: fixture }) => {
    const log: string[] = [];
    const recordTool = fixture.makeMutatingTool(log);
    const calls: ToolCallRequest[] = [
      echoCall('c1', 'one'),
      echoCall('c2', 'two'),
      { input: { text: 'three' }, toolCallId: 'c3', toolName: 'record' },
      echoCall('c4', 'four'),
    ];
    const outcomes = await fixture.runToolCalls([fixture.echoTool, recordTool], calls, context, fixture.passthrough);
    expect(outcomes.map(outcome => outcome.text)).toEqual(['echo: one', 'echo: two', 'recorded: three', 'echo: four']);
    expect(log).toEqual(['three']);
  });

  test('2.2.2 runs consecutive read-only calls concurrently', async ({ core: fixture }) => {
    const HOLD_MS = 5;
    const readOnlyCalls = [echoCall('c1', 'a'), echoCall('c2', 'b')];
    let active = 0;
    let peak = 0;
    const gate: Middleware = async (_invocation, next) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, HOLD_MS));
      const text = await next();
      active -= 1;
      return text;
    };
    await fixture.runToolCalls([fixture.echoTool], readOnlyCalls, context, gate);
    expect(peak).toBe(readOnlyCalls.length);
  });
});

describe('2.3 describing tools to the model', () => {
  test('2.3.1 exposes every definition in the model tool set by name', ({ core: fixture }) => {
    const toolSet = fixture.buildModelToolSet([fixture.echoTool, fixture.failingTool]);
    expect(Object.keys(toolSet).toSorted((a, b) => a.localeCompare(b))).toEqual(['echo', 'explode']);
    expect(toolSet).toHaveProperty(['echo', 'description'], 'Echoes its input back.');
  });
});

describe('2.4 composing middleware', () => {
  test('2.4.1 applies middleware in declaration order around the tool', async ({ core: fixture }) => {
    const order: string[] = [];
    const tag = (name: string) => {
      const wrap: Middleware = async (_invocation, next) => {
        order.push(`${name}:before`);
        const text = await next();
        order.push(`${name}:after`);
        return text;
      };
      return wrap;
    };
    const chain = fixture.compose(tag('outer'), tag('inner'));
    const text = await chain({ input: {}, name: 'echo', risk: 'read' }, () => Promise.resolve('done'));
    expect(text).toBe('done');
    expect(order).toEqual(['outer:before', 'inner:before', 'inner:after', 'outer:after']);
  });
});
