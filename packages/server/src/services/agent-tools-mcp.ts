import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';
import type { CallToolResult, Tool, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { createRequire } from 'node:module';
import type { AgentFunctionTool } from '../adapters/agent-runtime-types.js';
import type { Workflow } from '@flow-spaces/shared';
import * as workflowService from './workflow.js';
import { getWorkflowNodes, listWorkflowPlugins } from './plugin.js';
import {
  createWorkflowExecutionFunctionTools,
  createWorkspaceMiniAppFunctionTools,
  createWorkflowEditorFunctionTools,
} from './builtin-tools/index.js';

const require = createRequire(import.meta.url);
const SERVER_VERSION = require('../../package.json').version as string;

export const AGENT_TOOLS_MCP_SERVER_NAME = 'flow-spaces-agent-tools';

/**
 * 汇总 MCP 端点对外暴露的内置 agent 工具。
 * 固定只暴露 Workflow（执行 + 节点编辑）与 Mini-app 两类；终端/知识库等其余内置工具不对外。
 */
export function listExposedAgentTools(workspaceId: string): AgentFunctionTool[] {
  return [
    ...createWorkflowExecutionFunctionTools(workspaceId),
    ...createWorkspaceEditTools(workspaceId),
    ...createWorkspaceMiniAppFunctionTools(workspaceId),
  ];
}

/** 聚合全部已启用 workflow 插件的节点定义，供编辑器工具校验/补全节点。 */
function aggregateNodeDefinitions() {
  const definitions = [];
  for (const plugin of listWorkflowPlugins()) {
    if (!plugin.enabled) continue;
    try {
      definitions.push(...getWorkflowNodes(plugin.id));
    } catch {
      // 单个插件节点定义加载失败时跳过，不影响其余插件
    }
  }
  return definitions;
}

/**
 * MCP 专用 workflow 编辑工具集：复用 SSE 编辑器的完整节点编辑工具
 * （create_node/update_node/create_edge/auto_layout/saveworkflow/dry_run/batch_update 等），
 * 额外提供 load_workflow / create_workflow 入口管理编辑草稿。
 * 与 workflow 执行工具重名的 list_agent_capabilities / list_available_agent_capabilities
 * 已从编辑器集合中剔除（保留执行工具版本）。
 */
/**
 * 每个工作区常驻的编辑器工具集（含编辑草稿闭包）。
 * MCP 端点是 stateless 的：每个 HTTP 请求重建 server/transport 实例，
 * 编辑草稿必须提升到模块级缓存才能跨请求存活（load → create_node → saveworkflow）。
 */
const workspaceEditToolsCache = new Map<string, AgentFunctionTool[]>();

function createWorkspaceEditTools(workspaceId: string): AgentFunctionTool[] {
  const cached = workspaceEditToolsCache.get(workspaceId);
  if (cached) return cached;
  const tools = buildWorkspaceEditTools(workspaceId);
  workspaceEditToolsCache.set(workspaceId, tools);
  return tools;
}

function buildWorkspaceEditTools(workspaceId: string): AgentFunctionTool[] {
  const emptyDraft: Workflow = {
    id: '',
    name: '(未加载)',
    type: 'normal',
    folderId: null,
    icon: undefined,
    description: '',
    tags: undefined,
    nodes: [],
    edges: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    triggers: undefined,
    groups: undefined,
    published: false,
  };
  const editor = createWorkflowEditorFunctionTools({
    workspaceId,
    workflow: emptyDraft,
    nodeDefinitions: aggregateNodeDefinitions(),
  });
  const editorTools = editor.filter(
    (tool) => tool.name !== 'list_agent_capabilities' && tool.name !== 'list_available_agent_capabilities',
  );
  return [
    {
      name: 'load_workflow',
      description: '加载一个已存在的 workflow 到编辑草稿（后续 create_node/update_node/saveworkflow 等编辑工具作用于它）。编辑任何工作流前必须先调用本工具或 create_workflow。',
      inputSchema: {
        type: 'object',
        properties: {
          workflow_id: { type: 'string', description: '要编辑的工作流 ID（可先用 list_workflows 查询）。' },
        },
        required: ['workflow_id'],
        additionalProperties: false,
      },
      annotations: { readOnly: false, destructive: false, openWorld: false },
      execute: async (input) => {
        const workflowId = String((input as Record<string, unknown>).workflow_id ?? '');
        const workflow = workflowService.getWorkflow(workflowId);
        if (!workflow) return { success: false, message: `Workflow not found: ${workflowId}` };
        editor.setDraftWorkflow(workflow);
        return { success: true, message: `已加载工作流「${workflow.name}」到编辑草稿`, workflow_id: workflow.id, name: workflow.name, node_count: workflow.nodes.length };
      },
    },
    {
      name: 'create_workflow',
      description: '新建一个空 workflow（落盘）并加载到编辑草稿。返回新 workflow_id，随后可用编辑工具添加节点。',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '工作流名称。' },
          description: { type: 'string', description: '工作流描述（可选）。' },
        },
        required: ['name'],
        additionalProperties: false,
      },
      annotations: { readOnly: false, destructive: false, openWorld: false },
      execute: async (input) => {
        const data = input as { name?: string; description?: string };
        const name = data.name?.trim();
        if (!name) return { success: false, message: 'name is required' };
        try {
          // 与前端新建一致：必须带一个 start 节点，否则 DAG 校验拒绝（"Workflow must have at least one node"）
          const workflow = workflowService.createWorkflow({
            name,
            description: data.description,
            nodes: [{ id: `node_${Date.now()}_start`, type: 'start', label: '开始', position: { x: 250, y: 50 }, data: {} }],
          });
          editor.setDraftWorkflow(workflow);
          return { success: true, message: `已创建工作流「${name}」并加载到编辑草稿`, workflow_id: workflow.id };
        } catch (error) {
          return { success: false, message: error instanceof Error ? error.message : String(error) };
        }
      },
    },
    ...editorTools,
  ];
}

function toMcpAnnotations(annotations: AgentFunctionTool['annotations']): ToolAnnotations | undefined {
  if (!annotations) return undefined;
  const mapped: ToolAnnotations = {
    title: undefined,
    readOnlyHint: annotations.readOnly,
    destructiveHint: annotations.destructive,
    idempotentHint: undefined,
    openWorldHint: annotations.openWorld,
  };
  return mapped;
}

function serializeToolResult(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * 将内置 agent 工具映射为 MCP Server（tools 能力）。
 * AgentFunctionTool.inputSchema 本身就是 JSON Schema，直接透传给 tools/list；
 * tools/call 时查找同名工具执行 execute，结果序列化为 text content。
 */
export function createAgentToolsMcpServer(
  workspaceId: string,
  options: { allowedTools?: string[] } = {},
): Server {
  const filter = options.allowedTools?.length ? new Set(options.allowedTools) : null;
  const exposed = listExposedAgentTools(workspaceId);
  const tools = exposed.filter((tool) => !filter || filter.has(tool.name));
  const byName = new Map(tools.map((tool) => [tool.name, tool]));

  const server = new Server(
    { name: AGENT_TOOLS_MCP_SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as Tool['inputSchema'],
      annotations: toMcpAnnotations(tool.annotations),
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const tool = byName.get(name);
    if (!tool) {
      throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${name}`);
    }
    try {
      const result = await tool.execute(request.params.arguments ?? {});
      return {
        content: [{ type: 'text', text: serializeToolResult(result) }],
      } satisfies CallToolResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `Tool ${name} failed: ${message}` }],
        isError: true,
      } satisfies CallToolResult;
    }
  });

  return server;
}
