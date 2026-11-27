import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * 商店源路由 / 索引故障转移测试（lib/store-sources.ts + lib/agent-store.ts）。
 *
 * 两个模块的浏览器分支依赖 window / localStorage / fetch：注入最小桩后再
 * 调用（守卫都是调用时判断，静态导入安全）。模块级配置缓存用
 * updateStoreSourcesCache 直接写入（设置面板保存后同款入口）。
 */

// ---- 测试环境桩（导入目标模块前定义即可，守卫均为调用时判断） ----
const localStorageStub = {
  getItem: (_key: string) => null,
  setItem: (_key: string, _value: string) => {},
  removeItem: (_key: string) => {},
};
(globalThis as Record<string, unknown>).window = { location: { hostname: '127.0.0.1' } };
(globalThis as Record<string, unknown>).localStorage = localStorageStub;

const { fetchStoreIndex, resolveStoreUrl } = await import('./agent-store');
const {
  defaultStoreSources,
  getEffectiveStoreSources,
  matchStoreCategory,
  updateStoreSourcesCache,
} = await import('./store-sources');

const originalFetch = globalThis.fetch;
const calls: string[] = [];
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  calls.push(url);
  if (url.startsWith('https://mirror.example/plugins/')) {
    return Response.json([{ id: 'plugin-a', name: 'Plugin A' }]);
  }
  return new Response('', { status: 404 });
}) as typeof fetch;

test.after(() => {
  globalThis.fetch = originalFetch;
  delete (globalThis as Record<string, unknown>).window;
  delete (globalThis as Record<string, unknown>).localStorage;
});

