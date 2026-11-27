import { existsSync, mkdirSync, writeFileSync, createWriteStream, rmSync, readdirSync, readFileSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import yauzl from 'yauzl';
import { v4 as uuid } from 'uuid';
import * as store from '../storage/mini-app-store.js';
import type { MiniAppProject } from '../storage/mini-app-store.js';
import type { FileNode, Workspace } from '@flow-spaces/shared';
import { unloadServices } from './mini-app-services.js';
import { executeDb as dbExecuteDb, executeDbTransaction as dbExecuteDbTransaction, closeProjectDbs } from '../storage/mini-app-db.js';
import * as fileService from './file.js';

export { store };
export type { MiniAppProject };

// ---- CRUD ----

/** 对外视图：项目 manifest + 集中记录的最后启动时间。 */
export interface MiniAppProjectView extends MiniAppProject {
  /** 最后启动时间（预览页打开时记录，集中存于 mini-apps/launch-times.json）。 */
  lastLaunchAt?: string;
}

export function listProjects(): MiniAppProjectView[] {
  return store.listProjects().map((p) => ({ ...p, lastLaunchAt: store.getLaunchTime(p.id) }));
}

export function getProject(projectId: string): MiniAppProjectView {
  const project = store.getProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  return { ...project, lastLaunchAt: store.getLaunchTime(projectId) };
}

/** 记录一次启动（预览页打开时调用），返回记录的时间。 */
export function markLaunched(projectId: string): string {
  getProject(projectId); // 校验项目存在，不存在时抛错
  return store.markLaunched(projectId);
}

export function hasMiniAppAgentFilesPermission(project: MiniAppProject | null | undefined): boolean {
  return Array.isArray(project?.agentPermissions) && project.agentPermissions.includes('Files');
}

export type AgentFilesScope = 'preview' | 'editor';

function normalizeAgentFilesScope(scope?: string): AgentFilesScope {
  return scope === 'editor' ? 'editor' : 'preview';
}

export function getAgentFilesDir(projectId: string, scope?: string): string {
  return store.resolveDataPath(projectId, `agent_files/${normalizeAgentFilesScope(scope)}`);
}

export function getAgentFilesWorkspace(projectId: string, scope?: string): Workspace {
  const project = getProject(projectId);
  if (!hasMiniAppAgentFilesPermission(project)) throw new Error('Mini-app agent file permission is not enabled');
  const normalizedScope = normalizeAgentFilesScope(scope);
  const root = getAgentFilesDir(projectId, normalizedScope);
  mkdirSync(root, { recursive: true });
  return {
    id: `mini-app:${projectId}:agent_files:${normalizedScope}`,
    name: `${projectId} agent files (${normalizedScope})`,
    boundDirs: [root],
    agentspaceDir: root,
    createdAt: '',
    updatedAt: '',
  };
}

export async function getAgentFilesTree(projectId: string, path = '', depth = 1, scope?: string): Promise<FileNode[]> {
  getProject(projectId);
  return fileService.readTree(getAgentFilesWorkspace(projectId, scope), path, depth);
}

export async function readAgentFile(projectId: string, path: string, scope?: string): Promise<{ content: string; encoding: string } | null> {
  getProject(projectId);
  return fileService.readFileContent(getAgentFilesWorkspace(projectId, scope), path);
}

export function getAgentFileAbsolutePath(projectId: string, path = '', scope?: string): string {
  getProject(projectId);
  const absolutePath = fileService.resolvePath(getAgentFilesWorkspace(projectId, scope), path);
  if (!absolutePath) throw new Error('Invalid agent file path');
  return absolutePath;
}

export async function writeAgentFile(projectId: string, path: string, content: string, scope?: string): Promise<boolean> {
  getProject(projectId);
  return fileService.writeFileContent(getAgentFilesWorkspace(projectId, scope), path, content);
}

export async function deleteAgentFile(projectId: string, path: string, scope?: string): Promise<boolean> {
  getProject(projectId);
  return fileService.deletePath(getAgentFilesWorkspace(projectId, scope), path);
}

export async function renameAgentFile(projectId: string, from: string, to: string, scope?: string): Promise<boolean> {
  getProject(projectId);
  return fileService.renamePath(getAgentFilesWorkspace(projectId, scope), from, to);
}

export async function linkAgentFolder(projectId: string, sourcePath: string, scope?: string): Promise<string | null> {
  getProject(projectId);
  return fileService.linkFolder(getAgentFilesWorkspace(projectId, scope), sourcePath);
}

export async function uploadAgentFiles(projectId: string, targetDir: string, files: Array<{ name: string; buffer: Buffer }>, scope?: string): Promise<Array<{ path: string; size: number }>> {
  getProject(projectId);
  const workspace = getAgentFilesWorkspace(projectId, scope);
  const written: Array<{ path: string; size: number }> = [];
  for (const file of files) {
    const safeName = file.name.replace(/[<>:"\\|?*\x00-\x1F]/g, '_') || 'file';
    const relPath = [targetDir.replace(/^\/+|\/+$/g, ''), safeName].filter(Boolean).join('/');
    const ok = await fileService.writeFileBinary(workspace, relPath, file.buffer);
    if (!ok) throw new Error(`Failed to upload ${safeName}`);
    written.push({ path: relPath, size: file.buffer.byteLength });
  }
  return written;
}

export function createProject(input: {
  name: string;
  description?: string;
  type: 'react' | 'html';
  tags?: string[];
}): MiniAppProject {
  const mainFile = input.type === 'react' ? 'index.jsx' : 'index.html';
  const claudeMd = `# ${input.name}

> This file is auto-generated. Keep it up-to-date as the project evolves.

## Project Overview

<!-- Describe what this project does, its purpose and main features. -->

## File Structure

<!-- Keep this in sync with the actual files. Example:
- \`index.jsx\` — Entry point, main layout
- \`components/Header.jsx\` — Header component
- \`hooks/useData.js\` — Data fetching hook
- \`utils/api.js\` — API helpers
-->

## Key Design Decisions

<!-- Record important decisions, patterns, and constraints here. -->

## Dependencies

<!-- External resources, plugins, or API integrations used. -->

## Notes

<!-- Anything future-you or the Agent should know before editing. -->
`;

  const defaultFiles: Record<string, string> = input.type === 'react'
    ? {
        'index.jsx': `const { Button, Card, CardContent } = window.FlowSpacesUI;

function App() {
  return (
    <Card>
      <CardContent>
        <Button>Hello World</Button>
      </CardContent>
    </Card>
  );
}

export default App;
`,
        'CLAUDE.md': claudeMd,
      }
    : {
        'index.html': `<!DOCTYPE html>
<html>
<head><title>${input.name}</title></head>
<body>
  <h1>Hello World</h1>
  <script>
    console.log('loaded');
  </script>
</body>
</html>`,
        'CLAUDE.md': claudeMd,
      };

  return store.createProject({
    ...input,
    mainFile,
    files: defaultFiles,
  });
}

export function updateProject(
  projectId: string,
  updates: Partial<Pick<MiniAppProject, 'name' | 'description' | 'tags' | 'enabledPlugins' | 'pluginConfigSchemes' | 'agentConfigId' | 'agentChatPlacement' | 'mainFile' | 'icon' | 'avatarUrl' | 'backgroundUrl' | 'devices'>>,
): MiniAppProject {
  return store.updateProject(projectId, updates);
}

export function deleteProject(projectId: string): void {
  closeProjectDbs(projectId);
  store.deleteProject(projectId);
  unloadServices(projectId);
}

// ---- Files ----

export function getFileTree(projectId: string): string[] {
  return store.getFileTree(projectId);
}

export function getFileManifest(projectId: string) {
  return store.getFileManifest(projectId);
}

export function readFile(projectId: string, filePath: string): string {
  const content = store.readFile(projectId, filePath);
  if (content === null) throw new Error(`File not found: ${filePath}`);
  return content;
}

export function writeFile(projectId: string, filePath: string, content: string): void {
  store.writeFile(projectId, filePath, content);
}

export function writeBinaryFile(projectId: string, filePath: string, buffer: Buffer): number {
  return store.writeBinaryFile(projectId, filePath, buffer);
}

export function deleteFile(projectId: string, filePath: string): void {
  store.deleteFile(projectId, filePath);
}

export function renameFile(projectId: string, fromPath: string, toPath: string): void {
  store.renameFile(projectId, fromPath, toPath);
}

export function createFolder(projectId: string, dirPath: string): void {
  store.createFolder(projectId, dirPath);
}

export function readConfig(projectId: string, filePath: string): unknown | null {
  return store.readConfig(projectId, filePath);
}

export function writeConfig(projectId: string, filePath: string, value: unknown): void {
  store.writeConfig(projectId, filePath, value);
}

export function listConfigs(projectId: string): Record<string, unknown> {
  return store.listConfigs(projectId);
}

export function writeDataFile(projectId: string, filePath: string, content: Buffer | string): number {
  return store.writeDataFile(projectId, filePath, content);
}

export function readDataFile(projectId: string, filePath: string): Buffer | null {
  return store.readDataFile(projectId, filePath);
}

export function resolveDataPath(projectId: string, filePath: string): string {
  return store.resolveDataPath(projectId, filePath);
}

// 删除 data 目录下的文件（幂等；返回是否实际删除）。
export function deleteDataFile(projectId: string, filePath: string): boolean {
  return store.deleteDataFile(projectId, filePath);
}

/** 解析并校验项目 src 目录下的文件绝对路径（防穿越）。 */
export function resolveSrcPath(projectId: string, filePath: string): string {
  return store.resolveSrcPath(projectId, filePath);
}

// ---- DB (SQLite via better-sqlite3) ----
export function executeDb(
  projectId: string,
  dbName: string,
  mode: 'all' | 'get' | 'run' | 'exec',
  sql: string,
  params?: unknown[] | Record<string, unknown>,
): unknown {
  const result = dbExecuteDb(projectId, dbName, mode, sql, params);
  return result;
}

export function executeDbTransaction(
  projectId: string,
  dbName: string,
  statements: { sql: string; params?: unknown[] | Record<string, unknown> }[],
): void {
  dbExecuteDbTransaction(projectId, dbName, statements);
}

// ---- ZIP Export ----

export async function exportZip(projectId: string): Promise<Buffer> {
  const project = store.getProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const archiver = (await import('archiver')).default;
  const archive = archiver('zip', { zlib: { level: 6 } });
  const chunks: Buffer[] = [];

  archive.on('data', (chunk: Buffer) => chunks.push(chunk));

  // Add manifest (strip internal fields)
  const { id, createdAt, ...manifest } = project;
  archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

  // Add source files
  for (const filePath of store.getFileTree(projectId)) {
    const content = store.readFile(projectId, filePath);
    if (content !== null) {
      archive.append(content, { name: `src/${filePath}` });
    }
  }

  // Add icon file if exists
  if (manifest.icon) {
    const iconPath = join(store.getProjectDir(projectId), manifest.icon);
    if (existsSync(iconPath)) {
      archive.file(iconPath, { name: manifest.icon });
    }
  }

  // Add avatar file if exists
  if (manifest.avatarUrl) {
    const avatarPath = join(store.getProjectDir(projectId), manifest.avatarUrl);
    if (existsSync(avatarPath)) {
      archive.file(avatarPath, { name: manifest.avatarUrl });
    }
  }

  await archive.finalize();
  return Buffer.concat(chunks);
}

// ---- ZIP Import ----

export async function importZip(
  zipBuffer: Buffer,
  manifest: { name?: string; type?: 'react' | 'html'; description?: string; id?: string; storeUrl?: string; storeChecksum?: string },
): Promise<MiniAppProject> {
  const extractDir = join(tmpdir(), `wui-import-${uuid()}`);
  mkdirSync(extractDir, { recursive: true });

  try {
    const zipPath = join(extractDir, 'upload.zip');
    writeFileSync(zipPath, zipBuffer);

    // Extract using yauzl (cross-platform, no PowerShell)
    await extractZip(zipPath, join(extractDir, 'content'));

    // Find manifest
    const contentDir = join(extractDir, 'content');
    const manifestFile = findFile(contentDir, 'manifest.json') ?? findFile(contentDir, 'plugin.json');

    let projectManifest: Record<string, any> = {};
    if (manifestFile) {
      try {
        projectManifest = JSON.parse(readFileSync(manifestFile, 'utf-8'));
      } catch { /* ignore invalid manifest */ }
    }

    // Determine type
    const type =
      manifest.type ??
      projectManifest.type ??
      (findFile(contentDir, 'index.jsx') || findFile(contentDir, 'index.tsx') ? 'react' : 'html');
    const mainFile = type === 'react' ? 'index.jsx' : 'index.html';
    const name = manifest.name ?? projectManifest.name ?? 'Imported Project';

    // Source directory: prefer src/ subdirectory
    const srcBase = existsSync(join(contentDir, 'src')) ? join(contentDir, 'src') : contentDir;

    const project = store.importFromDir(srcBase, {
      name,
      type: type as 'react' | 'html',
      description: manifest.description ?? projectManifest.description,
      mainFile,
      tags: projectManifest.tags,
      enabledPlugins: projectManifest.enabledPlugins,
      enabledWorkflows: projectManifest.enabledWorkflows,
      enableAgents: projectManifest.enableAgents,
      agents: projectManifest.agents,
      agentPermissions: projectManifest.agentPermissions,
      agentChatPlacement: projectManifest.agentChatPlacement,
      devices: projectManifest.devices,
      icon: projectManifest.icon,
      avatarUrl: projectManifest.avatarUrl,
      // 商店导入：传稳定 id / storeUrl / storeChecksum，使服务端按 id 关联已安装项（新建或更新）
      id: manifest.id,
      storeUrl: manifest.storeUrl,
      storeChecksum: manifest.storeChecksum,
    });

    // Copy icon file if present
    if (projectManifest.icon && typeof projectManifest.icon === 'string') {
      const iconSrc = join(contentDir, projectManifest.icon);
      if (existsSync(iconSrc)) {
        copyFileSync(iconSrc, join(store.getProjectDir(project.id), projectManifest.icon));
      }
    }

    // Copy avatar file if present
    if (projectManifest.avatarUrl && typeof projectManifest.avatarUrl === 'string') {
      const avatarSrc = join(contentDir, projectManifest.avatarUrl);
      if (existsSync(avatarSrc)) {
        copyFileSync(avatarSrc, join(store.getProjectDir(project.id), projectManifest.avatarUrl));
      }
    }

    return project;
  } finally {
    try { rmSync(extractDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

// ---- Incremental Store Install ----
// 不下载整包 zip：按文件级 md5 清单对比本地文件，仅下载缺失/有变化的文件。
// 幂等：中断后重新安装会跳过已一致的文件，继续补齐剩余部分。

export interface StoreFileEntry {
  path: string;
  md5: string;
}

function isSafeRelPath(p: string): boolean {
  if (!p || typeof p !== 'string') return false;
  if (p.includes('..') || p.startsWith('/') || p.startsWith('\\') || /^[a-zA-Z]:/.test(p)) return false;
  if (p.split('/').some((seg) => seg === '' || seg === '.')) return false;
  return true;
}

async function fetchStoreBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function md5Of(buf: Buffer): string {
  return createHash('md5').update(buf).digest('hex');
}

function md5OfFile(filePath: string): string | null {
  try {
    return createHash('md5').update(readFileSync(filePath)).digest('hex');
  } catch {
    return null;
  }
}

export async function installFromStore(input: {
  id: string;
  /** app 源根的 raw base，如 .../flow-spaces-mini-apps/raw/refs/heads/main/tts */
  baseUrl: string;
  manifest?: {
    name?: string;
    type?: 'react' | 'html';
    description?: string;
    version?: string;
    tags?: string[];
    icon?: string;
    /** 商店清单（index.json / app.json 顶层）可直接携带，免去再拉磁盘 manifest */
    enabledPlugins?: string[];
    /** 依赖的工作流声明（模板 id/name），预览页核查缺失用 */
    enabledWorkflows?: string[];
    mainFile?: string;
  };
  files: StoreFileEntry[];
  storeUrl?: string;
  storeChecksum?: string;
}): Promise<{ project: MiniAppProject; downloaded: number; skipped: number }> {
  const appId = input.id?.trim();
  if (!appId) throw new Error('installFromStore: id is required');

  const files = (input.files ?? []).filter((f) => f && isSafeRelPath(f.path) && typeof f.md5 === 'string' && f.md5.length === 32);
  if (!files.length) throw new Error('installFromStore: empty or invalid file list');
  const base = input.baseUrl?.replace(/\/+$/, '');
  if (!base) throw new Error('installFromStore: baseUrl is required');

  // 远端 manifest.json（清单内含）兜底合并——enabledPlugins/enableAgents 等字段不进商店索引，只存在 manifest 里；
  // input.manifest 已带（app.json 顶层）时直接采用
  let remoteManifest: Record<string, any> = {};
  const manifestEntry = files.find((f) => f.path === 'manifest.json');
  if (manifestEntry && input.manifest?.enabledPlugins === undefined && input.manifest?.mainFile === undefined) {
    try {
      remoteManifest = JSON.parse((await fetchStoreBuffer(`${base}/manifest.json`)).toString('utf-8'));
    } catch { /* 装不上再报，先继续 */ }
  }

  const manifest = input.manifest ?? {};
  const name = manifest.name ?? remoteManifest.name ?? appId;
  const type = (manifest.type ?? remoteManifest.type ?? 'react') as 'react' | 'html';
  const mainFile = manifest.mainFile ?? remoteManifest.mainFile ?? (type === 'react' ? 'index.jsx' : 'index.html');

  // upsert 元数据（不动 src/），随后逐文件增量写入 —— 失败抛错，重装时已一致文件自动跳过
  const project = store.upsertStoreProject({
    id: appId,
    name,
    type,
    description: manifest.description ?? remoteManifest.description,
    version: manifest.version ?? remoteManifest.version,
    tags: manifest.tags ?? remoteManifest.tags,
    enabledPlugins: manifest.enabledPlugins ?? remoteManifest.enabledPlugins,
    enabledWorkflows: manifest.enabledWorkflows ?? remoteManifest.enabledWorkflows,
    mainFile,
    icon: manifest.icon ?? remoteManifest.icon,
    storeUrl: input.storeUrl ?? base,
    storeChecksum: input.storeChecksum,
  });

  const projectRoot = store.getProjectDir(project.id);
  mkdirSync(projectRoot, { recursive: true });

  let downloaded = 0;
  let skipped = 0;
  for (const file of files) {
    const targetPath = join(projectRoot, file.path);
    if (md5OfFile(targetPath) === file.md5) {
      skipped++;
      continue;
    }
    const buf = await fetchStoreBuffer(`${base}/${file.path}`);
    if (md5Of(buf) !== file.md5) {
      throw new Error(`checksum mismatch after download: ${file.path}`);
    }
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, buf);
    downloaded++;
  }

  return { project, downloaded, skipped };
}

function findFile(dir: string, name: string): string | null {
  if (!existsSync(dir)) return null;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === name) return join(dir, name);
    if (entry.isDirectory()) {
      const found = findFile(join(dir, entry.name), name);
      if (found) return found;
    }
  }
  return null;
}

function extractZip(zipPath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    mkdirSync(destDir, { recursive: true });
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);
      if (!zipfile) return reject(new Error('Failed to open zip'));

      zipfile.readEntry();
      zipfile.on('entry', (entry: yauzl.Entry) => {
        // Validate path safety
        const entryPath = entry.fileName;
        if (entryPath.includes('..') || entryPath.startsWith('/') || /^[a-zA-Z]:/.test(entryPath)) {
          zipfile.readEntry();
          return;
        }

        const fullPath = join(destDir, entryPath);

        if (/\/$/.test(entryPath)) {
          // Directory entry
          mkdirSync(fullPath, { recursive: true });
          zipfile.readEntry();
        } else {
          // File entry
          mkdirSync(dirname(fullPath), { recursive: true });
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) return reject(err);
            const writeStream = createWriteStream(fullPath);
            writeStream.on('close', () => zipfile.readEntry());
            writeStream.on('error', reject);
            readStream.on('error', reject);
            readStream.pipe(writeStream);
          });
        }
      });

      zipfile.on('end', resolve);
      zipfile.on('error', reject);
    });
  });
}
