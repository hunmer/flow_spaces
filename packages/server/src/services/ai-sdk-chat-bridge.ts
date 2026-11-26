/**
 * Bridge helpers for calling the minimal AI SDK chat module (adapters/ai-sdk-chat.ts)
 * from the chat entries (routes/chat-run.ts, ws/chat-handler.ts).
 *
 * - maps chat agent provider ids onto the two providers the module supports
 * - rebuilds ordered reasoning/tool timeline events from the module's response
 *   messages so SSE/WS payloads keep their existing shape (non-streaming replay)
 */

import type { AgentRuntimeEvent } from '../adapters/agent-runtime-types.js';
import type { AiSdkChatProvider, AiSdkResponseMessage } from '../adapters/ai-sdk-chat.js';

const OPENAI_COMPATIBLE_PROVIDERS = new Set<string>([
  'openai-chat-completions',
  'openai-responses',
  'openai-chat-completions-to-anthropic-messages',
  'openai-responses-to-anthropic-messages',
]);

/**
 * Map a chat agent provider id onto the module provider ('openai' | 'anthropic').
 * Missing/empty falls back to the chat service default 'openai-chat-completions'.
 * Returns null for unsupported providers (gemini-generate-content, unknown ids).
 */
export function mapAiSdkChatProvider(provider?: string): AiSdkChatProvider | null {
  const normalized = provider?.trim() || 'openai-chat-completions';
  if (normalized === 'anthropic-messages') return 'anthropic';
  if (OPENAI_COMPATIBLE_PROVIDERS.has(normalized)) return 'openai';
  return null;
}

/**
 * v7 `responseMessages` wrap tool results as `ToolResultOutput`
 * ({type:'text'|'json'|'error-text'|'error-json',value} | {type:'execution-denied',reason?}
 * | {type:'content',value:parts[]} — see create-tool-model-output.ts /
 * to-response-messages.ts). Unwrap so timeline events carry the raw value;
 * non-wrapped (legacy/bare) outputs pass through unchanged.
 */
function unwrapToolResultOutput(output: unknown): unknown {
  if (
    output === null ||
    typeof output !== 'object' ||
    typeof (output as { type?: unknown }).type !== 'string'
  ) {
    return output;
  }
  const wrapped = output as { type: string; value?: unknown; reason?: unknown };
  switch (wrapped.type) {
    case 'text':
    case 'json':
    case 'error-text':
    case 'error-json':
      return wrapped.value;
    case 'execution-denied':
      return {
        executionDenied: true,
        ...(typeof wrapped.reason === 'string' ? { reason: wrapped.reason } : {}),
      };
    case 'content':
      // Keep text parts as plain strings; pass other parts (file, custom…) through.
      return Array.isArray(wrapped.value)
        ? wrapped.value.map((part) =>
            part !== null &&
            typeof part === 'object' &&
            (part as { type?: unknown }).type === 'text'
              ? (part as { text?: unknown }).text
              : part,
          )
        : wrapped.value;
    default:
      return output;
  }
}

/**
 * Rebuild ordered reasoning/tool events from AI SDK response messages so the
 * chat entries can feed their existing timeline collectors and SSE/WS emitters.
 * Text parts are skipped: the final text is delivered separately via result.text.
 */
export function collectAiSdkChatEvents(responseMessages: AiSdkResponseMessage[]): AgentRuntimeEvent[] {
  const events: AgentRuntimeEvent[] = [];
  for (const message of responseMessages) {
    const content = (message as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== 'object') continue;
      const record = part as Record<string, unknown>;
      if (record.type === 'reasoning') {
        const text = typeof record.text === 'string' ? record.text : '';
        if (text) events.push({ type: 'reasoning', text, status: 'completed' });
      } else if (record.type === 'tool-call') {
        events.push({
          type: 'tool_use',
          id: typeof record.toolCallId === 'string' ? record.toolCallId : '',
          name: typeof record.toolName === 'string' ? record.toolName : 'tool',
          input: 'input' in record ? record.input : record.args,
          line: '',
        });
      } else if (record.type === 'tool-result') {
        events.push({
          type: 'tool_result',
          toolUseId: typeof record.toolCallId === 'string' ? record.toolCallId : undefined,
          result: unwrapToolResultOutput('output' in record ? record.output : record.result),
        });
      }
    }
  }
  return events;
}
