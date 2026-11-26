/**
 * Agent runtime adapter interface and factory.
 */

import type { AgentRuntime, AgentRuntimeConfig } from './agent-runtime-types.js';
import { LangChainRuntime } from './langchain-runtime.js';

export type {
  AgentRunOptions,
  AgentRunResult,
  AgentRuntime,
  AgentRuntimeConfig,
  AgentRuntimeKind,
} from './agent-runtime-types.js';
export { LangChainRuntime } from './langchain-runtime.js';

export function createAgentRuntime(config?: AgentRuntimeConfig): AgentRuntime;
export function createAgentRuntime(provider?: string, model?: string): AgentRuntime;
export function createAgentRuntime(
  configOrProvider: AgentRuntimeConfig | string = {},
  model?: string,
): AgentRuntime {
  const config =
    typeof configOrProvider === 'string'
      ? { provider: configOrProvider, model }
      : configOrProvider;

  return new LangChainRuntime(config);
}
