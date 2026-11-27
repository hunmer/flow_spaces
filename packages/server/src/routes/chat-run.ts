import { Router, type Response } from 'express';
import type { BuiltInAgentToolName, Message, WorkflowAgentTimelineItem, WorkflowAgentToolCall, Workspace } from '@flow-spaces/shared';
import * as chatService from '../services/chat.js';
import { generateChatSessionTitle } from '../services/generated-title.js';
import { langchainChat, mapLangChainChatProvider } from '../adapters/langchain-chat.js';
import type { AgentRuntimeEvent } from '../adapters/agent-runtime-types.js';
import { buildAgentPrompt } from '../ws/agent-prompt.js';
import { createThinkTagSplitter } from '../services/think-tags.js';
import {
  createAgentFunctionTools,
  createWorkspaceFileFunctionTools,
  createWorkflowExecutionFunctionTools,
} from '../services/builtin-tools/index.js';

const router = Router();

// --- Session-based run ---
router.post('/sessions/:sessionId/run', async (req, res) => {
  const { sessionId } = req.params;
  const { content, regenerateFromMessageId, workspaceId } = req.body as {
    content?: string;
    regenerateFromMessageId?: string;
    workspaceId?: string;
  };

  if (!workspaceId) {
    res.status(400).json({ error: 'workspaceId is required' });
    return;
  }

  const session = chatService.findSession(workspaceId, sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const agentId = session.agentId;
  const regenerateContext = regenerateFromMessageId
    ? resolveSessionRegenerateContext(workspaceId, sessionId, regenerateFromMessageId)
    : null;
  const trimmedContent = (regenerateContext?.content ?? content)?.trim();

  if (!trimmedContent) {
    res.status(400).json({ error: 'content is required' });
    return;
  }

  const agent = chatService.findAgent(agentId);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  const baseURL = resolveChatAgentBaseURL(agent);
  const shouldGenerateTitle = !regenerateContext
    && !session.title?.trim()
    && chatService.listSessionMessages(workspaceId, sessionId).length === 0;
  let titleTask: Promise<void> | null = null;

  prepareSse(res);

  if (!baseURL && requiresBaseURL(agent.provider)) {
    writeSse(res, 'error', {
      error: `${agent.provider} requires an API Base URL. Edit this chat agent and save the provider API address again.`,
    });
    res.end();
    return;
  }

  const chatProvider = mapLangChainChatProvider(agent.provider);
  if (!chatProvider) {
    writeSse(res, 'error', {
      error: `Unsupported chat provider '${agent.provider ?? ''}' for agent chat (supported: openai-chat-completions, openai-responses, anthropic-messages).`,
    });
    res.end();
    return;
  }

  if (!regenerateContext) {
    const userMsg = chatService.saveSessionMessage(workspaceId, sessionId, {
      agentId,
      role: 'user',
      content: trimmedContent,
    });
    writeSse(res, 'message_saved', userMsg);
    if (shouldGenerateTitle) {
      titleTask = generateChatSessionTitle({
        workspaceId,
        sessionId,
        requirement: trimmedContent,
        onUpdated: (updated) => {
          if (!res.writableEnded) writeSse(res, 'session_updated', updated);
        },
      }).catch((err) => {
        console.error('[title-generator] chat session title generation failed', {
          workspaceId,
          sessionId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }
  }

  const abortController = new AbortController();
  let completed = false;
  const timeline: WorkflowAgentTimelineItem[] = [];
  const output: string[] = [];
  const splitter = createRuntimeOutputSplitter(res, timeline, output);

  res.on('close', () => {
    if (!completed && !res.writableEnded) abortController.abort();
  });

  try {
    const historyMessages = regenerateContext?.historyMessages
      ?? chatService.getRecentSessionMessages(workspaceId, sessionId, 20).slice(0, -1);
    const workingDir = chatService.getAgentWorkingDir(agentId) || process.cwd();
    const tools = normalizeToolNames(agent.tools);
    const agentWorkspace = chatService.getAgentWorkspace(agentId);
    const fileWorkspace = resolveSessionFileWorkspace(agentWorkspace, session);
    const functionTools = [
      ...createAgentFunctionTools(workspaceId, tools),
      ...createWorkspaceFileFunctionTools(workspaceId, tools, () => fileWorkspace),
      ...createWorkflowExecutionFunctionTools(workspaceId, tools, {
        boundWorkflowPluginTools: agent.boundWorkflowPluginTools,
      }),
    ];
    const runtimePrompt = buildChatRuntimePrompt({
      workspaceId,
      systemPrompt: agent.systemPrompt,
      userPrompt: trimmedContent,
      historyMessages,
      boundDirs: fileWorkspace?.boundDirs,
      workingDir,
      builtInTools: functionTools.map((tool) => ({ name: tool.name, description: tool.description })),
      boundWorkflowIds: agent.boundWorkflowIds,
      boundWorkflowPluginTools: agent.boundWorkflowPluginTools,
    });
    const result = await langchainChat({
      provider: chatProvider,
      model: agent.model,
      apiKey: agent.apiKey,
      baseURL,
      prompt: runtimePrompt,
      tools: functionTools,
      maxSteps: 100,
      abortSignal: abortController.signal,
    });
    if (abortController.signal.aborted) return;
    for (const event of result.events) {
      collectRuntimeTimeline(timeline, event);
      writeRuntimeEvent(res, event);
    }
    splitter.push(result.text);
    splitter.flush();

    const agentContent = output.join('').trim() || result.text.trim();
    const agentMsg = chatService.saveSessionMessage(workspaceId, sessionId, {
      agentId,
      role: 'agent',
      content: agentContent,
      usage: result.usage,
      metadata: {
        systemPrompt: agent.systemPrompt,
        fullPrompt: runtimePrompt,
      },
      ...createTimelinePayload(timeline),
    });

    completed = true;
    writeSse(res, 'completed', { message: agentMsg, success: true });
  } catch (err) {
    completed = true;
    writeSse(res, 'error', { error: err instanceof Error ? err.message : String(err) });
  } finally {
    if (titleTask) await titleTask;
    res.end();
  }
});

function resolveSessionRegenerateContext(
  workspaceId: string,
  sessionId: string,
  messageId: string,
): { content: string; historyMessages: Array<{ role: 'user' | 'agent'; content: string }> } | null {
  const messages = chatService.listSessionMessages(workspaceId, sessionId);
  const targetIndex = messages.findIndex((message) => message.id === messageId && message.role === 'agent');
  if (targetIndex === -1) return null;

  for (let index = targetIndex - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === 'user') {
      return {
        content: message.content,
        historyMessages: messages.slice(0, index),
      };
    }
  }

  return null;
}

export function resolveSessionFileWorkspace(
  agentWorkspace: Workspace | null,
  session: { editorDirectoryTabs?: Array<{ path: string }> },
): Workspace | null {
  if (!agentWorkspace) return null;
  const dirs = session.editorDirectoryTabs?.map((tab) => tab.path).filter(Boolean) ?? [];
  if (dirs.length === 0) return agentWorkspace;
  return {
    ...agentWorkspace,
    boundDirs: [...agentWorkspace.boundDirs, ...dirs],
  };
}

router.post('/agents/:id/run', async (req, res) => {
  const { id } = req.params;
  const { content, regenerateFromMessageId } = req.body as { content?: string; regenerateFromMessageId?: string };
  const regenerateContext = regenerateFromMessageId
    ? resolveRegenerateContext(id, regenerateFromMessageId)
    : null;
  const trimmedContent = (regenerateContext?.content ?? content)?.trim();

  if (!trimmedContent) {
    res.status(400).json({ error: 'content is required' });
    return;
  }

  const agent = chatService.findAgent(id);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  const baseURL = resolveChatAgentBaseURL(agent);

  prepareSse(res);

  if (!baseURL && requiresBaseURL(agent.provider)) {
    writeSse(res, 'error', {
      error: `${agent.provider} requires an API Base URL. Edit this chat agent and save the provider API address again.`,
    });
    res.end();
    return;
  }

  const chatProvider = mapLangChainChatProvider(agent.provider);
  if (!chatProvider) {
    writeSse(res, 'error', {
      error: `Unsupported chat provider '${agent.provider ?? ''}' for agent chat (supported: openai-chat-completions, openai-responses, anthropic-messages).`,
    });
    res.end();
    return;
  }

  if (!regenerateContext) {
    const userMsg = chatService.saveMessage({
      agentId: id,
      role: 'user',
      content: trimmedContent,
    });
    writeSse(res, 'message_saved', userMsg);
  }

  const abortController = new AbortController();
  let completed = false;
  const timeline: WorkflowAgentTimelineItem[] = [];
  const output: string[] = [];
  const splitter = createRuntimeOutputSplitter(res, timeline, output);

  res.on('close', () => {
    if (!completed && !res.writableEnded) abortController.abort();
  });

  try {
    const historyMessages = regenerateContext?.historyMessages ?? chatService.getRecentMessages(id, 20).slice(0, -1);
    const workingDir = chatService.getAgentWorkingDir(id) || process.cwd();
    const tools = normalizeToolNames(agent.tools);
    const functionTools = [
      ...createAgentFunctionTools(id, tools),
      ...createWorkflowExecutionFunctionTools(id, tools, {
        boundWorkflowPluginTools: agent.boundWorkflowPluginTools,
      }),
    ];
    const runtimePrompt = buildChatRuntimePrompt({
      workspaceId: id,
      systemPrompt: agent.systemPrompt,
      userPrompt: trimmedContent,
      historyMessages,
      boundDirs: chatService.getAgentWorkspace(id)?.boundDirs,
      workingDir,
      builtInTools: functionTools.map((tool) => ({ name: tool.name, description: tool.description })),
      boundWorkflowIds: agent.boundWorkflowIds,
      boundWorkflowPluginTools: agent.boundWorkflowPluginTools,
    });
    const result = await langchainChat({
      provider: chatProvider,
      model: agent.model,
      apiKey: agent.apiKey,
      baseURL,
      prompt: runtimePrompt,
      tools: functionTools,
      maxSteps: 100,
      abortSignal: abortController.signal,
    });
    if (abortController.signal.aborted) return;
    for (const event of result.events) {
      collectRuntimeTimeline(timeline, event);
      writeRuntimeEvent(res, event);
    }
    splitter.push(result.text);
    splitter.flush();

    const agentContent = output.join('').trim() || result.text.trim();
    const agentMsg = chatService.saveMessage({
      agentId: id,
      role: 'agent',
      content: agentContent,
      usage: result.usage,
      ...createTimelinePayload(timeline),
    });

    completed = true;
    writeSse(res, 'completed', { message: agentMsg, success: true });
  } catch (err) {
    completed = true;
    writeSse(res, 'error', { error: err instanceof Error ? err.message : String(err) });
  } finally {
    res.end();
  }
});

function prepareSse(res: Response): void {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  res.socket?.setNoDelay?.(true);
}

function writeSse(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  const flushable = res as Response & { flush?: () => void };
  if (typeof flushable.flush === 'function') flushable.flush();
}

function writeRuntimeEvent(res: Response, event: AgentRuntimeEvent): void {
  switch (event.type) {
    case 'reasoning':
      writeSse(res, 'thinking', { chunk: event.text, status: event.status });
      break;
    case 'tool_use':
      writeSse(res, 'tool_use', { id: event.id, name: event.name, input: event.input });
      break;
    case 'tool_result':
      writeSse(res, 'tool_result', { toolUseId: event.toolUseId, result: event.result });
      break;
    default:
      break;
  }
}

function createRuntimeOutputSplitter(
  res: Response,
  timeline: WorkflowAgentTimelineItem[],
  output: string[],
) {
  return createThinkTagSplitter((part) => {
    appendTimelineText(timeline, part.type, part.content);
    if (part.type === 'message') {
      output.push(part.content);
      writeSse(res, 'output', { chunk: part.content });
    } else {
      writeSse(res, 'thinking', { chunk: part.content, status: 'streaming' });
    }
  });
}

function appendTimelineText(
  timeline: WorkflowAgentTimelineItem[],
  type: 'message' | 'thinking',
  content: string,
): void {
  const latest = timeline.at(-1);
  if (latest?.type === type) {
    latest.content += content;
  } else {
    timeline.push({ id: `${type}-${timeline.length}-${Date.now()}`, type, content });
  }
}

export function collectRuntimeTimeline(timeline: WorkflowAgentTimelineItem[], event: AgentRuntimeEvent): void {
  if (event.type === 'reasoning') {
    appendTimelineText(timeline, 'thinking', event.text);
    return;
  }

  if (event.type === 'tool_use') {
    timeline.push({
      id: event.id || `tool-${timeline.length}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'tool',
      name: event.name,
      input: event.input,
      status: 'running',
    });
    return;
  }

  if (event.type === 'tool_result') {
    const name = event.toolUseId || 'tool';
    const index = event.toolUseId
      ? findLastIndex(timeline, (item) => item.type === 'tool' && item.status === 'running' && item.id === event.toolUseId)
      : -1;
    const fallbackIndex = index === -1
      ? findLastIndex(timeline, (item) => item.type === 'tool' && item.status === 'running')
      : index;

    if (fallbackIndex === -1) {
      timeline.push({
        id: `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'tool',
        name,
        result: event.result,
        status: isErrorToolResult(event.result) ? 'error' : 'success',
      });
      return;
    }

    const item = timeline[fallbackIndex];
    if (item?.type !== 'tool') return;
    timeline[fallbackIndex] = {
      ...item,
      result: event.result,
      status: isErrorToolResult(event.result) ? 'error' : 'success',
    };
  }
}

function createTimelinePayload(timeline: WorkflowAgentTimelineItem[]): {
  timeline?: WorkflowAgentTimelineItem[];
  toolCalls?: WorkflowAgentToolCall[];
} {
  if (!timeline.length) return {};
  const completedTimeline = timeline.map((item) => (
    item.type === 'tool' && item.status === 'running'
      ? { ...item, status: 'error' as const, result: { success: false, error: 'Tool did not return a result.' } }
      : item
  ));
  return {
    timeline: completedTimeline,
    toolCalls: completedTimeline.filter((item): item is WorkflowAgentTimelineItem & { type: 'tool' } => item.type === 'tool'),
  };
}

function isErrorToolResult(result: unknown): boolean {
  return Boolean(
    result
    && typeof result === 'object'
    && 'success' in result
    && (result as { success?: unknown }).success === false
  );
}

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) return index;
  }
  return -1;
}

