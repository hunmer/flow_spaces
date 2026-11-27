'use client';

/**
 * 商店源（store sources）配置：plugins / workflows / mini-app 三类商店的
 * 源地址管理。用户可在 设置 → 商店源 中增删改，持久化到后端
 * `GET/PUT /api/user/store-sources`（user-settings.json 的 storeSources 字段）。
 *
 * 默认每类两个源：GitHub（gh-proxy raw 拉独立商店仓库）+ 本地镜像端口
 * （商店仓库 `npm run serve` 启动 http-server：plugins 8091 / workflows
 * 8092 / mini-app 8093）。未保存过配置（sources = null）时回落默认。
 */

import { fetchWithAuth } from './auth';

/** 三类商店类别（与索引 path 前缀一致）。 */
export const STORE_CATEGORIES = ['plugins', 'workflows', 'mini-app'] as const;
export type StoreCategory = (typeof STORE_CATEGORIES)[number];

export interface StoreSource {
  id: string;
  name: string;
  url: string;
  /** 该类别的默认源（拉取时优先尝试）；归一后每类非空列表恰有一个默认。 */
  default?: boolean;
}

export type StoreSourcesConfig = Record<StoreCategory, StoreSource[]>;

/** 类别 → 商店索引 path 前缀（与 server 端、独立仓库结构一致）。 */
const CATEGORY_PATH_PREFIX: Record<StoreCategory, string> = {
  plugins: 'plugins/',
  workflows: 'workflows/',
  'mini-app': 'mini-app/',
};

/** 默认 GitHub 源：gh-proxy 拉独立商店仓库 raw。 */
const GITHUB_REPO_BASE: Record<StoreCategory, string> = {
  plugins: 'https://gh-proxy.org/https://github.com/hunmer/flow-spaces-plugins/raw/refs/heads/main/',
  workflows: 'https://gh-proxy.org/https://github.com/hunmer/flow-spaces-workflows/raw/refs/heads/main/',
  'mini-app': 'https://gh-proxy.org/https://github.com/hunmer/flow-spaces-mini-apps/raw/refs/heads/main/',
};

/** 类别展示顺序对应常量（设置面板 / 校验共用）。 */
export function storeCategoryPathPrefix(category: StoreCategory): string {
  return CATEGORY_PATH_PREFIX[category];
}

/** 依据（已去头斜杠的）商店 path 前缀判定类别；非三类内容返回 null。 */
export function matchStoreCategory(cleanPath: string): StoreCategory | null {
  for (const category of STORE_CATEGORIES) {
    if (cleanPath.startsWith(CATEGORY_PATH_PREFIX[category])) return category;
  }
  return null;
}

