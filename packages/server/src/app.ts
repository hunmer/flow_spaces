#!/usr/bin/env node
import { config as loadDotenv } from 'dotenv';
loadDotenv();

import { createWriteStream, WriteStream } from 'node:fs';
import { setupProcmLogger } from './procm-logger.js';

// ---- procm 结构化日志 ----
// 由 procm 管理时（自动注入 PROCM_ROOM_ID/PROCM_WS_URL）连接 room 并发布日志；否则仅向控制台输出结构化帧。
// 必须在下方自制文件日志劫持之前安装，使 __origLog 指向 procm 的 console，文件日志可同步记录结构化帧。
const procmLogger = setupProcmLogger('server');

// ---- 日志输出到文件 ----
const __logDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'logs');
if (!existsSync(__logDir)) mkdirSync(__logDir, { recursive: true });

const __today = () => new Date().toISOString().slice(0, 10);
let __logDate = __today();
let __logStream: WriteStream = createWriteStream(join(__logDir, `server-${__logDate}.log`), { flags: 'a' });

const __writeLog = (level: string, args: unknown[]) => {
  try {
    // 跨天滚动文件
    const today = __today();
    if (today !== __logDate) {
      __logDate = today;
      __logStream.end();
      __logStream = createWriteStream(join(__logDir, `server-${__logDate}.log`), { flags: 'a' });
    }
    const time = new Date().toISOString();
    const line = args.map(a => typeof a === 'string' ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })()).join(' ');
    __logStream.write(`[${time}] [${level}] ${line}\n`);
  } catch { /* ignore log errors */ }
};

const __origLog = console.log.bind(console);
const __origWarn = console.warn.bind(console);
const __origError = console.error.bind(console);
console.log = (...args: unknown[]) => { __writeLog('LOG', args); __origLog(...args); };
console.warn = (...args: unknown[]) => { __writeLog('WARN', args); __origWarn(...args); };
console.error = (...args: unknown[]) => { __writeLog('ERROR', args); __origError(...args); };

process.on('uncaughtException', (err) => __writeLog('FATAL', [`uncaughtException:`, err?.stack || err]));
process.on('unhandledRejection', (reason) => __writeLog('FATAL', [`unhandledRejection:`, reason]));
// -----------------------

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname, extname, resolve, basename, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import fileRouter from './routes/file.js';
import workspaceRouter from './routes/workspace.js';
import channelRouter from './routes/channel.js';
import workflowRouter, { setWorkflowTriggerService, setWorkflowExecutionManager as setRouteWorkflowExecutionManager } from './routes/workflow.js';
import pluginRouter from './routes/plugin.js';
import { startServerLoadPluginScripts } from './services/plugin.js';
import agentRouter from './routes/agent.js';
import llmRouter from './routes/llm.js';
import modelCatalogRouter from './routes/model-catalog.js';
import authRouter from './routes/auth.js';
import accountRouter from './routes/account.js';
import folderRouter from './routes/folder.js';
import skillRouter from './routes/skill.js';
import mcpRouter from './routes/mcp.js';
import agentSseRouter from './routes/agent-sse.js';
import searchRouter from './routes/search.js';
import notificationRouter from './routes/notification.js';
import knowledgeBaseRouter from './routes/knowledge-base.js';
import agentCommandsRouter from './routes/agent-commands.js';
import externalImportRouter from './routes/external-import.js';
import chatRouter from './routes/chat.js';
import chatRunRouter from './routes/chat-run.js';
import miniAppRouter from './routes/mini-apps.js';
import sqliteRouter from './routes/sqlite.js';
import mcpServerRouter from './routes/mcp-server.js';
import { getUserSettings, setUserAvatarUrl, removeUserAvatarUrl, getStoreSources, setStoreSources, type StoreSourcesConfig } from './storage/user-settings-store.js';
import { getDataDir } from './storage/json-store.js';
import { authMiddleware, verifyToken } from './middleware/auth.js';
import { handleConnection } from './ws/handler.js';
import { broadcastToAll } from './ws/connection-manager.js';
import { InteractionManager } from './services/interaction-manager.js';
import { ClientNodeManager } from './services/client-node-manager.js';
import { ExecutionManager } from './services/execution-manager.js';
import { WorkflowTriggerService } from './services/workflow-trigger-service.js';
import { registerExecutionChannels } from './ws/execution-channels.js';
import { registerMiniAppChannels } from './ws/mini-app-channels.js';
import { broadcastToWorkspace } from './ws/connection-manager.js';
import { createWorkflowHookRouter } from './routes/workflow-hook.js';
import { setWorkflowExecutionManager } from './services/builtin-tools/index.js';
import { ensureBuiltInAgentTemplates } from './services/agent.js';
import { rebuildIndex as rebuildMiniAppIndex } from './storage/mini-app-store.js';
import { ensureAgentsConfigs, startServicesWatcher } from './services/mini-app-services.js';
import { registerAllMiniAppTools } from './services/mini-app-agent.js';
const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3100', 10);