function shouldIncludeHistoryMessage(message: { role: 'user' | 'agent'; content: string }): boolean {
  return !(message.role === 'agent' && message.content.trim() === 'LangChain execution failed');
}

function resolveRegenerateContext(
  agentId: string,
  messageId: string,
): { content: string; historyMessages: Array<{ role: 'user' | 'agent'; content: string }> } | null {
  const messages = chatService.listMessages(agentId);
  const targetIndex = messages.findIndex((message) => message.id === messageId && message.role === 'agent');
  if (targetIndex === -1) return null;

  for (let index = targetIndex - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === 'user') {
      return {
        content: message.content,
        historyMessages: messages.slice(0, index),
      };
    }
  }

  return null;
}

function resolveChatAgentBaseURL(agent: { baseURL?: string; apiBase?: string }): string | undefined {
  return agent.baseURL?.trim() || agent.apiBase?.trim() || undefined;
}

export function buildStoredFullPrompt(systemPrompt: string | undefined, prompt: string): string {
  const trimmedSystemPrompt = systemPrompt?.trim();
  return trimmedSystemPrompt ? `${trimmedSystemPrompt}\n\n${prompt}` : prompt;
}

interface ChatRuntimePromptOptions {
  workspaceId: string;
  systemPrompt?: string;
  userPrompt: string;
  historyMessages: Array<{ role: 'user' | 'agent'; content: string }>;
  boundDirs?: string[];
  workingDir: string;
  builtInTools: Array<{ name: string; description: string }>;
  boundWorkflowIds?: string[];
  boundWorkflowPluginTools?: Array<{ pluginId: string; toolName: string }>;
}

