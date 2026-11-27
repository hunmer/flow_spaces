/**
 * Focused unit tests for the minimal LangChain chat module.
 *
 * Offline: argument validation, tool definition bridging and a full
 * invoke/dispatch tool loop driven by a scripted mock chat model — no
 * network. Wire-level behavior (real @langchain/openai / @langchain/anthropic
 * serialization) is covered by langchain-chat-http.test.ts.
 *
 * Run: cd packages/server && pnpm exec tsx --test src/adapters/langchain-chat.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LangChainChatIncompleteToolLoopError,
  langchainChat,
  mapLangChainChatProvider,
  toLangChainToolDefinitions,
  type LangChainChatTool,
} from './langchain-chat.js';

function makeTool(overrides?: Partial<LangChainChatTool>): LangChainChatTool {
  return {
    name: 'get_weather',
    description: 'Get current weather for a city',
    inputSchema: {
      type: 'object',
      properties: { city: { type: 'string' } },
      required: ['city'],
      additionalProperties: false,
    },
    execute: async (input) => ({ echo: input, via: 'execute' }),
    ...overrides,
  };
}

interface MockAiMessage {
  content: unknown;
  tool_calls?: Array<{ id: string; name: string; args: Record<string, unknown> }>;
  usage_metadata?: { input_tokens: number; output_tokens: number; total_tokens?: number };
  response_metadata?: Record<string, unknown>;
  additional_kwargs?: Record<string, unknown>;
}

interface MockModelCall {
  messages: unknown[];
  options?: { signal?: AbortSignal };
}

/** Scripted duck-typed chat model: each invoke pops the next scripted AIMessage. */
function makeMockModel(script: MockAiMessage[]) {
  const calls: MockModelCall[] = [];
  let bound: unknown[] | undefined;
  const model = {
    invoke: async (messages: unknown[], options?: { signal?: AbortSignal }) => {
      calls.push({ messages, options });
      const next = script[calls.length - 1];
      if (!next) throw new Error(`mock model exhausted after ${calls.length - 1} call(s)`);
      return next;
    },
    bindTools: (tools: unknown[]) => {
      bound = tools;
      return model;
    },
    get bindToolsCalls() {
      return bound;
    },
    get invokeCalls() {
      return calls;
    },
  };
  return model;
}

test('langchainChat rejects unsupported provider', async () => {
  await assert.rejects(
    langchainChat({ provider: 'grok' as never, model: 'm', prompt: 'hi' }),
    /unsupported provider 'grok'/,
  );
});

test('langchainChat rejects empty model', async () => {
  await assert.rejects(
    langchainChat({ provider: 'openai', model: '', prompt: 'hi' }),
    /model is required/,
  );
});

test('langchainChat rejects empty prompt', async () => {
  await assert.rejects(
    langchainChat({ provider: 'anthropic', model: 'claude-3', prompt: '' }),
    /non-empty string/,
  );
});

test('langchainChat rejects tools when the model cannot bind them', async () => {
  const model = { invoke: async () => ({ content: 'x' }) };
  await assert.rejects(
    langchainChat({
      provider: 'openai',
      model: 'm',
      prompt: 'hi',
      chatModel: model,
      tools: [makeTool()],
    }),
    /does not support bindTools/,
  );
});

test('mapLangChainChatProvider maps chat agent provider ids', () => {
  assert.equal(mapLangChainChatProvider('anthropic-messages'), 'anthropic');
  assert.equal(mapLangChainChatProvider('openai-chat-completions'), 'openai');
  assert.equal(mapLangChainChatProvider('openai-responses'), 'openai');
  assert.equal(mapLangChainChatProvider(undefined), 'openai');
  assert.equal(mapLangChainChatProvider(''), 'openai');
  assert.equal(mapLangChainChatProvider('gemini-generate-content'), null);
  assert.equal(mapLangChainChatProvider('nonsense'), null);
});

test('toLangChainToolDefinitions returns undefined for no tools', () => {
  assert.equal(toLangChainToolDefinitions(undefined), undefined);
  assert.equal(toLangChainToolDefinitions([]), undefined);
});

test('toLangChainToolDefinitions carries name / description / schema', () => {
  const definitions = toLangChainToolDefinitions([makeTool()]);
  assert.ok(definitions && definitions.length === 1);
  const first = definitions[0] as { name: string; description: string; schema: unknown };
  assert.equal(first.name, 'get_weather');
  assert.equal(first.description, 'Get current weather for a city');
  assert.ok(first.schema);
});

