/**
 * Minimal AI SDK chat module.
 *
 * Built on the Vercel AI SDK v7 (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`)
 * with only what the built-in agent chat needs:
 * - plain-text prompt (+ optional system instructions)
 * - optional built-in function tools (JSON Schema based, AgentFunctionTool-shaped)
 * - basic provider config: provider id, model, apiKey, baseURL (direct connection)
 *
 * Notes (verified against installed ai@7.0.166 types):
 * - the SDK exports `stepCountIs` (not `isStepCount`) and does NOT export
 *   `ResponseMessage`; the message type is derived from generateText's result.
 * - provider-level finishReason/usage shapes changed in v7 (object-shaped);
 *   we normalize both shapes defensively.
 * - `openai` provider uses `openai.chat(modelId)` (Chat Completions) instead of
 *   the default Responses API so that third-party OpenAI-compatible baseURLs work.
 * - v7 aggregate semantics (generate-text-result.ts): toolCalls / toolResults /
 *   usage / responseMessages already cover ALL steps (usage is summed); only
 *   `text` concatenates the FINAL step's text parts, so a tool loop exhausted
 *   at maxSteps returns text === ''. We surface that as an explicit error.
 */

import { generateText, jsonSchema, stepCountIs, tool } from 'ai';
import type { LanguageModel, ToolSet } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';

export type AiSdkChatProvider = 'openai' | 'anthropic';

/** Message type produced by generateText's `responseMessages` (derived; the SDK does not export `ResponseMessage`). */
export type AiSdkResponseMessage = Awaited<ReturnType<typeof generateText>>['responseMessages'][number];

/** Structurally compatible with AgentFunctionTool (extra fields like `annotations` are ignored). */
export interface AiSdkChatTool {
  name: string;
  description: string;
  /** Plain JSON Schema object (type: 'object', properties, ...). */
  inputSchema: Record<string, unknown>;
  execute: (input: unknown) => Promise<unknown>;
  /** When present, called instead of `execute` with the SDK's toolCallId. */
  executeWithToolUseId?: (input: unknown, toolUseId: string) => Promise<unknown>;
}

export interface AiSdkChatOptions {
  provider: AiSdkChatProvider;
  model: string;
  apiKey?: string;
  baseURL?: string;
  /**
   * Pre-built LanguageModel; when provided, the provider factory is skipped
   * (injection point for tests / advanced callers).
   */
  languageModel?: LanguageModel;
  prompt: string;
  /** Mapped to `instructions` (system prompt). */
  system?: string;
  tools?: AiSdkChatTool[];
  /** Max steps for the tool loop; defaults to 1 without tools, 8 with tools. */
  maxSteps?: number;
  temperature?: number;
  maxOutputTokens?: number;
  abortSignal?: AbortSignal;
}

export interface AiSdkChatUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface AiSdkChatResult {
  text: string;
  finishReason: string;
  usage: AiSdkChatUsage;
  toolCalls: Array<{ toolName: string; input: unknown }>;
  /** SDK response messages; useful to continue a multi-turn conversation. */
  responseMessages: AiSdkResponseMessage[];
}

/**
 * Thrown when the tool loop ends without a final text answer — typically the
 * step budget (`maxSteps`) was exhausted while the model kept calling tools.
 * In v7, `result.text` only concatenates the FINAL step's text parts, so this
 * state otherwise "succeeds" with an empty string. The accumulated process
 * data is attached so chat entries can still show what happened.
 */
export class AiSdkChatIncompleteToolLoopError extends Error {
  readonly toolCalls: AiSdkChatResult['toolCalls'];
  readonly responseMessages: AiSdkResponseMessage[];
  readonly usage: AiSdkChatUsage;
  readonly finishReason: string;

  constructor(details: {
    toolCalls: AiSdkChatResult['toolCalls'];
    responseMessages: AiSdkResponseMessage[];
    usage: AiSdkChatUsage;
    finishReason: string;
  }) {
    super(
      `aiSdkChat: tool loop ended without a final text answer after ${details.toolCalls.length} tool call(s) ` +
        `(finishReason '${details.finishReason}'); the step budget (maxSteps) was likely exhausted — ` +
        `increase maxSteps or inspect error.toolCalls / error.responseMessages / error.usage`,
    );
    this.name = 'AiSdkChatIncompleteToolLoopError';
    this.toolCalls = details.toolCalls;
    this.responseMessages = details.responseMessages;
    this.usage = details.usage;
    this.finishReason = details.finishReason;
  }
}

const DEFAULT_TOOL_MAX_STEPS = 8;

/**
 * Resolve a LanguageModel for direct connection. No network access happens here.
 * - openai: `.chat()` (Chat Completions) — third-party OpenAI-compatible baseURLs
 *   usually do not implement the Responses API.
 * - anthropic: Messages API.
 */
