/**
 * Minimal LangChain chat module.
 *
 * Replaces the former Vercel AI SDK module (ai-sdk-chat.ts) so the chat
 * channel and the agent runtime share one model-provider stack
 * (`langchain` + `@langchain/openai` + `@langchain/anthropic`).
 *
 * Same shape as the old module, with one structural change: instead of the
 * SDK's `responseMessages` (replayed into events by a bridge), the result
 * directly carries an ordered `events` timeline (reasoning / tool_use /
 * tool_result) — the chat entries feed it straight into their collectors.
 *
 * Tool loop is a plain invoke/dispatch loop (no createAgent, no MCP, no
 * checkpointer — those belong to the agent runtime in langchain-runtime.ts):
 * bindTools declares the schemas to the model; each AIMessage.tool_calls
 * round is executed here through the original AgentFunctionTool handlers.
 */

import { initChatModel, tool } from 'langchain';
import type { AgentRuntimeConfig, AgentRuntimeEvent } from './agent-runtime-types.js';
import {
  buildModelConfig,
  buildProviderEnv,
  resolveLangChainModelSettings,
  stringifyToolResult,
  withTemporaryEnv,
} from './langchain-runtime.js';

export type LangChainChatProvider = 'openai' | 'anthropic';

/** Chat agent provider ids accepted by mapLangChainChatProvider. */
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
export function mapLangChainChatProvider(provider?: string): LangChainChatProvider | null {
  const normalized = provider?.trim() || 'openai-chat-completions';
  if (normalized === 'anthropic-messages') return 'anthropic';
  if (OPENAI_COMPATIBLE_PROVIDERS.has(normalized)) return 'openai';
  return null;
}

/** Structurally compatible with AgentFunctionTool (extra fields like `annotations` are ignored). */
export interface LangChainChatTool {
  name: string;
  description: string;
  /** Plain JSON Schema object (type: 'object', properties, ...). */
  inputSchema: Record<string, unknown>;
  execute: (input: unknown) => Promise<unknown>;
  /** When present, called instead of `execute` with the model's tool call id. */
  executeWithToolUseId?: (input: unknown, toolUseId: string) => Promise<unknown>;
}

export interface LangChainChatOptions {
  provider: LangChainChatProvider;
  model: string;
  apiKey?: string;
  baseURL?: string;
  /**
   * Pre-built chat model; when provided, provider factory / env injection are
   * skipped (injection point for tests / advanced callers). Needs to expose
   * `invoke(messages, {signal})` and, when tools are bound, `bindTools(tools)`.
   */
  chatModel?: unknown;
  prompt: string;
  /** Prepended as a system message. */
  system?: string;
  tools?: LangChainChatTool[];
  /** Max model steps for the tool loop; defaults to 1 without tools, 8 with tools. */
  maxSteps?: number;
  abortSignal?: AbortSignal;
}

export interface LangChainChatUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

/** Ordered reasoning / tool_use / tool_result timeline (text is delivered separately via `text`). */
export type LangChainChatEvent = AgentRuntimeEvent;

export interface LangChainChatResult {
  text: string;
  finishReason: string;
  usage: LangChainChatUsage;
  toolCalls: Array<{ toolName: string; input: unknown }>;
  events: LangChainChatEvent[];
}

/**
 * Thrown when the tool loop ends without a final text answer — the step
 * budget (`maxSteps`) was exhausted while the model kept calling tools.
 * The accumulated process data is attached so chat entries can still show
 * what happened.
 */
export class LangChainChatIncompleteToolLoopError extends Error {
  readonly toolCalls: LangChainChatResult['toolCalls'];
  readonly events: LangChainChatEvent[];
  readonly usage: LangChainChatUsage;
  readonly finishReason: string;

  constructor(details: {
    toolCalls: LangChainChatResult['toolCalls'];
    events: LangChainChatEvent[];
    usage: LangChainChatUsage;
    finishReason: string;
  }) {
    super(
      `langchainChat: tool loop ended without a final text answer after ${details.toolCalls.length} tool call(s) ` +
        `(finishReason '${details.finishReason}'); the step budget (maxSteps) was likely exhausted — ` +
        `increase maxSteps or inspect error.toolCalls / error.events / error.usage`,
    );
    this.name = 'LangChainChatIncompleteToolLoopError';
    this.toolCalls = details.toolCalls;
    this.events = details.events;
    this.usage = details.usage;
    this.finishReason = details.finishReason;
  }
}

const DEFAULT_TOOL_MAX_STEPS = 8;

