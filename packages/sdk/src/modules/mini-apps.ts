import type { HttpClient } from '../client';
import { readMiniAppInstallStream, type MiniAppInstallProgress, type MiniAppInstallResult } from './mini-app-install';
import type { RequestOptions } from '../types';
import type { FileNode, WorkflowAgentTimelineItem } from '@flow-spaces/shared';

export interface MiniAppProject {
  id: string;
  name: string;
  description?: string;
  version: string;
  type: 'react' | 'html';
  tags?: string[];
  extensions?: 'workspace'[];
  enabledPlugins?: string[];
  /** 依赖的工作流（本地 workflow id 或 name，也支持商店模板 id/name），预览页据此核查缺失并提示一键安装 */
  enabledWorkflows?: string[];
  pluginConfigSchemes?: Record<string, string>;
  agentPermissions?: string[];
  agentConfigId?: string;
  enableAgents?: boolean;
  /** Agent Chat 的展示位置；缺省为宿主外层 dock。 */
  agentChatPlacement?: 'dock' | 'mini-app-slot';
  mainFile: string;
  /** 支持的设备类型，如 ['mobile', 'ipad', 'pc'] */
  devices?: string[];
  icon?: string;
  avatarUrl?: string;
  backgroundUrl?: string;
  createdAt: string;
  /** 最后启动时间（预览页打开时记录，集中存于后端 mini-apps/launch-times.json，不在 manifest.json 中）。 */
  lastLaunchAt?: string;
  /** 直接关联的本地项目目录，删除列表项时不删除该目录 */
  localPath?: string;
  storeUrl?: string;
  storeChecksum?: string;
  /** 更新时保留开发版源码安装模式 */
  storeDevelopment?: boolean;
}

export interface MiniAppAgentConfig {
  id: string;
  name: string;
  avatar?: string;
  /** 空态展示的介绍文本（agent 对话无消息时显示） */
  introduction?: string;
  /** 引用全局 Agent Preset id，复用其密钥（可选） */
  agentId?: string;
  runtimeKind?: 'open-agent-sdk' | 'claude-code' | 'codex' | 'grok' | 'gemini-cli' | 'langchain' | 'hermes' | 'pi' | 'deepseek-harness';
  modelProvider?: string;
  providerId?: string;
  modelId?: string;
  apiKey?: string;
  apiBase?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  hideInAgentList?: boolean;
  tools?: { api?: boolean; plugin?: boolean };
}

export interface MiniAppChatMessage {
  id: string;
  sessionId: string;
  agentId: string;
  role: 'user' | 'agent';
  content: string;
  route?: string;
  toolCalls?: Array<{ name: string; input: unknown; result: unknown }>;
  timeline?: WorkflowAgentTimelineItem[];
  timestamp: string;
}

