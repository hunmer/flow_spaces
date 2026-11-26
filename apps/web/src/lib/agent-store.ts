'use client';

const STORAGE_KEY = 'flow-spaces:store-api-base';

const DEFAULT_BASE =
  'https://gh-proxy.org/https://github.com/hunmer/flow_spaces/raw/refs/heads/master/packages/templates/';

// plugins / workflows / mini-app 内容已从主仓库 templates 拆分到独立商店仓库：
// 索引里的 path / iconUrl / zipUrl 均带分类前缀，路由时剥掉前缀拼到对应仓库根。
const REPO_ROUTES: Array<[prefix: string, repoBase: string]> = [
  ['plugins/', 'https://gh-proxy.org/https://github.com/hunmer/flow-spaces-plugins/raw/refs/heads/main/'],
  ['workflows/', 'https://gh-proxy.org/https://github.com/hunmer/flow-spaces-workflows/raw/refs/heads/main/'],
  ['mini-app/', 'https://gh-proxy.org/https://github.com/hunmer/flow-spaces-mini-apps/raw/refs/heads/main/'],
];

// 旧版本（agent_spaces 时代）会把同源代理地址 http://localhost:PORT/agents-store 存进
// store base；拆仓后本地 /agents-store 已不含 workflows/plugins/mini-app（需仓库路由），
// 该形态一律视为陈旧值：读取时自动清除，回落默认路由。
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

export function resolveStoreUrl(path: string): string {
  const cleanPath = path.replace(/^\/+/, '');
  if (typeof window === 'undefined') return `/agents-store/${cleanPath}`;

  const customBase = getValidCustomBase();
  if (!customBase) {
    // 默认 GitHub 商店：三类拆分内容按前缀路由到独立仓库
    const route = REPO_ROUTES.find(([prefix]) => cleanPath.startsWith(prefix));
    if (route) return route[1] + cleanPath.slice(route[0].length);
    // agents / mcps / skills 等留在主仓库 packages/templates
    return DEFAULT_BASE + cleanPath;
  }

  // 自定义镜像 base：保持与 packages/templates 一致的相对结构
  return `${customBase.replace(/\/+$/, '')}/${cleanPath}`;
}

export async function fetchStoreIndex<T>(path: string): Promise<T[]> {
  const url = resolveStoreUrl(path);
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
export function githubRepoRawUrl(owner: string, repo: string): string {
  return `https://gh-proxy.org/https://github.com/${owner}/${repo}/raw/refs/heads/main`;
}

/** mini-app 独立仓库的 app.json（安装清单）地址 */
export function githubAppManifestUrl(owner: string, repo: string): string {
  return `${githubRepoRawUrl(owner, repo)}/app.json`;
}
