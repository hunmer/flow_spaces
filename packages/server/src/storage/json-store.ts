import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';

const DEFAULT_DATA_DIR = join(process.env.HOME || process.env.USERPROFILE || homedir(), '.flow-spaces-data');

export function getDataDir(): string {
  // resolve() 以防 FLOW_SPACES_DATA_DIR 是相对路径 —— 下游 createRequire 只接受绝对路径，
  // 相对路径会让插件 activate 直接抛 ERR_INVALID_ARG_VALUE，导致 workflow 节点全部加载失败。
  // 旧变量名 AGENT_SPACES_DATA_DIR 保留回退，避免外部脚本/旧 .env 突然指向默认目录
  return resolve(process.env.FLOW_SPACES_DATA_DIR || process.env.AGENT_SPACES_DATA_DIR || DEFAULT_DATA_DIR);
}

export function getPluginsDir(): string {
  return resolve(process.env.FLOW_SPACES_PLUGINS_DIR || join(getDataDir(), 'plugins'));
}

export function getWorkflowsDir(): string {
  return resolve(process.env.FLOW_SPACES_WORKFLOWS_DIR || join(getDataDir(), 'workflows'));
}

export function getMiniAppsDir(): string {
  return resolve(process.env.FLOW_SPACES_MINI_APPS_DIR || join(getDataDir(), 'mini-apps'));
}

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function readJsonFile<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf-8')) as T;
}

export function writeJsonFile<T>(filePath: string, data: T): void {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function deleteFile(filePath: string): void {
  if (existsSync(filePath)) unlinkSync(filePath);
}