function trimBase(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/** 各类别本地镜像源端口（商店仓库 package.json `serve` 脚本，http-server 监听 0.0.0.0）。 */
const LOCAL_SOURCE_PORT: Record<StoreCategory, string> = {
  plugins: '8091',
  workflows: '8092',
  'mini-app': '8093',
};

/** 本地镜像源地址：跟随当前访问主机名（局域网他机访问也指向对应主机）。 */
function localSourceBase(category: StoreCategory): string {
  const hostname =
    typeof window !== 'undefined' && window.location.hostname
      ? window.location.hostname
      : '127.0.0.1';
  return `http://${hostname}:${LOCAL_SOURCE_PORT[category]}`;
}

/** 默认源：GitHub（默认勾选）+ 本地镜像端口（商店仓库 `npm run serve`）。 */
export function defaultStoreSources(): StoreSourcesConfig {
  const build = (category: StoreCategory): StoreSource[] => [
    { id: `github-${category}`, name: 'GitHub', url: GITHUB_REPO_BASE[category], default: true },
    { id: `local-${category}`, name: 'Local', url: localSourceBase(category), default: false },
  ];
  return {
    plugins: build('plugins'),
    workflows: build('workflows'),
    'mini-app': build('mini-app'),
  };
}

// ---- 配置加载与缓存 ----
// resolveStoreUrl 是同步调用，无法每次都拉后端；首次 fetchStoreIndex 时
// 异步加载一次并缓存（失败回落默认，不再重试），保存设置时原地刷新。

let cachedConfig: StoreSourcesConfig | null = null;
let configLoaded = false;
let loadingPromise: Promise<void> | null = null;

/**
 * 归一默认源标记：多个 default=true 只保留第一个；非空列表全部未标记时
 * 补第一个为默认。保证每类非空列表恰有一个默认源（radio 语义）。
 */
function normalizeDefaultFlags(entries: StoreSource[]): StoreSource[] {
  if (entries.length === 0) return entries;
  let seenDefault = false;
  const marked = entries.map((entry) => {
    const isDefault = entry.default === true && !seenDefault;
    if (isDefault) seenDefault = true;
    return entry.default === isDefault ? entry : { ...entry, default: isDefault };
  });
  if (seenDefault) return marked;
  return [{ ...marked[0], default: true }, ...marked.slice(1)];
}

/** 排序：默认源排最前，其余保持原顺序（故障转移时默认源优先尝试）。 */
export function orderedSources(sources: StoreSource[]): StoreSource[] {
  const index = sources.findIndex((source) => source.default === true);
  if (index <= 0) return sources;
  return [sources[index], ...sources.slice(0, index), ...sources.slice(index + 1)];
}

/** 宽松归一：过滤非法条目，补齐缺失类别，归一默认源标记（后端已强校验，这里只做兜底）。 */
export function normalizeStoreSources(value: unknown): StoreSourcesConfig | null {
  if (value == null || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const result = {} as StoreSourcesConfig;
  let anyValid = false;
  for (const category of STORE_CATEGORIES) {
    const list = Array.isArray(raw[category]) ? (raw[category] as unknown[]) : [];
    const entries = list
      .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
      .map((item, index) => ({
        id: typeof item.id === 'string' && item.id ? item.id : `src-${category}-${index}`,
        name: typeof item.name === 'string' ? item.name : '',
        url: typeof item.url === 'string' ? item.url.trim() : '',
        default: item.default === true,
      }))
      .filter((item) => item.url !== '');
    result[category] = normalizeDefaultFlags(entries);
    if (result[category].length > 0) anyValid = true;
  }
  return anyValid ? result : null;
}

/** 启动后首次商店访问时加载后端配置（结果缓存；失败回落默认不重试）。 */
export function ensureStoreSourcesLoaded(): Promise<void> {
  if (configLoaded) return Promise.resolve();
  if (!loadingPromise) {
    loadingPromise = (async () => {
      try {
        const res = await fetchWithAuth('/api/user/store-sources');
        if (res.ok) {
          const data = (await res.json()) as { sources?: unknown };
          cachedConfig = normalizeStoreSources(data?.sources);
        }
      } catch {
        // 网络失败等：回落默认源
      } finally {
        configLoaded = true;
        loadingPromise = null;
      }
    })();
  }
  return loadingPromise;
}

/** 当前生效配置（同步）：用户配置优先，空类别回落该类默认，未加载用默认；列表已按默认源排前。 */
export function getEffectiveStoreSources(): StoreSourcesConfig {
  const user = cachedConfig;
  const defaults = defaultStoreSources();
  if (!user) return defaults;
  const merged = {} as StoreSourcesConfig;
  for (const category of STORE_CATEGORIES) {
    const list = user[category];
    merged[category] = list && list.length > 0 ? orderedSources(list) : defaults[category];
  }
  return merged;
}

/** 保存后刷新运行时缓存（设置面板保存成功 / 重置默认时调用），同时清空路由记忆。 */
export function updateStoreSourcesCache(value: unknown): void {
  cachedConfig = normalizeStoreSources(value);
  configLoaded = true;
  activeSourceBases.clear();
}

// ---- 索引故障转移的路由记忆 ----
// fetchStoreIndex 按源顺序试拉，成功后记住该类当前可用源 base，
// 后续同步 resolveStoreUrl（icon / readme 等散件）跟随同一源，避免跨源 404。

const activeSourceBases = new Map<StoreCategory, string>();

export function rememberActiveSourceBase(category: StoreCategory, base: string): void {
  activeSourceBases.set(category, base);
}

/** 类别当前应使用的源 base：记忆中可用源优先，否则默认源（排序列表第一位）。 */
export function resolveActiveSourceBase(category: StoreCategory): string {
  const sources = getEffectiveStoreSources()[category];
  if (sources.length === 0) return trimBase(GITHUB_REPO_BASE[category]);
  const remembered = activeSourceBases.get(category);
  const found = remembered ? sources.find((s) => trimBase(s.url) === remembered) : undefined;
  return trimBase((found ?? sources[0]).url);
}

// ---- REST 封装（设置面板用） ----

/** GET /api/user/store-sources → 用户保存的配置（null = 未配置，用默认）。 */
export async function fetchStoreSourcesConfig(): Promise<StoreSourcesConfig | null> {
  const res = await fetchWithAuth('/api/user/store-sources');
  if (!res.ok) throw new Error(`fetch store sources failed: ${res.status}`);
  const data = (await res.json()) as { sources?: unknown };
  return normalizeStoreSources(data?.sources);
}

/** PUT /api/user/store-sources（sources 传 null 恢复默认）。 */
export async function saveStoreSourcesConfig(sources: StoreSourcesConfig | null): Promise<void> {
  const res = await fetchWithAuth('/api/user/store-sources', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sources }),
  });
  if (!res.ok) throw new Error(`save store sources failed: ${res.status}`);
  updateStoreSourcesCache(sources);
}
