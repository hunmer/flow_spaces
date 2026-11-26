import { Router } from 'express';
import type { Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { getAccessToken } from '../services/auth-store.js';
import { createAgentToolsMcpServer } from '../services/agent-tools-mcp.js';
import { getWorkspace, listWorkspaces } from '../storage/workspace-store.js';

/**
 * 将内置 agent 工具暴露为 MCP Streamable HTTP 端点（stateless 模式）：
 *   POST /mcp            → 使用默认（第一个）工作区
 *   POST /mcp/:workspaceId → 使用指定工作区
 * 鉴权：Authorization: Bearer <accessToken>（与 /api 一致），也支持 ?token= 查询参数。
 * 可选 ?tools=A,B 逗号分隔白名单，只暴露指定工具。
 */
const router = Router();

function hasValidToken(req: Request): boolean {
  const accessToken = getAccessToken();
  // 免鉴权模式（未配置 FLOW_SPACES_TOKEN 且 auth.json 无 secret）：
  // 与 /api authMiddleware 的空 accessToken 放行语义保持一致
  if (accessToken === '') return true;
  const auth = req.headers.authorization;
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : '';
  const queryToken = typeof req.query.token === 'string' ? req.query.token : '';
  return (bearer !== '' && bearer === accessToken) || (queryToken !== '' && queryToken === accessToken);
}

function resolveWorkspaceId(req: Request): string | null {
  const id = typeof req.params.workspaceId === 'string' ? req.params.workspaceId : '';
  if (id) return getWorkspace(id) ? id : null;
  return listWorkspaces()[0]?.id ?? null;
}

async function handleMcpRequest(req: Request, res: Response): Promise<void> {
  if (!hasValidToken(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const workspaceId = resolveWorkspaceId(req);
  if (!workspaceId) {
    res.status(404).json({ error: 'workspace not found' });
    return;
  }
  const allowedTools = typeof req.query.tools === 'string'
    ? req.query.tools.split(',').map((item) => item.trim()).filter(Boolean)
    : undefined;

  // stateless：每个请求独立的 server+transport，用完即关
  const server = createAgentToolsMcpServer(workspaceId, { allowedTools });
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on('close', () => {
    transport.close();
    server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}

const paths = ['/', '/:workspaceId'];
router.post(paths, (req, res) => void handleMcpRequest(req, res));
router.get(paths, (req, res) => void handleMcpRequest(req, res));
router.delete(paths, (req, res) => void handleMcpRequest(req, res));

export default router;
