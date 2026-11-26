import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { getDataDir } from '../storage/json-store.js';

const AUTH_FILE = () => join(getDataDir(), 'auth.json');

export function getSecret(): string {
  try {
    const raw = readFileSync(AUTH_FILE(), 'utf-8');
    const data = JSON.parse(raw);
    return typeof data.secret === 'string' ? data.secret : '';
  } catch {
    return '';
  }
}

export function setSecret(secret: string): void {
  const file = AUTH_FILE();
  const dir = join(file, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(file, JSON.stringify({ secret }, null, 2), 'utf-8');
}

/** 登录密码：env FLOW_SPACES_PASSWORD 优先，未设置则回落 auth.json 的 secret */
export function getPassword(): string {
  return process.env.FLOW_SPACES_PASSWORD || getSecret();
}

/** API/MCP Bearer token：env FLOW_SPACES_TOKEN 优先，未设置则回落 auth.json 的 secret */
export function getAccessToken(): string {
  return process.env.FLOW_SPACES_TOKEN || getSecret();
}
