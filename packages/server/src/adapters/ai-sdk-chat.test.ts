/**
 * Focused unit tests for the minimal AI SDK chat module.
 *
 * Offline: argument validation, tool bridging, model resolution and a real
 * `generateText` tool loop driven by `MockLanguageModelV4` (from `ai/test`)
 * — no network. A live smoke test only runs when env vars
 * AI_SDK_CHAT_TEST_PROVIDER / _MODEL / _BASE_URL / _API_KEY are all set.
 *
 * Run: npx tsx src/adapters/ai-sdk-chat.test.ts   (deps: ai @ai-sdk/openai @ai-sdk/anthropic)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import type { LanguageModel } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';

import {
  AiSdkChatIncompleteToolLoopError,
  aiSdkChat,
  resolveAiSdkModel,
  toAiSdkToolSet,
  type AiSdkChatTool,
} from './ai-sdk-chat.js';

function makeTool(overrides?: Partial<AiSdkChatTool>): AiSdkChatTool {
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

test('aiSdkChat rejects unsupported provider', async () => {
  await assert.rejects(
    aiSdkChat({ provider: 'grok' as never, model: 'm', prompt: 'hi' }),
    /unsupported provider 'grok'/,
  );
});

test('aiSdkChat rejects empty model', async () => {
  await assert.rejects(
    aiSdkChat({ provider: 'openai', model: '', prompt: 'hi' }),
    /model is required/,
  );
});

test('aiSdkChat rejects empty prompt', async () => {
  await assert.rejects(
    aiSdkChat({ provider: 'anthropic', model: 'claude-3', prompt: '' }),
    /non-empty string/,
  );
});

test('toAiSdkToolSet returns undefined for no tools', () => {
  assert.equal(toAiSdkToolSet(undefined), undefined);
  assert.equal(toAiSdkToolSet([]), undefined);
});

test('toAiSdkToolSet wraps each tool under its name', () => {
  const set = toAiSdkToolSet([makeTool()]);
  assert.ok(set);
  assert.deepEqual(Object.keys(set), ['get_weather']);
  assert.equal(set!['get_weather'].description, 'Get current weather for a city');
  assert.ok(set!['get_weather'].inputSchema);
});

test('toAiSdkToolSet bridges executeWithToolUseId with the SDK toolCallId', async () => {
  const seen: Array<{ input: unknown; toolUseId: string | undefined }> = [];
  const t = makeTool({
    execute: async () => {
      throw new Error('plain execute must not be called');
    },
    executeWithToolUseId: async (input, toolUseId) => {
      seen.push({ input, toolUseId });
      return { ok: true };
    },
  });
  const set = toAiSdkToolSet([t]);
  const wrapped = set!.get_weather;
  const result = await wrapped.execute!(
    { city: 'Beijing' } as never,
    {
      toolCallId: 'call_abc',
      messages: [],
      abortSignal: undefined,
      context: undefined,
    } as never,
  );
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(seen, [{ input: { city: 'Beijing' }, toolUseId: 'call_abc' }]);
});

test('toAiSdkToolSet falls back to plain execute without toolUseId', async () => {
  const set = toAiSdkToolSet([makeTool()]);
  const result = await set!.get_weather.execute!(
    { city: 'Oslo' } as never,
    {
      toolCallId: 'call_xyz',
      messages: [],
      abortSignal: undefined,
      context: undefined,
    } as never,
  );
  assert.deepEqual(result, { echo: { city: 'Oslo' }, via: 'execute' });
});

test('resolveAiSdkModel builds openai and anthropic models without network', () => {
  const openaiModel = resolveAiSdkModel({
    provider: 'openai',
    model: 'deepseek-chat',
    apiKey: 'test-key',
    baseURL: 'https://example.invalid/v1',
  });
  assert.equal(typeof openaiModel, 'object');

  const anthropicModel = resolveAiSdkModel({
    provider: 'anthropic',
    model: 'claude-sonnet-4',
    apiKey: 'test-key',
    baseURL: 'https://example.invalid/v1',
  });
  assert.equal(typeof anthropicModel, 'object');
});

test('aiSdkChat runs a real generateText tool loop end-to-end (mock model)', async () => {
  const seen: Array<{ input: unknown; toolUseId: string | undefined }> = [];
  const usage = {
    inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: 5, text: 5, reasoning: undefined },
  };

  const mockModel = new MockLanguageModelV4({
    doGenerate: [
      {
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-mock-1',
            toolName: 'get_weather',
            input: '{"city":"Beijing"}',
          },
        ],
        finishReason: { unified: 'tool-calls', raw: undefined },
        usage,
        warnings: [],
      },
      {
        content: [{ type: 'text', text: 'It is sunny in Beijing.' }],
        finishReason: { unified: 'stop', raw: undefined },
        usage,
        warnings: [],
      },
    ],
  });

  const result = await aiSdkChat({
    provider: 'openai',
    model: 'mock-model',
    apiKey: 'test-key',
    prompt: 'What is the weather in Beijing?',
    system: 'You are terse.',
    languageModel: mockModel as unknown as LanguageModel,
    tools: [
      makeTool({
        executeWithToolUseId: async (input, toolUseId) => {
          seen.push({ input, toolUseId });
          return { weather: 'sunny' };
        },
      }),
    ],
  });

  // Final answer comes from the second model call.
  assert.equal(result.text, 'It is sunny in Beijing.');
  assert.equal(result.finishReason, 'stop');

  // The tool-call from step 1 is reported with its parsed input.
  assert.deepEqual(result.toolCalls, [
    { toolName: 'get_weather', input: { city: 'Beijing' } },
  ]);

  // Our bridge executed the tool with the SDK toolCallId and parsed input.
  assert.equal(seen.length, 1);
  assert.equal(seen[0].toolUseId, 'call-mock-1');
  assert.deepEqual(seen[0].input, { city: 'Beijing' });

  // The loop really took two steps and produced conversation messages.
  assert.equal(mockModel.doGenerateCalls.length, 2);
  assert.ok(result.responseMessages.length >= 2);

  // v7 aggregate semantics: usage is summed across ALL steps
  // (generate-text-result.ts: "the sum of all step usages").
  // Each step reports {total:10} input / {total:5} output.
  assert.equal(result.usage.inputTokens, 20);
  assert.equal(result.usage.outputTokens, 10);
  assert.equal(result.usage.totalTokens, 30);
});

test('aiSdkChat returns final text without tools (mock model)', async () => {
  const mockModel = new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: 'text', text: 'pong' }],
      finishReason: { unified: 'stop', raw: undefined },
      usage: {
        inputTokens: { total: 3, noCache: 3, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 2, text: 2, reasoning: undefined },
      },
      warnings: [],
    }),
  });

  const result = await aiSdkChat({
    provider: 'anthropic',
    model: 'mock-model',
    apiKey: 'test-key',
    prompt: 'ping',
    languageModel: mockModel as unknown as LanguageModel,
  });

  assert.equal(result.text, 'pong');
  assert.equal(result.finishReason, 'stop');
  assert.deepEqual(result.toolCalls, []);
  assert.equal(result.usage.inputTokens, 3);
  assert.equal(result.usage.outputTokens, 2);
});

test('aiSdkChat throws AiSdkChatIncompleteToolLoopError when maxSteps is exhausted without final text', async () => {
  // Both model responses are tool calls; with maxSteps: 2 the loop stops after
  // the second tool round with no final text step (v7: result.text === '').
  const usage = {
    inputTokens: { total: 7, noCache: 7, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: 3, text: 3, reasoning: undefined },
  };
  const toolCall = (id: string, city: string) => ({
    type: 'tool-call' as const,
    toolCallId: id,
    toolName: 'get_weather',
    input: `{"city":"${city}"}`,
  });

  const mockModel = new MockLanguageModelV4({
    doGenerate: [
      {
        content: [toolCall('call-x1', 'Beijing')],
        finishReason: { unified: 'tool-calls', raw: undefined },
        usage,
        warnings: [],
      },
      {
        content: [toolCall('call-x2', 'Oslo')],
        finishReason: { unified: 'tool-calls', raw: undefined },
        usage,
        warnings: [],
      },
    ],
  });

  await assert.rejects(
    aiSdkChat({
      provider: 'openai',
      model: 'mock-model',
      apiKey: 'test-key',
      prompt: 'weather in every city',
      languageModel: mockModel as unknown as LanguageModel,
      tools: [makeTool({ execute: async () => ({ weather: 'sunny' }) })],
      maxSteps: 2,
    }),
    (error: unknown) => {
      assert.ok(
        error instanceof AiSdkChatIncompleteToolLoopError,
        `expected AiSdkChatIncompleteToolLoopError, got ${String(error)}`,
      );
      assert.equal(error.name, 'AiSdkChatIncompleteToolLoopError');
      assert.match(error.message, /tool loop ended without a final text answer/);
      // All steps' tool calls are reported (v7 aggregates across steps).
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
      // Process data stays available: assistant + tool messages accumulated.
      assert.ok(error.responseMessages.length >= 2);
      return true;
    },
  );
  assert.equal(mockModel.doGenerateCalls.length, 2);
});

// Live smoke test — skipped unless all four env vars are provided, e.g.:
//   AI_SDK_CHAT_TEST_PROVIDER=openai \
//   AI_SDK_CHAT_TEST_MODEL=deepseek-chat \
//   AI_SDK_CHAT_TEST_BASE_URL=https://api.deepseek.com/v1 \
//   AI_SDK_CHAT_TEST_API_KEY=sk-... npx tsx src/adapters/ai-sdk-chat.test.ts
const liveProvider = process.env.AI_SDK_CHAT_TEST_PROVIDER;
const liveModel = process.env.AI_SDK_CHAT_TEST_MODEL;
const liveBaseUrl = process.env.AI_SDK_CHAT_TEST_BASE_URL;
const liveApiKey = process.env.AI_SDK_CHAT_TEST_API_KEY;
const liveEnabled = Boolean(liveProvider && liveModel && liveBaseUrl && liveApiKey);

test(
  'aiSdkChat live smoke (env-gated)',
  { skip: liveEnabled ? false : 'set AI_SDK_CHAT_TEST_* env vars to enable' },
  async () => {
    const result = await aiSdkChat({
      provider: liveProvider as 'openai' | 'anthropic',
      model: liveModel!,
      apiKey: liveApiKey,
      baseURL: liveBaseUrl,
      system: 'Reply with exactly the word pong.',
      prompt: 'ping',
      maxOutputTokens: 32,
    });
    assert.equal(typeof result.text, 'string');
    assert.ok(result.text.length > 0);
    assert.equal(typeof result.finishReason, 'string');
    console.log('live smoke result:', JSON.stringify(result, null, 2));
  },
);
