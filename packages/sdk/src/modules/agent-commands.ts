import type { HttpClient } from '../client';

export function createAgentCommandsApi(http: HttpClient) {
  return {
    /** Get commands for a specific agent */
    listForAgent: (agentId: string): Promise<Array<{ name: string; content: string; group?: string }>> =>
      http.get(`/api/agent-commands/${agentId}`),

  };
}
