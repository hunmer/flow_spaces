/**
 * HTTP-level integration tests for the minimal AI SDK chat module.
 *
 * Spins up a local node:http stub server on a random 127.0.0.1 port and lets
 * the REAL @ai-sdk/openai (`.chat()` Chat Completions) and @ai-sdk/anthropic
 * providers serialize requests / parse responses over the wire — no
 * languageModel mocks, no real keys, no external network. The server is
 * closed in a finally block in every test.
 *
 * Run: cd packages/server && pnpm exec tsx --test src/adapters/ai-sdk-chat-http.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { aiSdkChat, type AiSdkChatTool } from './ai-sdk-chat.js';

interface RecordedRequest {
  method: string | undefined;
  url: string | undefined;
  headers: http.IncomingHttpHeaders;
  body: Record<string, unknown>;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function startStubServer(
  onRequest: (recorded: RecordedRequest, res: ServerResponse) => void,
): Promise<{ server: http.Server; baseURL: string }> {
  const server = http.createServer((req, res) => {
    void (async () => {
      let recorded: RecordedRequest;
      try {
        const raw = await readBody(req);
        recorded = {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: raw ? (JSON.parse(raw) as Record<string, unknown>) : {},
        };
      } catch (err) {
        res.statusCode = 400;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ error: { message: `bad request body: ${String(err)}` } }));
        return;
      }
      onRequest(recorded, res);
    })();
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  return { server, baseURL: `http://127.0.0.1:${port}` };
}

async function closeStubServer(server: http.Server): Promise<void> {
  server.closeAllConnections?.();
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
}

function notFound(res: ServerResponse, url: string | undefined): void {
  res.statusCode = 404;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ error: { message: `unexpected path: ${url ?? '(none)'}` } }));
}

function sendJson(res: ServerResponse, payload: unknown): void {
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

// --- OpenAI Chat Completions wire shapes ---

function openAiTextResponse(text: string, model: string, usage = { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 }) {
  return {
    id: 'chatcmpl-stub',
    object: 'chat.completion',
    created: 1730000000,
    model,
    choices: [
      { index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' },
    ],
    usage,
  };
}

function openAiToolCallResponse(model: string) {
  return {
    id: 'chatcmpl-stub-tool',
    object: 'chat.completion',
    created: 1730000001,
    model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: { name: 'get_weather', arguments: '{"city":"Paris"}' },
            },
          ],
        },
        finish_reason: 'tool_calls',
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  };
}

// --- Anthropic Messages API wire shapes ---

function anthropicTextResponse(text: string, model: string) {
  return {
    id: 'msg_stub',
    type: 'message',
    role: 'assistant',
    model,
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 9, output_tokens: 5 },
  };
}

function makeWeatherTool(executed: Array<{ input: unknown; toolUseId: string }>): AiSdkChatTool {
  return {
    name: 'get_weather',
    description: 'Get current weather for a city',
    inputSchema: {
      type: 'object',
      properties: { city: { type: 'string' } },
      required: ['city'],
      additionalProperties: false,
    },
    execute: async () => ({ weather: 'sunny' }),
    executeWithToolUseId: async (input, toolUseId) => {
      executed.push({ input, toolUseId });
      return { weather: 'sunny' };
    },
  };
}

test('openai provider issues a real Chat Completions request and maps the answer', async () => {
  const requests: RecordedRequest[] = [];
  const { server, baseURL } = await startStubServer((req, res) => {
    requests.push(req);
    if (req.url?.includes('chat/completions')) {
      sendJson(res, openAiTextResponse('Hello from OpenAI stub', 'gpt-test-1'));
    } else {
      notFound(res, req.url);
    }
  });

  try {
    const result = await aiSdkChat({
      provider: 'openai',
      model: 'gpt-test-1',
      apiKey: 'sk-test-openai',
      baseURL,
      prompt: 'Say hi',
      system: 'Be terse.',
    });

    // Exactly one wire request to the Chat Completions endpoint.
    assert.equal(requests.length, 1);
    assert.equal(requests[0].method, 'POST');
    assert.ok(requests[0].url?.includes('chat/completions'), `url was ${requests[0].url}`);

    // apiKey and model are correctly forwarded through the real provider.
    assert.equal(requests[0].headers.authorization, 'Bearer sk-test-openai');
    assert.equal(requests[0].body.model, 'gpt-test-1');

    // prompt + system (instructions) become the message list.
    const messages = requests[0].body.messages as Array<{ role: string; content: unknown }>;
    assert.equal(messages[0].role, 'system');
    assert.ok(String(messages[0].content).includes('Be terse.'));
    const last = messages[messages.length - 1];
    assert.equal(last.role, 'user');
    assert.equal(last.content, 'Say hi');

    // Result mapping: text / finishReason / usage, no tool calls.
    assert.equal(result.text, 'Hello from OpenAI stub');
    assert.equal(result.finishReason, 'stop');
    assert.deepEqual(result.toolCalls, []);
    assert.deepEqual(result.usage, { inputTokens: 12, outputTokens: 7, totalTokens: 19 });
  } finally {
    await closeStubServer(server);
  }
});

test('anthropic provider issues a real Messages API request and maps the answer', async () => {
  const requests: RecordedRequest[] = [];
  const { server, baseURL } = await startStubServer((req, res) => {
    requests.push(req);
    if (/\/(v1\/)?messages\/?$/.test(req.url ?? '')) {
      sendJson(res, anthropicTextResponse('Bonjour from Anthropic stub', 'claude-test-1'));
    } else {
      notFound(res, req.url);
    }
  });

  try {
    const result = await aiSdkChat({
      provider: 'anthropic',
      model: 'claude-test-1',
      apiKey: 'sk-test-anthropic',
      baseURL,
      prompt: 'Dis bonjour',
      system: 'You are French.',
      maxOutputTokens: 32,
    });

    assert.equal(requests.length, 1);
    assert.equal(requests[0].method, 'POST');
    assert.ok(/\/(v1\/)?messages\/?$/.test(requests[0].url ?? ''), `url was ${requests[0].url}`);

    // Anthropic auth style: x-api-key + anthropic-version headers.
    assert.equal(requests[0].headers['x-api-key'], 'sk-test-anthropic');
    assert.ok(typeof requests[0].headers['anthropic-version'] === 'string');

    // model and prompt/system placement.
    assert.equal(requests[0].body.model, 'claude-test-1');
    // @ai-sdk/anthropic sends the system prompt as an array of content blocks.
    assert.deepEqual(requests[0].body.system, [{ type: 'text', text: 'You are French.' }]);
    const messages = requests[0].body.messages as Array<{ role: string; content: unknown }>;
    const last = messages[messages.length - 1];
    assert.equal(last.role, 'user');
    assert.ok(JSON.stringify(last.content).includes('Dis bonjour'));

    // end_turn maps to unified 'stop'; usage mapped from input/output tokens.
    assert.equal(result.text, 'Bonjour from Anthropic stub');
    assert.equal(result.finishReason, 'stop');
    assert.deepEqual(result.usage, { inputTokens: 9, outputTokens: 5, totalTokens: 14 });
  } finally {
    await closeStubServer(server);
  }
});

test('openai two-step tool call round-trips over real HTTP', async () => {
  const requests: RecordedRequest[] = [];
  const executed: Array<{ input: unknown; toolUseId: string }> = [];
  const { server, baseURL } = await startStubServer((req, res) => {
    requests.push(req);
    if (!req.url?.includes('chat/completions')) {
      notFound(res, req.url);
      return;
    }
    // Step 1: model asks for the tool; step 2: model produces the final text.
    if (requests.length === 1) sendJson(res, openAiToolCallResponse('gpt-test-1'));
    else sendJson(res, openAiTextResponse('It is sunny in Paris.', 'gpt-test-1', { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28 }));
  });

  try {
    const result = await aiSdkChat({
      provider: 'openai',
      model: 'gpt-test-1',
      apiKey: 'sk-test-openai',
      baseURL,
      prompt: 'What is the weather in Paris?',
      tools: [makeWeatherTool(executed)],
    });

    // The loop really made two HTTP calls.
    assert.equal(requests.length, 2);

    // Step 1 carried the tool definition in OpenAI function format.
    const step1Tools = requests[0].body.tools as Array<{ type: string; function: { name: string; parameters: { properties: Record<string, unknown> } } }>;
    assert.equal(step1Tools[0].type, 'function');
    assert.equal(step1Tools[0].function.name, 'get_weather');
    assert.ok(step1Tools[0].function.parameters.properties.city);

    // Step 2 carried the assistant tool_calls plus the tool result message.
    const step2Messages = requests[1].body.messages as Array<{ role: string; tool_call_id?: string; content: unknown; tool_calls?: unknown[] }>;
    const assistantWithTools = step2Messages.find((m) => m.role === 'assistant' && m.tool_calls?.length);
    assert.ok(assistantWithTools, 'assistant message with tool_calls not sent back');
    const toolMessage = step2Messages.find((m) => m.role === 'tool');
    assert.ok(toolMessage, 'tool result message not sent back');
    assert.equal(toolMessage.tool_call_id, 'call_1');
    assert.ok(JSON.stringify(toolMessage.content).includes('sunny'));

    // Our bridge executed the tool once, with parsed input and the wire toolCallId.
    assert.deepEqual(executed, [{ input: { city: 'Paris' }, toolUseId: 'call_1' }]);

    // Aggregated result: final text, reported tool call, summed usage.
    assert.equal(result.text, 'It is sunny in Paris.');
    assert.equal(result.finishReason, 'stop');
    assert.deepEqual(result.toolCalls, [{ toolName: 'get_weather', input: { city: 'Paris' } }]);
    assert.deepEqual(result.usage, { inputTokens: 30, outputTokens: 13, totalTokens: 43 });
  } finally {
    await closeStubServer(server);
  }
});