test('langchainChat returns final text without tools (mock model)', async () => {
  const model = makeMockModel([
    {
      content: [{ type: 'text', text: 'pong' }],
      usage_metadata: { input_tokens: 3, output_tokens: 2, total_tokens: 5 },
      response_metadata: { finish_reason: 'stop' },
    },
  ]);

  const result = await langchainChat({
    provider: 'anthropic',
    model: 'mock-model',
    prompt: 'ping',
    system: 'Be terse.',
    chatModel: model,
  });

  assert.equal(result.text, 'pong');
  assert.equal(result.finishReason, 'stop');
  assert.deepEqual(result.toolCalls, []);
  assert.deepEqual(result.usage, { inputTokens: 3, outputTokens: 2, totalTokens: 5 });
  assert.deepEqual(result.events, []);

  // system + user messages were sent to the model.
  assert.equal(model.invokeCalls.length, 1);
  const messages = model.invokeCalls[0].messages as Array<{ role: string; content: string }>;
  assert.equal(messages[0].role, 'system');
  assert.equal(messages[0].content, 'Be terse.');
  assert.equal(messages[1].role, 'user');
  assert.equal(messages[1].content, 'ping');
});

test('langchainChat runs a full tool loop end-to-end (mock model)', async () => {
  const seen: Array<{ input: unknown; toolUseId: string | undefined }> = [];

  const model = makeMockModel([
    {
      content: [{ type: 'thinking', thinking: 'User wants weather.' }],
      tool_calls: [{ id: 'call-mock-1', name: 'get_weather', args: { city: 'Beijing' } }],
      usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      response_metadata: { finish_reason: 'tool_calls' },
    },
    {
      content: [{ type: 'text', text: 'It is sunny in Beijing.' }],
      usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      response_metadata: { finish_reason: 'stop' },
    },
  ]);

  const result = await langchainChat({
    provider: 'openai',
    model: 'mock-model',
    prompt: 'What is the weather in Beijing?',
    chatModel: model,
    tools: [
      makeTool({
        executeWithToolUseId: async (input, toolUseId) => {
          seen.push({ input, toolUseId });
          return { weather: 'sunny' };
        },
      }),
    ],
  });

  assert.equal(result.text, 'It is sunny in Beijing.');
  assert.equal(result.finishReason, 'stop');

  // The tool call from step 1 is reported with its parsed input.
  assert.deepEqual(result.toolCalls, [
    { toolName: 'get_weather', input: { city: 'Beijing' } },
  ]);

  // Our loop executed the tool with the model's tool call id.
  assert.deepEqual(seen, [{ input: { city: 'Beijing' }, toolUseId: 'call-mock-1' }]);

  // The loop really took two model calls.
  assert.equal(model.invokeCalls.length, 2);

  // Events carry the ordered timeline: reasoning → tool_use → tool_result.
  assert.deepEqual(result.events, [
    { type: 'reasoning', text: 'User wants weather.', status: 'completed' },
    { type: 'tool_use', id: 'call-mock-1', name: 'get_weather', input: { city: 'Beijing' }, line: '' },
    { type: 'tool_result', toolUseId: 'call-mock-1', result: { weather: 'sunny' } },
  ]);

  // Usage is summed across both steps.
  assert.deepEqual(result.usage, { inputTokens: 20, outputTokens: 10, totalTokens: 30 });

  // bindTools was called with the tool definition, and the follow-up request
  // carries the assistant message plus the tool result message.
  assert.equal(model.bindToolsCalls?.length, 1);
  const step2Messages = model.invokeCalls[1].messages as Array<Record<string, unknown>>;
  assert.ok(step2Messages.some((m) => m.tool_calls), 'assistant tool_calls message not sent back');
  const toolMessage = step2Messages.find((m) => m.role === 'tool') as
    | { content: string; tool_call_id: string }
    | undefined;
  assert.ok(toolMessage, 'tool result message not sent back');
  assert.equal(toolMessage.tool_call_id, 'call-mock-1');
  assert.ok(toolMessage.content.includes('sunny'));
});

