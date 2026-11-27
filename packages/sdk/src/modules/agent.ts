import type { HttpClient } from '../client';
import type { AgentConfig, AgentUsageSessionDetail } from '@flow-spaces/shared';

export function createAgentApi(http: HttpClient) {
  return {
    listPresets: (): Promise<AgentConfig[]> =>
      http.get('/api/agents/presets'),

    getPreset: (id: string): Promise<AgentConfig> =>
      http.get(`/api/agents/presets/${id}`),

    createPreset: (data: Partial<AgentConfig>): Promise<AgentConfig> =>
      http.post('/api/agents/presets', data),

    updatePreset: (id: string, data: Partial<AgentConfig>): Promise<AgentConfig> =>
      http.put(`/api/agents/presets/${id}`, data),

    deletePreset: (id: string): Promise<void> =>
      http.delete(`/api/agents/presets/${id}`),

    sessionDetail: (agentSessionId: string): Promise<AgentUsageSessionDetail> =>
      http.get(`/api/agents/sessions/${agentSessionId}/detail`),

    /** Optimize an existing prompt */
    optimizePrompt: (prompt: string, currentPrompt?: string): Promise<{ systemPrompt?: string; error?: string }> =>
      http.post('/api/agents/presets/optimize-prompt', { prompt, currentPrompt }),

    /** Test agent connection */
    testConnection: (config: Record<string, unknown>): Promise<Record<string, unknown> & { error?: string }> =>
      http.post('/api/agents/presets/test-connection', config),

    /** Generate agent config from prompt */
    generateFromPrompt: (prompt: string): Promise<Record<string, unknown> & { error?: string }> =>
      http.post('/api/agents/presets/generate', { prompt }),
  };
}