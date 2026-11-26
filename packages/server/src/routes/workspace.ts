import { Router } from 'express';
import { join } from 'node:path';
import { exec } from 'child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { v4 as uuid } from 'uuid';
import type { Workspace } from '@flow-spaces/shared';
import { listWorkspaces, getWorkspace, createWorkspace, updateWorkspace, deleteWorkspace } from '../storage/workspace-store.js';
import { getDataDir, ensureDir } from '../storage/json-store.js';
import * as agentService from '../services/agent.js';
import { ensureGeneralChannel } from '../services/channel.js';
import { gitClone } from '../adapters/git.js';

const AGENTSPACE_DIRS = ['skills', 'agents', 'workflow-runs', 'cache', 'logs', 'cache/locks'];
const AGENTSPACE_FILES: Record<string, string> = {
  'claude.md': '# Agent Spaces Knowledge Base\n',
};

function initAgentspace(agentspaceDir: string): void {
  ensureDir(agentspaceDir);
  for (const sub of AGENTSPACE_DIRS) {
    ensureDir(join(agentspaceDir, sub));
  }
  for (const [file, content] of Object.entries(AGENTSPACE_FILES)) {
    const fullPath = join(agentspaceDir, file);
    if (!existsSync(fullPath)) {
      writeFileSync(fullPath, content, 'utf-8');
    }
  }
}

const router = Router();

router.get('/', (_req, res) => {
  res.json(listWorkspaces());
});

router.post('/clone', async (req, res) => {
  const { url, targetDir } = req.body as { url?: string; targetDir?: string };
  if (!url || !targetDir) {
    res.status(400).json({ error: 'url and targetDir are required' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendSSE = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const cloneDir = await gitClone(targetDir, url, (progress) => {
      sendSSE(progress);
    });
    sendSSE({ phase: 'done', progress: 100, cloneDir });
  } catch (err: any) {
    sendSSE({ phase: 'error', progress: 0, error: err.message });
  } finally {
    res.end();
  }
});

router.post('/', (req, res) => {
  const { name, boundDirs } = req.body;
  if (!name || !boundDirs?.length) {
    res.status(400).json({ error: 'name and boundDirs are required' });
    return;
  }
  const id = uuid();
  const now = new Date().toISOString();
  const agentspaceDir = join(boundDirs[0], '.agentspace');
  const ws: Workspace = {
    id,
    name,
    boundDirs,
    agentspaceDir,
    createdAt: now,
    updatedAt: now,
    activeChannels: [],
    activeIssues: [],
  };
  ensureDir(agentspaceDir);
  initAgentspace(agentspaceDir);
  createWorkspace(ws);
  ensureGeneralChannel(id);
  res.status(201).json(ws);
});

router.get('/:id', (req, res) => {
  const ws = getWorkspace(req.params.id);
  if (!ws) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }
  res.json(ws);
});

router.get('/:id/agent-templates', (_req, res) => {
  res.json(agentService.listTemplates());
});

router.put('/:id', (req, res) => {
  const ws = getWorkspace(req.params.id);
  if (!ws) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }
  const data = req.body;
  for (const key of ['name', 'boundDirs', 'autoProcessIssues', 'editorSettings', 'notificationSettings', 'hooksEnabled', 'miniAppIds'] as const) {
    if (Object.hasOwn(data, key)) (ws as any)[key] = data[key];
  }
  ws.updatedAt = new Date().toISOString();
  updateWorkspace(ws);
  res.json(ws);
});

router.delete('/:id', (req, res) => {
  if (!getWorkspace(req.params.id)) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }
  deleteWorkspace(req.params.id);
  res.status(204).end();
});

router.post('/:id/reveal', (req, res) => {
  const ws = getWorkspace(req.params.id);
  if (!ws) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }

  const target = req.query.target as string;
  let dir: string;
  if (target === 'data') {
    dir = join(getDataDir(), 'workspaces', ws.id);
  } else {
    dir = ws.boundDirs?.[0];
    if (!dir) {
      res.status(400).json({ error: 'Workspace has no bound directory' });
      return;
    }
  }

  console.log('[reveal:workspace] workspace:', ws.id, 'dir:', dir);

  const cmd = process.platform === 'darwin'
    ? `open "${dir}"`
    : process.platform === 'win32'
      ? `explorer "${dir}"`
      : `xdg-open "${dir}"`;

  console.log('[reveal:workspace] platform:', process.platform, 'cmd:', cmd);

  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.error('[reveal:workspace] failed:', err.message, 'stderr:', stderr);
      res.status(500).json({ error: 'Failed to reveal directory', detail: err.message });
      return;
    }
    if (stdout) console.log('[reveal:workspace] stdout:', stdout);
    if (stderr) console.log('[reveal:workspace] stderr:', stderr);
    res.json({ success: true, path: dir });
  });
});

export default router;
