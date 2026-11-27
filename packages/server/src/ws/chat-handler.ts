import type { WebSocket } from 'ws';
import { broadcastToWorkspace } from './connection-manager.js';
import { registerHandler } from './handler.js';
import * as chatService from '../services/chat.js';
import { langchainChat, mapLangChainChatProvider } from '../adapters/langchain-chat.js';

export interface ChatRunHandle {
  controller: AbortController;
  /** True while this controller is still the registered run for its agent. */
  isCurrent: () => boolean;
}

/**
 * Per-agent run registry enforcing single-active-run semantics:
 * - starting a new run aborts the previous run of the same agent;
 * - stop() aborts and unregisters, so a late-resolving run is no longer current
 *   (the handler then-guard drops it: no completion/error broadcast, no message save);
 * - release() ignores superseded controllers, so an old run's finally can never
 *   unregister a newer run's controller.
 */
export function createChatRunRegistry() {
  const runs = new Map<string, AbortController>();
  return {
    start(agentId: string): ChatRunHandle {
      runs.get(agentId)?.abort();
      const controller = new AbortController();
      runs.set(agentId, controller);
      return { controller, isCurrent: () => runs.get(agentId) === controller };
    },
    stop(agentId: string): boolean {
      const controller = runs.get(agentId);
      if (!controller) return false;
      controller.abort();
      runs.delete(agentId);
      return true;
    },
    release(agentId: string, controller: AbortController): void {
      if (runs.get(agentId) === controller) runs.delete(agentId);
    },
    isActive(agentId: string): boolean {
      return runs.has(agentId);
    },
  };
}

const chatRuns = createChatRunRegistry();

export function registerChatHandlers(): void {
  // chat.message: { agentId, content }
  registerHandler('chat.message', (_ws: WebSocket, workspaceId: string, data: unknown) => {
    const { agentId, content } = data as { agentId: string; content: string };
    if (!agentId || !content) return;

    const agent = chatService.findAgent(agentId);
    if (!agent) {
      broadcastToWorkspace(workspaceId, 'chat.agent.error', { agentId, error: 'Agent not found' });
      return;
    }

    const provider = mapLangChainChatProvider(agent.provider);
    if (!provider) {
      broadcastToWorkspace(workspaceId, 'chat.agent.error', {
        agentId,
        error: `Unsupported chat provider '${agent.provider ?? ''}' for agent chat (supported: openai-chat-completions, openai-responses, anthropic-messages).`,
      });
      return;
    }

    // Save user message
    const userMsg = chatService.saveMessage({ agentId, role: 'user', content });
    broadcastToWorkspace(workspaceId, 'chat.message.saved', userMsg);

    // Registers this run and aborts any previous run of the same agent.
    const { controller, isCurrent } = chatRuns.start(agentId);

    // Build conversation history from recent messages
    const recent = chatService.getRecentMessages(agentId, 20);
    const historyPrompt = recent
      .slice(0, -1) // exclude the just-saved user message (already in recent)
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');
    let prompt = historyPrompt ? `${historyPrompt}\n\nUser: ${content}\nAssistant:` : content;
    // Merge the agent system prompt into the prompt string (entry contract: no separate system param)
    const systemPrompt = agent.systemPrompt?.trim();
    if (systemPrompt) prompt = `${systemPrompt}\n\n${prompt}`;

    // Single non-streaming call; reasoning/tool events come back on result.events
    langchainChat({
      provider,
      model: agent.model,
      apiKey: agent.apiKey,
      baseURL: agent.baseURL,
      prompt,
      abortSignal: controller.signal,
    })
      .then((result) => {
        // Superseded by a newer run, or aborted via chat.stop after resolution:
        // drop silently — never broadcast completion nor save a success message.
        if (!isCurrent() || controller.signal.aborted) return;
        for (const event of result.events) {
          switch (event.type) {
            case 'reasoning':
              broadcastToWorkspace(workspaceId, 'chat.agent.thinking', { agentId, chunk: event.text });
              break;
            case 'tool_use':
              broadcastToWorkspace(workspaceId, 'chat.agent.tool_use', { agentId, id: event.id, name: event.name, input: event.input });
              break;
            case 'tool_result':
              broadcastToWorkspace(workspaceId, 'chat.agent.tool_result', { agentId, toolUseId: event.toolUseId, result: event.result });
              break;
            default:
              break;
          }
        }
        if (result.text) {
          broadcastToWorkspace(workspaceId, 'chat.agent.output', { agentId, chunk: result.text });
        }
        const agentMsg = chatService.saveMessage({
          agentId,
          role: 'agent',
          content: result.text,
          usage: result.usage,
        });
        broadcastToWorkspace(workspaceId, 'chat.agent.completed', { agentId, message: agentMsg });
      })
      .catch((err: unknown) => {
        // Superseded by a newer run or stopped by the user: no error broadcast.
        if (!isCurrent()) return;
        broadcastToWorkspace(workspaceId, 'chat.agent.error', {
          agentId,
          error: err instanceof Error ? err.message : String(err),
        });
      })
      .finally(() => {
        // Only the current run may unregister its own controller.
        chatRuns.release(agentId, controller);
      });
  });

  // chat.stop: { agentId } — aborts and unregisters the current run (no-op otherwise).
  registerHandler('chat.stop', (_ws: WebSocket, _workspaceId: string, data: unknown) => {
    const { agentId } = data as { agentId: string };
    if (!agentId) return;
    chatRuns.stop(agentId);
  });
}