export function buildChatRuntimePrompt(options: ChatRuntimePromptOptions): string {
  return buildAgentPrompt(
    options.workspaceId,
    options.systemPrompt,
    options.userPrompt,
    toPromptHistoryMessages(options.historyMessages),
    {
      // Chat runs on the minimal langchain-chat module: no MCP servers or skills
      // are attached, so the prompt must not advertise those capabilities.
      mcpServers: [],
      skills: [],
      boundDirs: options.boundDirs,
      workingDir: options.workingDir,
      builtInTools: options.builtInTools,
      boundWorkflowIds: options.boundWorkflowIds,
      boundWorkflowPluginTools: options.boundWorkflowPluginTools,
    },
  );
}

function requiresBaseURL(provider?: string): boolean {
  return provider === 'openai-chat-completions'
    || provider === 'openai-responses'
    || provider === 'anthropic-messages'
    || provider === 'gemini-generate-content';
}

function normalizeToolNames(tools: unknown): BuiltInAgentToolName[] | undefined {
  if (!Array.isArray(tools)) return undefined;
  return tools.filter((tool): tool is BuiltInAgentToolName => typeof tool === 'string');
}

function toPromptHistoryMessages(historyMessages: Array<{ role: 'user' | 'agent'; content: string }>): Message[] {
  return historyMessages
    .filter(shouldIncludeHistoryMessage)
    .map((message, index) => ({
      id: `chat-history-${index}`,
      channelId: 'chat',
      senderId: message.role === 'user' ? 'user' : 'agent',
      senderRole: message.role === 'user' ? 'user' : 'assistant',
      content: message.content,
      type: 'text',
      status: 'completed',
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    }));
}

export default router;
