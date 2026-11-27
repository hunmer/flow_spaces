'use client';

import {
  ensureStoreSourcesLoaded,
  getEffectiveStoreSources,
  matchStoreCategory,
  rememberActiveSourceBase,
  resolveActiveSourceBase,
  storeCategoryPathPrefix,
  type StoreCategory,
} from './store-sources';

const STORAGE_KEY = 'flow-spaces:store-api-base';

const DEFAULT_BASE =
  'https://gh-proxy.org/https://github.com/hunmer/flow_spaces/raw/refs/heads/master/packages/templates/';

// 旧版本（agent_spaces 时代）会把同源代理地址 http://localhost:PORT/agents-store 存进
// store base；该形态一律视为陈旧值：读取时自动清除，回落默认路由。
const LEGACY_LOCAL_BASE_SUFFIX = '/agents-store';

/** 读取自定义 base；旧同源 /agents-store 形态自动清除并返回 null */
function getValidCustomBase(): string | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  if (stored.replace(/\/+$/, '').endsWith(LEGACY_LOCAL_BASE_SUFFIX)) {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
  return stored;
}

export function getStoreApiBase(): string {
  if (typeof window === 'undefined') return '';
  return getValidCustomBase() || DEFAULT_BASE;
}

export function setStoreApiBase(url: string) {
  if (typeof window === 'undefined') return;
  if (url) localStorage.setItem(STORAGE_KEY, url);
  else localStorage.removeItem(STORAGE_KEY);
}

/**
 * 商店资源地址解析：
 * - plugins/ / workflows/ / mini-app/ 前缀 → 走 store-sources 配置
 *   （默认 GitHub 独立仓库 + 本地端口两个源，用户可在设置中自定义；见 lib/store-sources.ts）
 * - 其余（agents / mcps / skills 等主仓库 templates 内容）→ 旧自定义镜像 base
 *   优先，默认主仓库 raw。
 */
export function resolveStoreUrl(path: string): string {
  const cleanPath = path.replace(/^\/+/, '');
  if (typeof window === 'undefined') return `/agents-store/${cleanPath}`;

  const category = matchStoreCategory(cleanPath);
  if (category) {
    const base = resolveActiveSourceBase(category);
    const suffix = cleanPath.slice(storeCategoryPathPrefix(category).length);
    return `${base}/${suffix}`;
  }

  const customBase = getValidCustomBase();
  if (!customBase) return DEFAULT_BASE + cleanPath;
  // 自定义镜像 base：保持与 packages/templates 一致的相对结构
  return `${customBase.replace(/\/+$/, '')}/${cleanPath}`;
}

/** 类别索引的源列表（去 base 尾斜杠，供逐个试拉）。 */
function categorySourceBases(category: StoreCategory): string[] {
  const sources = getEffectiveStoreSources()[category];
  if (sources.length === 0) return [resolveActiveSourceBase(category)];
  return sources.map((source) => source.url.trim().replace(/\/+$/, ''));
}

/**
 * 拉取商店索引：三类商店内容按源列表顺序故障转移（第一个成功者胜出并
 * 记为该类当前源）；其余内容单地址直取。
 */
export async function fetchStoreIndex<T>(path: string, { rememberSource = true }: { rememberSource?: boolean } = {}): Promise<T[]> {
  const cleanPath = path.replace(/^\/+/, '');
  const category = typeof window === 'undefined' ? null : matchStoreCategory(cleanPath);

  if (category) {
    await ensureStoreSourcesLoaded();
    const suffix = cleanPath.slice(storeCategoryPathPrefix(category).length);
    const bases = categorySourceBases(category);
    let lastError: unknown = null;
    for (const base of bases) {
      const url = `${base}/${suffix}`;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
        if (rememberSource) rememberActiveSourceBase(category, base);
        return (await res.json()) as T[];
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(`fetch store index failed: ${path}`);
  }

  const url = resolveStoreUrl(cleanPath);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
  return res.json();
}

// ---- 从 GitHub 仓库地址安装 mini-app ----
// 约定：仓库根放构建产物 app.json（元数据 + 文件级 md5 清单），server 按清单增量安装，无需 zip。

/** 解析 GitHub 仓库地址（支持 github.com/owner/repo 及 /tree/branch 等变体） */
export function parseGithubRepoUrl(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim().replace(/\/+$/, '');
  const match = trimmed.match(/^https?:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:\/.*)?$/i)
    ?? trimmed.match(/^([\w.-]+)\/([\w.-]+)$/); // 简写 owner/repo
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

/** mini-app 独立仓库的 raw 根地址（走默认代理）；清单内 path 相对该根 */
export function githubRepoRawUrl(owner: string, repo: string, branch = 'main'): string {
  return `https://gh-proxy.org/https://github.com/${owner}/${repo}/raw/refs/heads/${branch.split('/').map(encodeURIComponent).join('/')}`;
}

/** mini-app 独立仓库的 app.json（安装清单）地址 */
export function githubAppManifestUrl(owner: string, repo: string): string {
  return `${githubRepoRawUrl(owner, repo)}/app.json`;
}
