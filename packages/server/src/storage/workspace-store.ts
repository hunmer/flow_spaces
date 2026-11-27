import { join } from 'node:path';
import type { Workspace } from '@flow-spaces/shared';
import { getDataDir, readJsonFile } from './json-store.js';

function workspacesIndex() {
  return join(getDataDir(), 'workspaces', 'index.json');
}

function workspaceDir(id: string) {
  return join(getDataDir(), 'workspaces', id);
}

export function listWorkspaces(): Workspace[] {
  return readJsonFile<Workspace[]>(workspacesIndex()) || [];
}

export function getWorkspace(id: string): Workspace | null {
  return readJsonFile<Workspace>(join(workspaceDir(id), 'workspace.json'));
}