interface ChatModelLike {
  invoke(input: unknown, options?: { signal?: AbortSignal }): Promise<unknown>;
  bindTools?(tools: unknown[]): ChatModelLike;
}

interface ExtractedToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

/**
 * Convert built-in tools into langchain `tool()` definitions for bindTools.
 * The actual execution stays in our loop (executeWithToolUseId needs the
 * model's tool call id, which langchain's tool func signature cannot see).
 */
export function toLangChainToolDefinitions(
  tools?: LangChainChatTool[],
): unknown[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((t) =>
    tool(
      // Placeholder: never invoked — the chat loop dispatches handlers itself.
      async () => 'executed by langchainChat',
      {
        name: t.name,
        description: t.description,
        schema: t.inputSchema,
      },
    ),
  );
}

/** Text parts of an AIMessage-like object (string content or content blocks). */
function extractText(message: Record<string, unknown>): string {
  const content = message.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((block) => isRecord(block) && block.type === 'text' && typeof block.text === 'string')
    .map((block) => (block as { text: string }).text)
    .join('');
}

/** Reasoning content: anthropic thinking blocks, reasoning blocks, or deepseek-style reasoning_content. */
function extractReasoning(message: Record<string, unknown>): string {
  const parts: string[] = [];
  const content = message.content;
  if (Array.isArray(content)) {
    for (const block of content) {
      if (!isRecord(block)) continue;
      if (block.type === 'thinking' && typeof block.thinking === 'string') {
        parts.push(block.thinking);
      } else if (
        block.type === 'reasoning' &&
        (typeof block.reasoning === 'string' || typeof block.text === 'string')
      ) {
        parts.push((block.reasoning ?? block.text) as string);
      }
    }
  }
  const additional = isRecord(message.additional_kwargs)
    ? message.additional_kwargs
    : undefined;
  if (additional && typeof additional.reasoning_content === 'string') {
    parts.push(additional.reasoning_content);
  }
  return parts.join('\n');
}

function extractToolCalls(message: Record<string, unknown>): ExtractedToolCall[] {
  const calls = message.tool_calls;
  if (!Array.isArray(calls)) return [];
  return calls
    .filter(isRecord)
    .map((call) => ({
      id: typeof call.id === 'string' ? call.id : '',
      name: typeof call.name === 'string' ? call.name : 'tool',
      args: isRecord(call.args) ? call.args : {},
    }))
    .filter((call) => call.name);
}

/** finish_reason (OpenAI) / stop_reason (Anthropic) from response metadata. */
function extractFinishReason(message: Record<string, unknown>): string | undefined {
  const responseMetadata = isRecord(message.response_metadata) ? message.response_metadata : undefined;
  const kwargs = isRecord(message.kwargs) ? message.kwargs : undefined;
  const kwargsResponseMetadata = isRecord(kwargs?.response_metadata) ? kwargs.response_metadata : undefined;
  const candidates = [
    responseMetadata?.finish_reason,
    responseMetadata?.finishReason,
    responseMetadata?.stop_reason,
    kwargsResponseMetadata?.finish_reason,
    kwargsResponseMetadata?.stop_reason,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate) return candidate;
  }
  return undefined;
}

interface UsageAccumulator {
  inputTokens: number;
  outputTokens: number;
}

/** usage_metadata (langchain standard) or response_metadata.token_usage (anthropic). */
function accumulateUsage(message: Record<string, unknown>, acc: UsageAccumulator): void {
  const metadata = isRecord(message.usage_metadata) ? message.usage_metadata : undefined;
  const responseMetadata = isRecord(message.response_metadata) ? message.response_metadata : undefined;
  const tokenUsage = isRecord(responseMetadata?.token_usage) ? responseMetadata.token_usage : undefined;
  const input = toCount(metadata?.input_tokens, tokenUsage?.input_tokens);
  const output = toCount(metadata?.output_tokens, tokenUsage?.output_tokens);
  if (input !== undefined) acc.inputTokens += input;
  if (output !== undefined) acc.outputTokens += output;
}

function toCount(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === 'number') return value;
  }
  return undefined;
}

function toUsage(acc: UsageAccumulator): LangChainChatUsage {
  return {
    inputTokens: acc.inputTokens || undefined,
    outputTokens: acc.outputTokens || undefined,
    totalTokens: acc.inputTokens + acc.outputTokens || undefined,
  };
}

/** Provider id for the AgentRuntimeConfig plumbing (normalizeLangChainProvider understands these). */
function toRuntimeProviderId(provider: LangChainChatProvider): string {
  return provider === 'anthropic' ? 'anthropic-messages' : 'openai-chat-completions';
}