test('默认源：每类两个地址（GitHub + 本地镜像端口）', () => {
  const defaults = defaultStoreSources();
  const localPorts = { plugins: '8091', workflows: '8092', 'mini-app': '8093' } as const;
  for (const category of ['plugins', 'workflows', 'mini-app'] as const) {
    const urls = defaults[category].map((source) => source.url);
    assert.equal(urls.length, 2, `${category} 默认应有两个源`);
    assert.match(urls[0] ?? '', /^https:\/\/gh-proxy\.org\/https:\/\/github\.com\//, `${category} 第一个源应为 GitHub`);
    assert.equal(urls[1], `http://127.0.0.1:${localPorts[category]}`, `${category} 第二个源应为本地镜像端口`);
  }
});

test('类别前缀判定', () => {
  assert.equal(matchStoreCategory('plugins/index.json'), 'plugins');
  assert.equal(matchStoreCategory('workflows/w.json'), 'workflows');
  assert.equal(matchStoreCategory('mini-app/x/app.json'), 'mini-app');
  assert.equal(matchStoreCategory('agents/index.json'), null);
  assert.equal(matchStoreCategory('mcps/index.json'), null);
  // 无斜杠前缀不误伤（如名为 workflows.json 的普通文件）
  assert.equal(matchStoreCategory('workflows.json'), null);
});

test('索引按源顺序故障转移，成功源被记住用于后续散件解析', async () => {
  updateStoreSourcesCache({
    plugins: [
      { id: 'bad', name: 'Bad', url: 'https://bad.example/plugins' },
      { id: 'good', name: 'Good', url: 'https://mirror.example/plugins/' },
    ],
    workflows: [],
    'mini-app': [],
  });
  calls.length = 0;

  const items = await fetchStoreIndex<{ id: string }>('plugins/index.json');
  assert.deepEqual(items, [{ id: 'plugin-a', name: 'Plugin A' }]);
  assert.deepEqual(calls, [
    'https://bad.example/plugins/index.json',
    'https://mirror.example/plugins/index.json',
  ]);

  // 记住的可用源生效：icon 等散件跟随同一镜像，不再试坏源
  calls.length = 0;
  assert.equal(
    resolveStoreUrl('plugins/plugin-a/icon.png'),
    'https://mirror.example/plugins/plugin-a/icon.png',
  );
});

test('用户某类源为空 → 回落该类默认源；重置后回落默认 GitHub', () => {
  // workflows 用户配置为空（上个测试写入）→ 默认第一个源（GitHub）
  assert.equal(
    resolveStoreUrl('workflows/index.json'),
    'https://gh-proxy.org/https://github.com/hunmer/flow-spaces-workflows/raw/refs/heads/main/index.json',
  );

  updateStoreSourcesCache(null);
  assert.equal(
    resolveStoreUrl('plugins/index.json'),
    'https://gh-proxy.org/https://github.com/hunmer/flow-spaces-plugins/raw/refs/heads/main/index.json',
  );
});

test('默认源排序：radio 标记的默认源优先尝试，其余保持顺序故障转移', async () => {
  updateStoreSourcesCache({
    plugins: [
      { id: 'mirror', name: 'Mirror', url: 'https://mirror.example/plugins/', default: false },
      { id: 'bad', name: 'Bad', url: 'https://bad.example/plugins', default: true },
    ],
    workflows: [],
    'mini-app': [],
  });
  calls.length = 0;

  const items = await fetchStoreIndex<{ id: string }>('plugins/index.json');
  assert.deepEqual(items, [{ id: 'plugin-a', name: 'Plugin A' }]);
  // 默认源 bad 排最前先试，失败后落到 mirror
  assert.deepEqual(calls, [
    'https://bad.example/plugins/index.json',
    'https://mirror.example/plugins/index.json',
  ]);

  // 无记忆时散件解析也走默认源（bad）而非列表第一位（mirror）
  calls.length = 0;
  updateStoreSourcesCache({
    plugins: [
      { id: 'mirror', name: 'Mirror', url: 'https://mirror.example/plugins/' },
      { id: 'bad', name: 'Bad', url: 'https://bad.example/plugins', default: true },
    ],
    workflows: [],
    'mini-app': [],
  });
  assert.equal(
    resolveStoreUrl('plugins/plugin-a/icon.png'),
    'https://bad.example/plugins/plugin-a/icon.png',
  );
});

test('默认源归一：多个 default 只留第一个；全部未标记时第一个补默认', () => {
  updateStoreSourcesCache({
    plugins: [
      { id: 'a', name: 'A', url: 'https://a.example/plugins', default: true },
      { id: 'b', name: 'B', url: 'https://b.example/plugins', default: true },
      { id: 'c', name: 'C', url: 'https://c.example/plugins', default: true },
    ],
    workflows: [],
    'mini-app': [],
  });
  let effective = getEffectiveStoreSources().plugins;
  assert.deepEqual(effective.map((s) => s.id), ['a', 'b', 'c']);
  assert.deepEqual(effective.map((s) => s.default), [true, false, false]);

  updateStoreSourcesCache({
    plugins: [
      { id: 'a', name: 'A', url: 'https://a.example/plugins' },
      { id: 'b', name: 'B', url: 'https://b.example/plugins' },
    ],
    workflows: [],
    'mini-app': [],
  });
  effective = getEffectiveStoreSources().plugins;
  assert.deepEqual(effective.map((s) => s.id), ['a', 'b']);
  assert.deepEqual(effective.map((s) => s.default), [true, false]);

  // 默认配置：GitHub 为默认源
  assert.equal(defaultStoreSources().plugins[0].default, true);
  assert.equal(defaultStoreSources().plugins[1].default, false);
});

test('非三类内容（agents/mcps/skills）走主仓库默认 base', () => {
  assert.equal(
    resolveStoreUrl('agents/index.json'),
    'https://gh-proxy.org/https://github.com/hunmer/flow_spaces/raw/refs/heads/master/packages/templates/agents/index.json',
  );
});

test('全部源失败时抛出最后一个错误', async () => {
  updateStoreSourcesCache({
    plugins: [{ id: 'only', name: 'Only', url: 'https://bad.example/plugins' }],
    workflows: [],
    'mini-app': [],
  });
  await assert.rejects(
    () => fetchStoreIndex('plugins/index.json'),
    /failed: 404/,
  );
});
