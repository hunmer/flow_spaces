import { fetchWithAuth } from './auth';

/**
 * 账号 REST 封装（T2）。
 * backend 的 account 模块并行开发中，暂不依赖 packages/sdk，
 * 直接用 fetchWithAuth 走 REST（base 拼接与 401 跳登录由其统一处理）。
 */

export interface AccountProfile {
  name: string;
  avatarUrl: string | null;
}

function parseProfile(data: unknown): AccountProfile {
  const value = (data ?? {}) as { name?: unknown; avatarUrl?: unknown };
  return {
    name: typeof value.name === 'string' ? value.name : '',
    avatarUrl: typeof value.avatarUrl === 'string' ? value.avatarUrl : null,
  };
}

function parseUrl(data: unknown): string {
  const value = (data ?? {}) as { url?: unknown };
  return typeof value.url === 'string' ? value.url : '';
}

/** GET /api/account/profile → { name, avatarUrl } */
export async function getProfile(): Promise<AccountProfile> {
  const res = await fetchWithAuth('/api/account/profile');
  if (!res.ok) throw new Error(`getProfile failed: ${res.status}`);
  return parseProfile(await res.json());
}

/** PUT /api/account/profile（更新用户名）→ { name, avatarUrl } */
export async function updateProfile(name: string): Promise<AccountProfile> {
  const res = await fetchWithAuth('/api/account/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`updateProfile failed: ${res.status}`);
  return parseProfile(await res.json());
}

/** POST /api/account/avatar（FormData 字段名 file）→ { url } */
export async function uploadAvatar(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetchWithAuth('/api/account/avatar', {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(`uploadAvatar failed: ${res.status}`);
  return { url: parseUrl(await res.json()) };
}

/** DELETE /api/account/avatar */
export async function removeAvatar(): Promise<void> {
  const res = await fetchWithAuth('/api/account/avatar', { method: 'DELETE' });
  if (!res.ok) throw new Error(`removeAvatar failed: ${res.status}`);
}