/** 会话摘要（不含消息体） */
export interface MiniAppChatSessionSummary {
  id: string;
  agentId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export function createMiniAppApi(http: HttpClient) {
  return {
    list: (): Promise<MiniAppProject[]> =>
      http.get('/api/mini-apps'),

    get: (id: string): Promise<MiniAppProject> =>
      http.get(`/api/mini-apps/${encodeURIComponent(id)}`),

    /** 读取预构建的 CommonJS 组件与可选 CSS；未构建时返回 null。 */
    getDist: (id: string): Promise<{ code: string; css?: string } | null> =>
      http.get(`/api/mini-apps/${encodeURIComponent(id)}/dist`),

    /** 记录一次启动（预览页打开时调用），返回记录的最后启动时间 */
    markLaunched: (id: string): Promise<{ ok: true; lastLaunchAt: string }> =>
      http.post(`/api/mini-apps/${encodeURIComponent(id)}/launch`),

    create: (data: { name: string; type: 'react' | 'html'; description?: string; tags?: string[] }): Promise<MiniAppProject> =>
      http.post('/api/mini-apps', data),

    update: (id: string, data: Partial<Pick<MiniAppProject, 'name' | 'description' | 'tags' | 'enabledPlugins' | 'pluginConfigSchemes' | 'agentPermissions' | 'agentConfigId' | 'agentChatPlacement' | 'mainFile' | 'icon' | 'avatarUrl' | 'backgroundUrl' | 'devices'>>): Promise<MiniAppProject> =>
      http.put(`/api/mini-apps/${encodeURIComponent(id)}`, data),

    delete_: (id: string): Promise<void> =>
      http.delete(`/api/mini-apps/${encodeURIComponent(id)}`),

    getFileTree: (id: string): Promise<string[]> =>
      http.get(`/api/mini-apps/${encodeURIComponent(id)}/files`),

    /** 解析 src 中的源码路径，供开发态组件定位使用。 */
    getSourceFileAbsolutePath: (id: string, filePath: string): Promise<string> =>
      http.get<{ path: string }>(`/api/mini-apps/${encodeURIComponent(id)}/files/absolute-path?path=${encodeURIComponent(filePath)}`).then((result) => result.path),

    getFileManifest: (id: string): Promise<{ path: string; mtimeMs: number }[]> =>
      http.get(`/api/mini-apps/${encodeURIComponent(id)}/files/manifest`),

    readFile: (id: string, filePath: string): Promise<{ content: string }> =>
      http.get(`/api/mini-apps/${encodeURIComponent(id)}/files/content?path=${encodeURIComponent(filePath)}`),

    readConfig: <T = unknown>(id: string, filePath: string): Promise<{ value: T | null }> =>
      http.get(`/api/mini-apps/${encodeURIComponent(id)}/configs/content?path=${encodeURIComponent(filePath)}`),

    writeDataFile: (id: string, filePath: string, content: string, encoding?: 'base64'): Promise<{ ok: true; path: string; size: number }> =>
      http.put(`/api/mini-apps/${encodeURIComponent(id)}/data/content`, { path: filePath, content, encoding }),

    readDataFile: (id: string, filePath: string): Promise<{ content: string }> =>
      http.get(`/api/mini-apps/${encodeURIComponent(id)}/data/content?path=${encodeURIComponent(filePath)}`),

    getAgentFilesTree: (id: string, path = '', depth = 1, scope: 'preview' | 'editor' = 'preview'): Promise<FileNode[]> =>
      http.get(`/api/mini-apps/${encodeURIComponent(id)}/agent-files/tree?path=${encodeURIComponent(path)}&depth=${depth}&scope=${encodeURIComponent(scope)}`),

    readAgentFile: (id: string, filePath: string, scope: 'preview' | 'editor' = 'preview'): Promise<{ content: string; encoding: string }> =>
      http.get(`/api/mini-apps/${encodeURIComponent(id)}/agent-files/content?path=${encodeURIComponent(filePath)}&scope=${encodeURIComponent(scope)}`),

    getAgentFileAbsolutePath: (id: string, filePath = '', scope: 'preview' | 'editor' = 'preview'): Promise<string> =>
      http.get<{ path: string }>(`/api/mini-apps/${encodeURIComponent(id)}/agent-files/absolute-path?path=${encodeURIComponent(filePath)}&scope=${encodeURIComponent(scope)}`).then((result) => result.path),

    writeAgentFile: (id: string, filePath: string, content: string, scope: 'preview' | 'editor' = 'preview'): Promise<void> =>
      http.putVoid(`/api/mini-apps/${encodeURIComponent(id)}/agent-files/content`, { path: filePath, content, scope }),

    deleteAgentFile: (id: string, filePath: string, scope: 'preview' | 'editor' = 'preview'): Promise<void> =>
      http.delete(`/api/mini-apps/${encodeURIComponent(id)}/agent-files?path=${encodeURIComponent(filePath)}&scope=${encodeURIComponent(scope)}`),

    renameAgentFile: (id: string, from: string, to: string, scope: 'preview' | 'editor' = 'preview'): Promise<void> =>
      http.postVoid(`/api/mini-apps/${encodeURIComponent(id)}/agent-files/rename`, { from, to, scope }),

    linkAgentFolder: (id: string, sourcePath: string, scope: 'preview' | 'editor' = 'preview'): Promise<{ ok: true; path: string }> =>
      http.post(`/api/mini-apps/${encodeURIComponent(id)}/agent-files/link-folder`, { sourcePath, scope }),

    uploadAgentFiles: (id: string, formData: FormData): Promise<{ ok: true; files: { path: string; size: number }[] }> =>
      http.upload(`/api/mini-apps/${encodeURIComponent(id)}/agent-files/upload`, formData),

    /** 关联服务器上的已有目录，不复制项目文件 */
    addLocal: (path: string): Promise<MiniAppProject> =>
      http.post('/api/mini-apps/local', { path }),

    importZip: (data: { zip: string; name?: string; type?: 'react' | 'html'; description?: string; id?: string; storeUrl?: string; storeChecksum?: string }): Promise<MiniAppProject> =>
      http.post('/api/mini-apps/import', data),

    /** 商店增量安装：按文件级 md5 清单对比本地，仅下载缺失/变化的文件 */
    installFromStore: async (data: {
      id: string;
      baseUrl: string;
      manifest?: { name?: string; type?: 'react' | 'html'; description?: string; version?: string; tags?: string[]; icon?: string; enabledPlugins?: string[]; enabledWorkflows?: string[]; mainFile?: string };
      files: Array<{ path: string; md5: string }>;
      development?: Array<{ path: string; md5: string }>;
      installDevelopment?: boolean;
      storeUrl?: string;
      storeChecksum?: string;
    }, onProgress?: (progress: MiniAppInstallProgress) => void): Promise<MiniAppInstallResult> => {
      if (!onProgress) return http.post('/api/mini-apps/install-from-store', data);
      const response = await http.sse('/api/mini-apps/install-from-store', data);
      return readMiniAppInstallStream(response, onProgress);
    },

    exportZip: (id: string): Promise<Blob> =>
      http.raw(`/api/mini-apps/${encodeURIComponent(id)}/export`).then(r => r.blob()),

    uploadAvatar: (id: string, dataUrl: string): Promise<{ url: string }> =>
      http.post(`/api/mini-apps/${encodeURIComponent(id)}/avatar`, { dataUrl }),

    getAvatarUrl: (id: string): string =>
      `/api/mini-apps/${encodeURIComponent(id)}/avatar`,

    uploadBackground: (id: string, dataUrl: string): Promise<{ url: string }> =>
      http.post(`/api/mini-apps/${encodeURIComponent(id)}/background`, { dataUrl }),

    getBackgroundUrl: (id: string): string =>
      `/api/mini-apps/${encodeURIComponent(id)}/background`,

    /** Reveal project folder in OS file manager */
    revealFolder: (id: string): Promise<{ ok: true; path: string }> =>
      http.post(`/api/mini-apps/${encodeURIComponent(id)}/reveal`),

    // ---- Agents (preview chat) ----

    listAgents: (id: string): Promise<{ enableAgents: boolean; agents: Array<{ id: string; name: string; avatar?: string; introduction?: string; suggestions?: string[] }> }> =>
      http.get(`/api/mini-apps/${encodeURIComponent(id)}/agents`),

    /** 用 manifest.agents 种子重置 agents.json（保留 provider/model/runtimeKind 配置） */
    resetAgents: (id: string): Promise<{ ok: true; count: number }> =>
      http.post(`/api/mini-apps/${encodeURIComponent(id)}/agents/reset`),

    /** 读取单条 agent 的完整配置（含 apiKey，供编辑器加载） */
    getAgent: (id: string, agentId: string): Promise<MiniAppAgentConfig> =>
      http.get(`/api/mini-apps/${encodeURIComponent(id)}/agents/${encodeURIComponent(agentId)}`),

    /** 更新单条 agent 配置（整体替换） */
    updateAgent: (id: string, agentId: string, data: MiniAppAgentConfig): Promise<MiniAppAgentConfig> =>
      http.put(`/api/mini-apps/${encodeURIComponent(id)}/agents/${encodeURIComponent(agentId)}`, data),

    agentHistory: (id: string, sessionId: string, agentId?: string): Promise<{ messages: MiniAppChatMessage[] }> =>
      http.get(`/api/mini-apps/${encodeURIComponent(id)}/agents/chat?sessionId=${encodeURIComponent(sessionId)}${agentId ? `&agentId=${encodeURIComponent(agentId)}` : ''}`),

    /** 列出所有会话摘要（可选按 agentId 过滤） */
    listAgentSessions: (id: string, agentId?: string): Promise<{ sessions: MiniAppChatSessionSummary[] }> =>
      http.get(`/api/mini-apps/${encodeURIComponent(id)}/agents/sessions${agentId ? `?agentId=${encodeURIComponent(agentId)}` : ''}`),

    /** 获取 session 文件所在目录的绝对路径。 */
    getAgentSessionDirectory: (id: string, sessionId: string): Promise<string> =>
      http.get<{ path: string }>(`/api/mini-apps/${encodeURIComponent(id)}/agents/sessions/${encodeURIComponent(sessionId)}/directory`).then((result) => result.path),

    /** 重命名会话标题 */
    renameAgentSession: (id: string, sessionId: string, title: string): Promise<{ session: MiniAppChatSessionSummary & { messages?: MiniAppChatMessage[] } }> =>
      http.patch(`/api/mini-apps/${encodeURIComponent(id)}/agents/sessions/${encodeURIComponent(sessionId)}`, { title }),

    /** 保留指定消息及之前的历史，创建一个分支会话。 */
    branchAgentSession: (id: string, sessionId: string, messageId: string): Promise<{ session: MiniAppChatSessionSummary & { messages: MiniAppChatMessage[] } }> =>
      http.post(`/api/mini-apps/${encodeURIComponent(id)}/agents/sessions/${encodeURIComponent(sessionId)}/branch`, { messageId }),

    /** 清空某 session 的历史（可选按 agentId 过滤）。 */
    clearAgentHistory: (id: string, sessionId: string, agentId?: string): Promise<void> =>
      http.delete(`/api/mini-apps/${encodeURIComponent(id)}/agents/chat?sessionId=${encodeURIComponent(sessionId)}${agentId ? `&agentId=${encodeURIComponent(agentId)}` : ''}`),

    /** 删除单条消息 */
    deleteAgentMessage: (id: string, sessionId: string, messageId: string): Promise<void> =>
      http.delete(`/api/mini-apps/${encodeURIComponent(id)}/agents/sessions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(messageId)}`),

    /**
     * SSE 流式聊天。返回原始 Response，调用方用 reader 解析 `event:` / `data:` 行。
     * body: { sessionId, message, route? }
     */
    agentChat: (id: string, agentId: string, body: { sessionId: string; message: string; route?: string }, opts?: RequestOptions): Promise<Response> =>
      http.sse(`/api/mini-apps/${encodeURIComponent(id)}/agents/${encodeURIComponent(agentId)}/chat`, body, opts),

    rerunAgentTool: (id: string, agentId: string, name: string, input: unknown): Promise<{ result: unknown }> =>
      http.post(`/api/mini-apps/${encodeURIComponent(id)}/agents/${encodeURIComponent(agentId)}/tools/rerun`, { name, input }),

    answerAgentQuestion: (id: string, agentId: string, questionId: string, answer: string): Promise<void> =>
      http.postVoid(`/api/mini-apps/${encodeURIComponent(id)}/agents/${encodeURIComponent(agentId)}/questions/${encodeURIComponent(questionId)}/answer`, { answer }),
  };
}