/**
 * Resolve a chat model via langchain's initChatModel. No network access
 * happens here (the first request fires on invoke).
 */
export async function resolveLangChainChatModel(options: {
  provider: LangChainChatProvider;
  model: string;
  apiKey?: string;
  baseURL?: string;
}): Promise<ChatModelLike> {
  const runtimeConfig: AgentRuntimeConfig = {
    provider: toRuntimeProviderId(options.provider),
    model: options.model,
    apiKey: options.apiKey,
    baseURL: options.baseURL,
    // Chat stays plain: no thinking budget (matches the former ai-sdk module).
    thinkingEnabled: false,
  };
  const modelSettings = resolveLangChainModelSettings(runtimeConfig);
  const chatModel = await withTemporaryEnv(
    buildProviderEnv(runtimeConfig, modelSettings.provider),
    () => initChatModel(modelSettings.modelIdentifier, buildModelConfig(runtimeConfig)),
  );
  return chatModel as ChatModelLike;
}

/**
 * Run a single chat turn: prompt → (optional tool loop) → final text.
 * Provider/API errors are rethrown as-is; aborting the signal rejects with
 * the model client's abort error.
 */
export async function langchainChat(options: LangChainChatOptions): Promise<LangChainChatResult> {
  if (options.provider !== 'openai' && options.provider !== 'anthropic') {
    throw new Error(`langchainChat: unsupported provider '${String(options.provider)}' (openai | anthropic)`);
  }
  if (!options.model) throw new Error('langchainChat: model is required');
  if (typeof options.prompt !== 'string' || options.prompt.length === 0) {
    throw new Error('langchainChat: prompt must be a non-empty string');
  }

  const tools = options.tools && options.tools.length > 0 ? options.tools : undefined;
  const maxSteps = Math.max(1, options.maxSteps ?? (tools ? DEFAULT_TOOL_MAX_STEPS : 1));

  const chatModel = (options.chatModel as ChatModelLike | undefined)
    ?? (await resolveLangChainChatModel(options));

  let boundModel = chatModel;
  if (tools) {
    if (typeof chatModel.bindTools !== 'function') {
      throw new Error('langchainChat: chat model does not support bindTools, but tools were requested');
    }
    boundModel = chatModel.bindTools(toLangChainToolDefinitions(tools) ?? []);
  }

  const messages: unknown[] = [];
  if (options.system) messages.push({ role: 'system', content: options.system });
  messages.push({ role: 'user', content: options.prompt });

  const toolHandlers = new Map<string, LangChainChatTool>();
  if (tools) for (const t of tools) toolHandlers.set(t.name, t);

  const events: LangChainChatEvent[] = [];
  const toolCallRecords: LangChainChatResult['toolCalls'] = [];
  const usageAcc: UsageAccumulator = { inputTokens: 0, outputTokens: 0 };

  for (let step = 1; step <= maxSteps; step += 1) {
    const aiMessage = await boundModel.invoke(messages, { signal: options.abortSignal });
    if (!isRecord(aiMessage)) {
      throw new Error(`langchainChat: model returned a non-object message (${typeof aiMessage})`);
    }
    accumulateUsage(aiMessage, usageAcc);

    const reasoning = extractReasoning(aiMessage);
    if (reasoning) events.push({ type: 'reasoning', text: reasoning, status: 'completed' });

    const toolCalls = extractToolCalls(aiMessage);
    if (toolCalls.length === 0) {
      const text = extractText(aiMessage);
      const finishReason = extractFinishReason(aiMessage) ?? 'stop';
      return {
        text,
        finishReason,
        usage: toUsage(usageAcc),
        toolCalls: toolCallRecords,
        events,
      };
    }

    messages.push(aiMessage);
    for (const call of toolCalls) {
      events.push({
        type: 'tool_use',
        id: call.id,
        name: call.name,
        input: call.args,
        line: '',
      });
      toolCallRecords.push({ toolName: call.name, input: call.args });

      const handler = toolHandlers.get(call.name);
      if (!handler) {
        throw new Error(`langchainChat: model called unknown tool '${call.name}'`);
      }
      const result = handler.executeWithToolUseId
        ? await handler.executeWithToolUseId(call.args, call.id)
        : await handler.execute(call.args);

      events.push({ type: 'tool_result', toolUseId: call.id, result });
      messages.push({
        role: 'tool',
        content: stringifyToolResult(result),
        tool_call_id: call.id,
      });
    }
  }

  throw new LangChainChatIncompleteToolLoopError({
    toolCalls: toolCallRecords,
    events,
    usage: toUsage(usageAcc),
    finishReason: 'tool-calls',
  });
}