test('langchainChat throws IncompleteToolLoopError when maxSteps is exhausted', async () => {
  const toolCall = (id: string, city: string): MockAiMessage => ({
    content: [],
    tool_calls: [{ id, name: 'get_weather', args: { city } }],
    usage_metadata: { input_tokens: 7, output_tokens: 3, total_tokens: 10 },
    response_metadata: { finish_reason: 'tool_calls' },
  });

  const model = makeMockModel([toolCall('call-x1', 'Beijing'), toolCall('call-x2', 'Oslo')]);

  await assert.rejects(
    langchainChat({
      provider: 'openai',
      model: 'mock-model',
      prompt: 'weather in every city',
      chatModel: model,
      tools: [makeTool({ execute: async () => ({ weather: 'sunny' }) })],
      maxSteps: 2,
    }),
    (error: unknown) => {
      assert.ok(
        error instanceof LangChainChatIncompleteToolLoopError,
        `expected LangChainChatIncompleteToolLoopError, got ${String(error)}`,
      );
      assert.equal(error.name, 'LangChainChatIncompleteToolLoopError');
      assert.match(error.message, /tool loop ended without a final text answer/);
      // All steps' tool calls are reported.
      assert.equal(error.toolCalls.length, 2);
      assert.deepEqual(error.toolCalls.map((c) => c.input), [
        { city: 'Beijing' },
        { city: 'Oslo' },
      ]);
      // Usage is the sum over all steps: 7+7 input, 3+3 output.
      assert.equal(error.usage.inputTokens, 14);
      assert.equal(error.usage.outputTokens, 6);
      assert.equal(error.usage.totalTokens, 20);
      assert.equal(error.finishReason, 'tool-calls');
      // Process data stays available: 2 tool_use + 2 tool_result events.
      assert.equal(error.events.length, 4);
      return true;
    },
  );
  assert.equal(model.invokeCalls.length, 2);
});

test('langchainChat reads reasoning from additional_kwargs (OpenAI-compatible deepseek style)', async () => {
  const model = makeMockModel([
    {
      content: 'ok',
      additional_kwargs: { reasoning_content: 'let me think' },
      usage_metadata: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
      response_metadata: { finish_reason: 'stop' },
    },
  ]);

  const result = await langchainChat({
    provider: 'openai',
    model: 'mock-model',
    prompt: 'hi',
    chatModel: model,
  });

  assert.equal(result.text, 'ok');
  assert.deepEqual(result.events, [
    { type: 'reasoning', text: 'let me think', status: 'completed' },
  ]);
});

test('langchainChat reads anthropic stop_reason when finish_reason is absent', async () => {
  const model = makeMockModel([
    {
      content: [{ type: 'text', text: 'Bonjour' }],
      usage_metadata: { input_tokens: 9, output_tokens: 5, total_tokens: 14 },
      response_metadata: { stop_reason: 'end_turn' },
    },
  ]);

  const result = await langchainChat({
    provider: 'anthropic',
    model: 'mock-model',
    prompt: 'hi',
    chatModel: model,
  });

  assert.equal(result.finishReason, 'end_turn');
});

test('langchainChat falls back to anthropic token_usage when usage_metadata is absent', async () => {
  const model = makeMockModel([
    {
      content: 'ok',
      response_metadata: {
        stop_reason: 'end_turn',
        token_usage: { input_tokens: 4, output_tokens: 2 },
      },
    },
  ]);

  const result = await langchainChat({
    provider: 'anthropic',
    model: 'mock-model',
    prompt: 'hi',
    chatModel: model,
  });

  assert.deepEqual(result.usage, { inputTokens: 4, outputTokens: 2, totalTokens: 6 });
});

test('langchainChat rejects a model call to an unknown tool', async () => {
  const model = makeMockModel([
    {
      content: [],
      tool_calls: [{ id: 'call-1', name: 'not_registered', args: {} }],
      response_metadata: { finish_reason: 'tool_calls' },
    },
  ]);

  await assert.rejects(
    langchainChat({
      provider: 'openai',
      model: 'mock-model',
      prompt: 'hi',
      chatModel: model,
      tools: [makeTool()],
    }),
    /unknown tool 'not_registered'/,
  );
});

test('langchainChat propagates the abort signal to invoke', async () => {
  const invokeOptions: Array<{ signal?: AbortSignal } | undefined> = [];
  const controller = new AbortController();
  const model = {
    invoke: async (_messages: unknown[], options?: { signal?: AbortSignal }) => {
      invokeOptions.push(options);
      return { content: 'ok', response_metadata: { finish_reason: 'stop' } };
    },
  };

  await langchainChat({
    provider: 'openai',
    model: 'mock-model',
    prompt: 'hi',
    chatModel: model,
    abortSignal: controller.signal,
  });

  assert.equal(invokeOptions[0]?.signal, controller.signal);
});