const resolveRuntimeDir = (name: string) => {
  const currentDir = join(__dirname, name);
  if (existsSync(currentDir)) return currentDir;
  return join(__dirname, '..', name);
};

const app = express();
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '50mb' }));
// MCP Streamable HTTP 端点：将内置 agent 工具暴露给外部 agent（自带 Bearer 鉴权）
app.use('/mcp', mcpServerRouter);
app.use('/api/agent-sse', agentSseRouter);

// Inspector track endpoint (no auth - called by dom-inspector-hook from external apps)
app.post('/api/inspector/track', (req, res) => {
  const { path, name, line, column, timestamp } = req.body as {
    path?: string;
    name?: string;
    line?: number;
    column?: number;
    timestamp?: number;
  };
  if (!path || line == null) {
    res.status(400).json({ error: 'path and line are required' });
    return;
  }
  broadcastToAll('inspector.jump', { path, name, line, column: column ?? 1, timestamp });
  res.json({ ok: true });
});

app.use('/api', authMiddleware);

app.get('/api/procm-config', (_req, res) => {
  const roomId = process.env.PROCM_ROOM_ID;
  const url = process.env.PROCM_WS_URL;
  const token = process.env.PROCM_HTTP_TOKEN;
  res.json(roomId && url ? { roomId, url, ...(token ? { token } : {}) } : { roomId: null, url: null });
});

app.post('/api/procm-log', (req, res) => {
  const level = req.body?.level;
  const args = Array.isArray(req.body?.args) ? req.body.args.slice(0, 20) : [];
  if (!['debug', 'info', 'log', 'warn', 'error'].includes(level)) {
    res.status(400).json({ error: 'invalid log level' });
    return;
  }
  if (level === 'warn') procmLogger.warn('', args);
  else if (level === 'error') procmLogger.error('', args);
  else if (level === 'debug') procmLogger.debug('', args);
  else procmLogger.info('', args);
  res.status(204).end();
});

// Serve static files from public/
const publicDir = resolveRuntimeDir('public');
app.use('/public', express.static(publicDir));
app.use('/static', express.static(publicDir));
app.use('/static', express.static(join(getDataDir(), 'public')));

// Serve template store resources from packages/templates/
const agentsDir = resolveRuntimeDir('../templates');
app.use('/agents-store', express.static(agentsDir));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), platform: process.platform });
});

app.use('/api/auth', authRouter);
app.use('/api/account', accountRouter);

app.post('/api/upload', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'file is required' });
    return;
  }

  const uploadsDir = join(publicDir, 'uploads');
  if (!existsSync(uploadsDir)) await mkdir(uploadsDir, { recursive: true });

  const originalName = normalizeUploadFileName(file.originalname);
  const ext = extname(originalName);
  const safeBaseName = basename(originalName, ext).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') || 'file';
  const name = `${safeBaseName}-${randomUUID()}${ext}`;
  const path = join(uploadsDir, name);
  await writeFile(path, file.buffer);

  const url = `/static/uploads/${name}`;
  const protocol = req.headers['x-forwarded-proto']?.toString().split(',')[0] || req.protocol;
  const host = req.get('host');
  const httpPath = host ? `${protocol}://${host}${url}` : url;
  res.json({
    name: originalName,
    storedName: name,
    path,
    size: file.size,
    type: file.mimetype,
    url,
    httpPath,
  });
});