export function resolveAiSdkModel(options: {
  provider: AiSdkChatProvider;
  model: string;
  apiKey?: string;
  baseURL?: string;
}): LanguageModel {
  switch (options.provider) {
    case 'openai': {
      const openai = createOpenAI({
        ...(options.apiKey !== undefined ? { apiKey: options.apiKey } : {}),
        ...(options.baseURL !== undefined ? { baseURL: options.baseURL } : {}),
      });
      return openai.chat(options.model);
    }
    case 'anthropic': {
      const anthropic = createAnthropic({
        ...(options.apiKey !== undefined ? { apiKey: options.apiKey } : {}),
        ...(options.baseURL !== undefined ? { baseURL: options.baseURL } : {}),
      });
      return anthropic(options.model);
    }
  }
}

/**
 * Convert built-in tools (JSON Schema + execute) into an AI SDK ToolSet.
 * Returns undefined when there are no tools so the call stays a plain completion.
 */
export function toAiSdkToolSet(tools?: AiSdkChatTool[]): ToolSet | undefined {
  if (!tools || tools.length === 0) return undefined;
  const set: ToolSet = {};
  for (const t of tools) {
    set[t.name] = tool({
      description: t.description,
      inputSchema: jsonSchema(t.inputSchema as Parameters<typeof jsonSchema>[0]),
      execute: (input, options) =>
        t.executeWithToolUseId
          ? Promise.resolve(t.executeWithToolUseId(input, options.toolCallId))
          : Promise.resolve(t.execute(input)),
    });
  }
  return set;
}

/** Normalize v7 object-shaped finishReason ({unified, raw}) as well as plain strings. */
function toFinishReasonString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const unified = (value as { unified?: unknown }).unified;
    if (typeof unified === 'string') return unified;
  }
  return String(value);
}

/** Accept both flat numbers (inputTokens: 10) and nested totals (inputTokens: {total: 10}). */
function toTokenCount(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const total = (value as { total?: unknown }).total;
    if (typeof total === 'number') return total;
  }
  return undefined;
}

function toUsage(usage: unknown): AiSdkChatUsage {
  const raw = (usage ?? {}) as Record<string, unknown>;
  const inputTokens = toTokenCount(raw.inputTokens);
  const outputTokens = toTokenCount(raw.outputTokens);
  const totalTokens =
    toTokenCount(raw.totalTokens) ??
    (inputTokens !== undefined || outputTokens !== undefined
      ? (inputTokens ?? 0) + (outputTokens ?? 0)
      : undefined);
  return { inputTokens, outputTokens, totalTokens };
}

/**
 * Run a single chat turn: prompt → (optional tool loop) → final text.
 * SDK/API errors are rethrown as-is (APICallError etc.) — callers decide handling.
 */
export async function aiSdkChat(options: AiSdkChatOptions): Promise<AiSdkChatResult> {
  if (options.provider !== 'openai' && options.provider !== 'anthropic') {
    throw new Error(`aiSdkChat: unsupported provider '${String(options.provider)}' (openai | anthropic)`);
  }
  if (!options.model) throw new Error('aiSdkChat: model is required');
  if (typeof options.prompt !== 'string' || options.prompt.length === 0) {
    throw new Error('aiSdkChat: prompt must be a non-empty string');
  }

  const model = options.languageModel ?? resolveAiSdkModel(options);
  const toolSet = toAiSdkToolSet(options.tools);
  const maxSteps = Math.max(
    1,
    options.maxSteps ?? (toolSet ? DEFAULT_TOOL_MAX_STEPS : 1),
  );

  const result = await generateText({
    model,
    prompt: options.prompt,
    instructions: options.system,
    tools: toolSet,
    stopWhen: toolSet ? stepCountIs(maxSteps) : undefined,
    temperature: options.temperature,
    maxOutputTokens: options.maxOutputTokens,
    abortSignal: options.abortSignal,
  });

  const toolCalls = result.toolCalls.map((call) => ({
    toolName: call.toolName,
    input: call.input,
  }));
  const finishReason = toFinishReasonString(result.finishReason);
  const usage = toUsage(result.usage);

  // v7: `text` only concatenates the final step's text parts — an exhausted
  // tool loop would otherwise "succeed" with an empty answer (see class docs).
  if (result.text.length === 0 && toolCalls.length > 0) {
    throw new AiSdkChatIncompleteToolLoopError({
      toolCalls,
      responseMessages: result.responseMessages,
      usage,
      finishReason,
    });
  }

  return {
    text: result.text,
    finishReason,
    usage,
    toolCalls,
    responseMessages: result.responseMessages,
  };
}
