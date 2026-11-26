import { runTitleGeneratorAgent } from '../agents/title-generator-agent.js';
import type { ChatSession } from '../storage/chat-store.js';
import * as chatService from './chat.js';

export function scheduleChatSessionTitleGeneration(input: {
  workspaceId: string;
  sessionId: string;
  requirement: string;
  onUpdated: (session: ChatSession) => void;
}): void {
  if (!input.requirement.trim()) return;
  void generateChatSessionTitle(input).catch((err) => {
    console.error('[title-generator] chat session title generation failed', {
      workspaceId: input.workspaceId,
      sessionId: input.sessionId,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

export async function generateChatSessionTitle(input: {
  workspaceId: string;
  sessionId: string;
  requirement: string;
  onUpdated: (session: ChatSession) => void;
}): Promise<void> {
  const title = await runTitleGeneratorAgent({
    workspaceId: input.workspaceId,
    target: 'session',
    requirement: input.requirement,
  });
  const current = chatService.findSession(input.workspaceId, input.sessionId);
  if (!current || current.title?.trim()) return;

  const updated = chatService.updateSession(input.workspaceId, input.sessionId, { title });
  if (updated) input.onUpdated(updated);
}