function normalizeUploadFileName(name: string): string {
  if (!/[\u0080-\u009f]/.test(name)) return name;

  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  if (!decoded || decoded.includes('\uFFFD') || /[\u0000-\u001f]/.test(decoded)) return name;
  return decoded;
}

// Avatar upload
app.post('/api/upload/avatar', async (req, res) => {
  const { dataUrl } = req.body as { dataUrl?: string };
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    res.status(400).json({ error: 'Invalid dataUrl' });
    return;
  }
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    res.status(400).json({ error: 'Invalid base64 data' });
    return;
  }
  const [, mime, base64] = match;
  const extByMime: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  const ext = extByMime[mime.toLowerCase()];
  if (!ext) {
    res.status(400).json({ error: 'Unsupported avatar image type' });
    return;
  }
  const name = `${randomUUID()}.${ext}`;
  const avatarsDir = join(publicDir, 'avatars');
  if (!existsSync(avatarsDir)) mkdirSync(avatarsDir, { recursive: true });
  await writeFile(join(avatarsDir, name), Buffer.from(base64, 'base64'));
  res.json({ url: `/static/avatars/${name}` });
});

// Font upload
const FONT_EXTS = new Set(['.ttf', '.otf', '.woff', '.woff2']);
const fontsDir = join(publicDir, 'fonts');
if (!existsSync(fontsDir)) mkdirSync(fontsDir, { recursive: true });

app.get('/api/fonts', (_req, res) => {
  if (!existsSync(fontsDir)) { res.json([]); return; }
  const fonts = readdirSync(fontsDir).filter(f => FONT_EXTS.has(extname(f).toLowerCase()));
  res.json(fonts.map(f => ({ name: f, url: `/static/fonts/${f}` })));
});

app.post('/api/fonts/upload', async (req, res) => {
  const { name, content } = req.body as { name?: string; content?: string };
  if (!name || !content) { res.status(400).json({ error: 'name and content are required' }); return; }
  const ext = extname(name).toLowerCase();
  if (!FONT_EXTS.has(ext)) { res.status(400).json({ error: 'Unsupported font format' }); return; }
  const safeName = basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
  await writeFile(join(fontsDir, safeName), Buffer.from(content, 'base64'));
  res.json({ name: safeName, url: `/static/fonts/${safeName}` });
});

app.delete('/api/fonts/:name', (req, res) => {
  const name = basename(req.params.name);
  const ext = extname(name).toLowerCase();
  if (!FONT_EXTS.has(ext)) { res.status(400).json({ error: 'Invalid font file' }); return; }
  const filePath = join(fontsDir, name);
  if (!existsSync(filePath)) { res.status(404).json({ error: 'Font not found' }); return; }
  import('node:fs').then(fs => fs.unlinkSync(filePath));
  res.json({ ok: true });
});

// User settings
app.get('/api/user/settings', (_req, res) => {
  const settings = getUserSettings();
  res.json({ avatarUrl: settings.avatarUrl ?? null });
});

app.put('/api/user/settings', (req, res) => {
  const { avatarUrl } = req.body as { avatarUrl?: string };
  if (avatarUrl === null || avatarUrl === undefined) {
    removeUserAvatarUrl();
  } else if (typeof avatarUrl === 'string') {
    setUserAvatarUrl(avatarUrl);
  }
  res.json({ ok: true });
});

// Store sources（商店源地址：plugins / workflows / mini-app）
const STORE_SOURCE_CATEGORIES = ['plugins', 'workflows', 'mini-app'] as const;
const MAX_STORE_SOURCES_PER_CATEGORY = 50;

