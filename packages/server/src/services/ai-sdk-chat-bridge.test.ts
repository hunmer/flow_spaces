/**
 * Offline unit tests for the AI SDK chat bridge used by the chat entries.
 * Run: npx tsx src/services/ai-sdk-chat-bridge.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import type { LanguageModel } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import type { AiSdkResponseMessage } from '../adapters/ai-sdk-chat.js';
import { aiSdkChat } from '../adapters/ai-sdk-chat.js';

import {
  collectAiSdkChatEvents,
  mapAiSdkChatProvider,
} from './ai-sdk-chat-bridge.js';

test('mapAiSdkChatProvider maps openai-compatible ids to openai', () => {
  assert.equal(mapAiSdkChatProvider('openai-chat-completions'), 'openai');
  assert.equal(mapAiSdkChatProvider('openai-responses'), 'openai');
  assert.equal(mapAiSdkChatProvider('openai-chat-completions-to-anthropic-messages'), 'openai');
  assert.equal(mapAiSdkChatProvider('openai-responses-to-anthropic-messages'), 'openai');
});

test('mapAiSdkChatProvider maps anthropic-messages to anthropic', () => {
  assert.equal(mapAiSdkChatProvider('anthropic-messages'), 'anthropic');
});

test('mapAiSdkChatProvider defaults missing provider to openai', () => {
  assert.equal(mapAiSdkChatProvider(undefined), 'openai');
  assert.equal(mapAiSdkChatProvider(''), 'openai');
  assert.equal(mapAiSdkChatProvider('   '), 'openai');
});

test('mapAiSdkChatProvider rejects unsupported providers', () => {
  assert.equal(mapAiSdkChatProvider('gemini-generate-content'), null);
  assert.equal(mapAiSdkChatProvider('grok'), null);
});

test('collectAiSdkChatEvents rebuilds ordered reasoning/tool events (real v7 output shapes)', () => {
  // v7 ToolResultPart.output is a wrapped ToolResultOutput — here {type:'json'}.
  const responseMessages = [
    {
      role: 'assistant',
      content: [
        { type: 'reasoning', text: 'let me check the weather' },
        { type: 'text', text: 'checking' },
        { type: 'tool-call', toolCallId: 'call_1', toolName: 'get_weather', input: { city: 'Beijing' } },
      ],
    },
    {
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: 'call_1',
          toolName: 'get_weather',
          output: { type: 'json', value: { weather: 'sunny' } },
        },
      ],
    },
  ] as unknown as AiSdkResponseMessage[];

  assert.deepEqual(collectAiSdkChatEvents(responseMessages), [
    { type: 'reasoning', text: 'let me check the weather', status: 'completed' },
    { type: 'tool_use', id: 'call_1', name: 'get_weather', input: { city: 'Beijing' }, line: '' },
    { type: 'tool_result', toolUseId: 'call_1', result: { weather: 'sunny' } },
  ]);
});

test('collectAiSdkChatEvents unwraps every v7 ToolResultOutput shape', () => {
  const responseMessages = [
    {
      role: 'tool',
      content: [
        { type: 'tool-result', toolCallId: 't1', toolName: 'a', output: { type: 'text', value: 'plain text' } },
        { type: 'tool-result', toolCallId: 't2', toolName: 'b', output: { type: 'json', value: { ok: 1 } } },
        { type: 'tool-result', toolCallId: 't3', toolName: 'c', output: { type: 'error-text', value: 'boom' } },
        { type: 'tool-result', toolCallId: 't4', toolName: 'd', output: { type: 'error-json', value: { code: 500 } } },
        { type: 'tool-result', toolCallId: 't5', toolName: 'e', output: { type: 'execution-denied', reason: 'not allowed' } },
        {
          type: 'tool-result',
          toolCallId: 't6',
          toolName: 'f',
          output: {
            type: 'content',
            value: [{ type: 'text', text: 'part a' }, { type: 'custom', providerOptions: {} }],
          },
        },
        { type: 'tool-result', toolCallId: 't7', toolName: 'g', output: { type: 'future-shape', data: 1 } },
      ],
    },
  ] as unknown as AiSdkResponseMessage[];

  const results = collectAiSdkChatEvents(responseMessages)
    .filter((e) => e.type === 'tool_result')
    .map((e) => (e as { result: unknown }).result);

  assert.deepEqual(results, [
    'plain text',
    { ok: 1 },
    'boom',
    { code: 500 },
    { executionDenied: true, reason: 'not allowed' },
    ['part a', { type: 'custom', providerOptions: {} }],
    { type: 'future-shape', data: 1 }, // unknown wrappers pass through untouched
  ]);
});

test('collectAiSdkChatEvents skips plain string content and non-tool parts', () => {
  const responseMessages = [
    { role: 'user', content: 'plain prompt' },
    { role: 'assistant', content: [{ type: 'text', text: 'final answer' }, { type: 'file', data: 'x' }] },
  ] as unknown as AiSdkResponseMessage[];

  assert.deepEqual(collectAiSdkChatEvents(responseMessages), []);
});

test('collectAiSdkChatEvents falls back to args/result aliases', () => {
  const responseMessages = [
    {
      role: 'assistant',
      content: [{ type: 'tool-call', toolCallId: 'c2', toolName: 't', args: { a: 1 } }],
    },
    {
      role: 'tool',
      content: [{ type: 'tool-result', toolCallId: 'c2', toolName: 't', result: 'legacy output' }],
    },
  ] as unknown as AiSdkResponseMessage[];

  assert.deepEqual(collectAiSdkChatEvents(responseMessages), [
    { type: 'tool_use', id: 'c2', name: 't', input: { a: 1 }, line: '' },
    { type: 'tool_result', toolUseId: 'c2', result: 'legacy output' },
  ]);
});

test('collectAiSdkChatEvents ignores empty reasoning text', () => {
  const responseMessages = [
    { role: 'assistant', content: [{ type: 'reasoning', text: '' }] },
  ] as unknown as AiSdkResponseMessage[];

  assert.deepEqual(collectAiSdkChatEvents(responseMessages), []);
});

// --- Integration with real generateText output (mock model, no network) ---
// Verifies the bridge against actual ai@7.0.166 responseMessages, whose
// tool-result outputs are wrapped by createToolModelOutput (to-response-messages.ts).

const MOCK_USAGE = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

function weatherToolModel(toolCallId: string, finalText: string): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: [
      {
        content: [
          {
            type: 'tool-call' as const,
            toolCallId,
            toolName: 'get_weather',
            input: '{"city":"Beijing"}',
          },
        ],
        finishReason: { unified: 'tool-calls' as const, raw: undefined },
        usage: MOCK_USAGE,
        warnings: [],
      },
      {
        content: [{ type: 'text' as const, text: finalText }],
        finishReason: { unified: 'stop' as const, raw: undefined },
        usage: MOCK_USAGE,
        warnings: [],
      },
    ],
  });
}

test('bridge unwraps real generateText tool-result outputs (mock model)', async () => {
  const result = await aiSdkChat({
    provider: 'openai',
    model: 'mock-model',
    apiKey: 'test-key',
    prompt: 'weather in Beijing?',
    languageModel: weatherToolModel('call-real-1', 'It is sunny in Beijing.') as unknown as LanguageModel,
    tools: [
      {
        name: 'get_weather',
        description: 'Get current weather for a city',
        inputSchema: {
          type: 'object',
          properties: { city: { type: 'string' } },
          required: ['city'],
          additionalProperties: false,
        },
        execute: async () => ({ weather: 'sunny' }),
      },
    ],
  });

  const events = collectAiSdkChatEvents(result.responseMessages);
  const toolResult = events.find((e) => e.type === 'tool_result') as
    | { toolUseId?: string; result: unknown }
    | undefined;
  assert.ok(toolResult, 'expected a tool_result event');
  assert.equal(toolResult.toolUseId, 'call-real-1');
  // Real v7 wrapper {type:'json', value:{weather:'sunny'}} is unwrapped.
  assert.deepEqual(toolResult.result, { weather: 'sunny' });
});

test('bridge surfaces real tool-error outputs as error-text values (mock model)', async () => {
  const result = await aiSdkChat({
    provider: 'openai',
    model: 'mock-model',
    apiKey: 'test-key',
    prompt: 'weather in Beijing?',
    languageModel: weatherToolModel('call-real-2', 'The tool failed, sorry.') as unknown as LanguageModel,
    tools: [
      {
        name: 'get_weather',
        description: 'Get current weather for a city',
        inputSchema: {
          type: 'object',
          properties: { city: { type: 'string' } },
          required: ['city'],
          additionalProperties: false,
        },
        execute: async () => {
          throw new Error('weather service unavailable');
        },
      },
    ],
  });

  const events = collectAiSdkChatEvents(result.responseMessages);
  const toolResult = events.find((e) => e.type === 'tool_result') as
    | { toolUseId?: string; result: unknown }
    | undefined;
  assert.ok(toolResult, 'expected a tool_result event');
  assert.equal(toolResult.toolUseId, 'call-real-2');
  // Thrown tool errors are wrapped as {type:'error-text', value:<message>};
  // getErrorMessage serializes an Error instance as "Error: <message>".
  assert.equal(toolResult.result, 'Error: weather service unavailable');
});
