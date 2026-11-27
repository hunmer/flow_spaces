import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';

test('production builds default to fast loading while development builds default to source', () => {
  for (const production of [true, false]) {
    const result = buildSync({
      entryPoints: [fileURLToPath(new URL('./mini-app-loading.ts', import.meta.url))],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      write: false,
      define: { 'import.meta.env': JSON.stringify({ PROD: production }) },
      external: ['zustand', 'zustand/middleware'],
    });
    const module = { exports: {} as { useMiniAppLoadingStore: { getState: () => { fastLoading: boolean } } } };
    new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
    assert.equal(module.exports.useMiniAppLoadingStore.getState().fastLoading, production);
  }
});

test('persists global and per-app preferences; explicit false overrides global true', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } });
  try {
    const { useMiniAppLoadingStore: store, resolveMiniAppFastLoading: resolve } = await import('./mini-app-loading');
    const current = (id: string) => resolve(store.getState().fastLoading, store.getState().overrides[id]);
    store.getState().setFastLoading(true);
    assert.equal(current('untouched'), true);
    store.getState().setAppFastLoading('app', false);
    assert.equal(current('app'), false);
    store.getState().setAppFastLoading('other', true);
    store.getState().setFastLoading(false);
    assert.equal(current('other'), true);
    assert.equal(current('untouched'), false);
    const persisted = JSON.parse(values.get('flow-spaces:mini-app-loading')!);
    assert.deepEqual(persisted.state.overrides, { app: false, other: true });
    await store.persist.rehydrate();
    assert.equal(current('other'), true);
    store.getState().setAppFastLoading('other', undefined);
    assert.equal(current('other'), false);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