/** 校验并归一商店源配置；null 表示恢复默认（清空存储）。非法输入返回 error 字符串。 */
function sanitizeStoreSources(input: unknown): { sources: StoreSourcesConfig | null } | { error: string } {
  if (input === null || input === undefined) return { sources: null };
  if (typeof input !== 'object' || Array.isArray(input)) return { error: 'sources must be an object or null' };
  const raw = input as Record<string, unknown>;
  const sources: StoreSourcesConfig = { plugins: [], workflows: [], 'mini-app': [] };
  for (const category of STORE_SOURCE_CATEGORIES) {
    const list = raw[category];
    if (list === undefined || list === null) continue; // 缺省类别视作空（前端回落默认源）
    if (!Array.isArray(list)) return { error: `sources.${category} must be an array` };
    if (list.length > MAX_STORE_SOURCES_PER_CATEGORY) {
      return { error: `sources.${category} exceeds ${MAX_STORE_SOURCES_PER_CATEGORY} entries` };
    }
    for (const item of list) {
      if (item === null || typeof item !== 'object' || Array.isArray(item)) {
        return { error: `sources.${category} items must be objects` };
      }
      const { id, name, url, default: isDefault } = item as {
        id?: unknown;
        name?: unknown;
        url?: unknown;
        default?: unknown;
      };
      if (typeof url !== 'string' || !url.trim()) return { error: 'source url is required' };
      const cleanUrl = url.trim();
      // 允许绝对 http(s) 地址与同源相对路径（/agents-store 等）
      if (!/^https?:\/\/\S+$/i.test(cleanUrl) && !/^\/\S+$/.test(cleanUrl)) {
        return { error: `invalid source url: ${cleanUrl}` };
      }
      const cleanId = typeof id === 'string' && id.trim() ? id.trim() : randomUUID();
      const cleanName = typeof name === 'string' ? name.trim().slice(0, 64) : '';
      sources[category].push({ id: cleanId, name: cleanName, url: cleanUrl, default: isDefault === true });
    }
    // 归一默认源：多个 default=true 只留第一个；非空且全部未标记时第一个补默认
    const entries = sources[category];
    if (entries.length > 0) {
      let hasDefault = false;
      for (const entry of entries) {
        const isDefault = entry.default === true && !hasDefault;
        if (isDefault) hasDefault = true;
        entry.default = isDefault;
      }
      if (!hasDefault) entries[0]!.default = true;
    }
  }
  return { sources };
}

app.get('/api/user/store-sources', (_req, res) => {
  res.json({ sources: getStoreSources() });
});

