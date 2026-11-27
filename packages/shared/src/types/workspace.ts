import type { BuiltInAgentToolName } from './tool.js';

export type BuiltInAgentRole = 'agent' | 'scheduler' | 'bot';
export type AgentRole = BuiltInAgentRole | (string & {});

export interface Workspace {
  id: string;
  name: string;
  boundDirs: string[];
  agentspaceDir: string;
  createdAt: string;
  updatedAt: string;
  hooksEnabled?: boolean;
}

export interface AgentConfig {
  id: string;
  name: string;
  role: AgentRole;
  description?: string;
  runtimeKind?: 'langchain';
  modelProvider?: 'anthropic-messages' | 'openai-chat-completions' | 'openai-responses' | 'openai-responses-to-anthropic-messages' | 'openai-chat-completions-to-anthropic-messages' | 'gemini-generate-content';
  providerId?: string;
  modelId?: string;
  apiBase?: string;
  apiKey?: string;
  workingDir?: string;
  mcps?: Record<string, unknown>;
  skills?: string[];
  tools?: BuiltInAgentToolName[];
  boundWorkflowIds?: string[];
  boundWorkflowPluginTools?: Array<{ pluginId: string; toolName: string }>;
  systemPrompt?: string;
  outputStyle?: string;
  /** 预设消息建议：聊天输入框的快捷提示（如 mini-app 预览聊天） */
  suggestions?: string[];
  /** 开场白：进入会话空状态时由 Agent 主动发出的欢迎语 */
  openingMessage?: string;
  temperature?: number;
  maxTokens?: number;
  avatarUrl?: string;
  /** emoji icon，优先级低于 avatarUrl */
  icon?: string;
  /** 个人资料背景图 */
  backgroundUrl?: string;
  sandboxDirs?: string[];
  maxRetries?: number;
  /** 标识该 agent 由哪个模板创建，用于导入去重 */
  templateId?: string;
  /** Hide this agent from the global sidebar agent list. */
  hideInAgentList?: boolean;
  enabled: boolean;
}
