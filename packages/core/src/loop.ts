import type { AgentEvent } from './interfaces';
import type { Session } from './session';

import { type LanguageModel, type ModelMessage, streamText, type ToolResultPart, type ToolSet } from './ai-core';
import { type Middleware, passthrough } from './pipeline';
import {
  type AnyToolDef,
  buildModelToolSet,
  runToolCalls,
  type ToolCallOutcome,
  type ToolCallRequest,
  type ToolContext,
} from './tool';

export type AgentDeps = {
  cwd: string;
  fallbackModel?: LanguageModel;
  maxSteps?: number;
  middleware?: Middleware;
  model: LanguageModel;
  signal?: AbortSignal;
  system: string;
  tokenBudget?: number;
  tools: AnyToolDef[];
  wallClockMs?: number;
};

const DEFAULT_MAX_STEPS = 24;

export async function* runAgent({ messages }: Session, userText: string, deps: AgentDeps) {
  const maxSteps = deps.maxSteps ?? DEFAULT_MAX_STEPS;
  const middleware = deps.middleware ?? passthrough;
  const modelTools = buildModelToolSet(deps.tools);
  const toolContext: ToolContext = { cwd: deps.cwd, signal: deps.signal };
  const deadline = deps.wallClockMs ? Date.now() + deps.wallClockMs : undefined;

  const userMessage: ModelMessage = { content: userText, role: 'user' };
  messages.push(userMessage);
  yield { message: userMessage, type: 'message' } satisfies AgentEvent;
  yield { type: 'turn_start' } satisfies AgentEvent;

  let usedTokens = 0;

  for (let step = 0; step < maxSteps; step += 1) {
    type TurnResult = {
      aborted: boolean;
      calls: ToolCallRequest[];
      finishReason: string;
      messages: ModelMessage[];
      tokens: number;
    };
    const ending = findTurnEnd(deps, deadline, usedTokens);
    if (ending) {
      yield ending;
      return;
    }

    let turn: TurnResult;
    try {
      turn = yield* streamWithFallback(deps, messages, modelTools);
    } catch (error) {
      yield { error: describeError(error), type: 'error' } satisfies AgentEvent;
      return;
    }

    if (turn.aborted) {
      yield { type: 'aborted' } satisfies AgentEvent;
      return;
    }

    yield* appendMessages(messages, turn.messages);
    usedTokens += turn.tokens;

    if (turn.calls.length === 0) {
      yield { finishReason: turn.finishReason, type: 'turn_end' } satisfies AgentEvent;
      return;
    }

    const outcomes = await runToolCalls(deps.tools, turn.calls, toolContext, middleware);
    const toolMessage = buildToolMessage(outcomes);
    messages.push(toolMessage);
    for (const outcome of outcomes) yield makeToolEvent(outcome);
    yield { message: toolMessage, type: 'message' } satisfies AgentEvent;
  }

  yield { finishReason: 'max_steps', type: 'turn_end' } satisfies AgentEvent;
}

function* appendMessages(messages: ModelMessage[], incoming: ModelMessage[]) {
  for (const message of incoming) {
    messages.push(message);
    yield { message, type: 'message' } satisfies AgentEvent;
  }
}

const findTurnEnd = ({ signal, tokenBudget }: AgentDeps, deadline: number | undefined, usedTokens: number) => {
  if (signal?.aborted) return { type: 'aborted' } satisfies AgentEvent;
  if (deadline !== undefined && Date.now() > deadline)
    return { finishReason: 'wall_clock', type: 'turn_end' } satisfies AgentEvent;
  if (tokenBudget !== undefined && usedTokens >= tokenBudget)
    return { finishReason: 'token_budget', type: 'turn_end' } satisfies AgentEvent;
};

async function* streamWithFallback(deps: AgentDeps, messages: ModelMessage[], modelTools: ToolSet) {
  try {
    return yield* streamModelTurn(deps.model, deps, messages, modelTools);
  } catch (error) {
    if (!deps.fallbackModel) throw error;
    return yield* streamModelTurn(deps.fallbackModel, deps, messages, modelTools);
  }
}

const makeToolEvent = ({ isError, text, toolCallId, toolName }: ToolCallOutcome) =>
  isError
    ? ({ error: text, id: toolCallId, name: toolName, type: 'tool_error' } satisfies AgentEvent)
    : ({ id: toolCallId, name: toolName, output: text, type: 'tool_result' } satisfies AgentEvent);

const buildToolMessage = (outcomes: ToolCallOutcome[]) => {
  const content: ToolResultPart[] = outcomes.map(outcome => ({
    output: outcome.isError ? { type: 'error-text', value: outcome.text } : { type: 'text', value: outcome.text },
    toolCallId: outcome.toolCallId,
    toolName: outcome.toolName,
    type: 'tool-result',
  }));
  const message: ModelMessage = { content, role: 'tool' };
  return message;
};

const describeError = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function* streamModelTurn(
  model: LanguageModel,
  { signal, system }: AgentDeps,
  messages: ModelMessage[],
  modelTools: ToolSet,
) {
  const stream = streamText({
    abortSignal: signal,
    instructions: system,
    messages,
    model,
    onError: () => void 0,
    tools: modelTools,
  });

  for await (const part of stream.stream) {
    if (part.type === 'error') throw toError(part.error);
    if (part.type === 'abort') {
      return {
        aborted: true,
        calls: [],
        finishReason: 'aborted',
        messages: [],
        tokens: 0,
      };
    }
    if (part.type === 'reasoning-delta' || part.type === 'text-delta') {
      yield { text: part.text, type: part.type === 'reasoning-delta' ? 'reasoning' : 'text' } satisfies AgentEvent;
    } else if (part.type === 'tool-call') {
      const input: unknown = part.input;
      yield {
        id: part.toolCallId,
        input,
        name: part.toolName,
        type: 'tool_call',
      } satisfies AgentEvent;
    }
  }

  const finalStep = await stream.finalStep;
  const finishReason = await stream.finishReason;
  const usage = await stream.usage;
  const toolCalls = await stream.toolCalls;
  const calls: ToolCallRequest[] = toolCalls.map(call => {
    const input: unknown = call.input;
    return { input, toolCallId: call.toolCallId, toolName: call.toolName };
  });
  return {
    aborted: false,
    calls,
    finishReason,
    messages: finalStep.response.messages,
    tokens: usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
  };
}

const toError = (error: unknown) => (error instanceof Error ? error : new Error(String(error)));