app.put('/api/user/store-sources', (req, res) => {
  const { sources: input } = req.body as { sources?: unknown };
  const result = sanitizeStoreSources(input);
  if ('error' in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  setStoreSources(result.sources);
  res.json({ ok: true, sources: result.sources });
});

app.use('/api/workspaces/:id/files', fileRouter);
app.use('/api/workspaces/:id/channels', channelRouter);
app.use('/api/workspaces', workspaceRouter);
app.use('/api/workflows', workflowRouter);
app.use('/api/mini-apps', miniAppRouter);
app.use('/api/sqlite', sqliteRouter);
app.use('/api/plugins', pluginRouter);

// Initialize workflow execution infrastructure
const interactionManager = new InteractionManager();
const clientNodeManager = new ClientNodeManager();
const executionManager = new ExecutionManager({
  interactionManager,
  clientNodeManager,
  emit: (channel, payload, workspaceId) => {
    // Only broadcast workflow execution events when the originating session
    // has an explicit WS workspace scope. Hook/SSE executions use eventSink instead.
    if (workspaceId) {
      broadcastToWorkspace(workspaceId, channel, payload);
    }
  },
});
const triggerService = new WorkflowTriggerService(PORT);
triggerService.setExecutionManager(executionManager);
setWorkflowTriggerService(triggerService);
setWorkflowExecutionManager(executionManager);
// 注入给 workflow 路由，启用 POST /api/workflows/:id/execute（SSE 执行入口）
setRouteWorkflowExecutionManager(executionManager);

// Workflow webhook hook SSE endpoint (after auth middleware)
app.use('/api/workflows', createWorkflowHookRouter(triggerService, executionManager));

// Register WS execution channels
registerExecutionChannels(executionManager);
registerMiniAppChannels();
app.use('/api/workspaces/:id/agents', agentRouter);

app.use('/api/workspaces/:id/search', searchRouter);
app.use('/api/workspaces/:id/knowledge-bases', knowledgeBaseRouter);
app.use('/api/workspaces/:id/notifications', notificationRouter);
app.use('/api/agents', agentRouter);
app.use('/api', llmRouter);
app.use('/api/model-catalog', modelCatalogRouter);
app.use('/api/folder', folderRouter);
app.use('/api/skills', skillRouter);
app.use('/api/mcps', mcpRouter);
app.use('/api/agent-commands', agentCommandsRouter);
app.use('/api/external-import', externalImportRouter);
app.use('/api/chat', chatRouter);
app.use('/api/chat', chatRunRouter);

// Serve static web frontend in production (after API routes, before catch-all)
const webDir = resolveRuntimeDir('web');
if (existsSync(webDir)) {
  // /static/* -> public/* (avatar URLs etc.)
  app.use('/static', express.static(publicDir));
  // web static assets (_next, codemirror vendor chunks, etc.)
  app.use(express.static(webDir));

  // SPA fallback: serve correct HTML for each route
  const indexHtml = join(webDir, 'index.html');
  const isInsideWebDir = (filePath: string) => {
    const rel = relative(webDir, filePath);
    return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
  };
  const tryWebFiles = (...rels: string[]) => {
    for (const rel of rels) {
      const filePath = resolve(webDir, rel.replace(/^\/+/, ''));
      if (isInsideWebDir(filePath) && existsSync(filePath) && statSync(filePath).isFile()) return filePath;
    }
    return null;
  };
  const resolveWebFallback = (pathname: string) => {
    let clean = pathname;
    try { clean = decodeURIComponent(pathname); } catch { /* keep raw pathname */ }
    clean = clean.replace(/\.html$/i, '').replace(/\/+$/, '');
    if (!clean) return indexHtml;

    const exact = tryWebFiles(clean, `${clean}/index.html`, `${clean}.html`);
    if (exact) return exact;

    const segs = clean.split('/').filter(Boolean);
    if (segs.length >= 2) {
      const dyn = [...segs.slice(0, -1), '_'].join('/');
      const fallback = tryWebFiles(`${dyn}.html`, `${dyn}/index.html`, dyn);
      if (fallback) return fallback;
    }

    return indexHtml;
  };

  // Everything else -> root index.html
  app.use((req, res) => {
    res.sendFile(resolveWebFallback(req.path));
  });

  console.log(`[server] serving web frontend from ${webDir}`);
} else {
  console.warn('[server] web frontend not found at', webDir, '- run \`pnpm build\` first');
}

const server = createServer(app);

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', `http://localhost:${PORT}`);
  const workspaceId = url.searchParams.get('workspaceId');

  if (!workspaceId) {
    ws.close(4001, 'workspaceId required');
    return;
  }

  const token = url.searchParams.get('token');
  if (!verifyToken(token)) {
    ws.close(4003, 'Unauthorized');
    return;
  }

  handleConnection(ws, workspaceId);
});

server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url || '/', `http://localhost:${PORT}`);

  if (pathname === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
    return;
  }

  socket.destroy();
});

const HOST = process.env.HOST || '0.0.0.0';

// 端口被占等监听失败必须立即退出：uncaughtException 处理器只记日志不退出，会让 watch 进程静默挂着
server.on('error', (err: NodeJS.ErrnoException) => {
  console.error(`[server] failed to listen on ${HOST}:${PORT}: ${err.code ?? ''} ${err.message}`);
  process.exit(1);
});
server.listen(PORT, HOST, () => {
  console.log(`[server] listening on http://${HOST}:${PORT}`);
  console.log(`[server] websocket on ws://${HOST}:${PORT}/ws?workspaceId=...`);
  ensureBuiltInAgentTemplates();
  rebuildMiniAppIndex();
  ensureAgentsConfigs();
  startServicesWatcher();
  registerAllMiniAppTools();
  void startServerLoadPluginScripts();
  triggerService.start().catch((err) => {
    console.error('[trigger] failed to start:', err);
  });
});
