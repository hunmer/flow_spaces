import test from 'node:test';
import assert from 'node:assert/strict';
import { loadMiniAppStoreIndex } from './mini-app-store-index';

const base = (owner: string, repo: string, branch = 'main') => `https://github.com/${owner}/${repo}/raw/refs/heads/${branch}`;
const external = { id: 'game-asset-canvas', repository: 'https://github.com/hunmer/game-asset-canvas', branch: 'main' };
function request(handler: (url: string) => Promise<Response>): typeof fetch {
  return (async url => String(url).endsWith('/checksums.json')
    ? Response.json({ [external.id]: 'a'.repeat(32) }) : handler(String(url))) as typeof fetch;
}

const manifest = {
  id: external.id, name: '画布', type: 'react', mainFile: 'index.jsx', md5: 'a'.repeat(32),
  enabledPlugins: ['plugin'],
  files: [{ path: 'README.md', md5: 'b'.repeat(32) }, { path: 'icon.png', md5: 'c'.repeat(32) }],
  development: [{ path: 'src/vendor/editor/src/main.ts', md5: 'd'.repeat(32) }],
};

test('loads both lists and retains external install, README, icon and development metadata', async () => {
  const loads: Array<{ path: string; rememberSource?: boolean }> = [];
  const result = await loadMiniAppStoreIndex(async <T>(path: string, options?: { rememberSource?: boolean }) => {
    loads.push({ path, ...options });
    return (path.endsWith('/index.json') ? [{ id: 'internal', name: '内部' }] : [external]) as T[];
  }, base, request(async url => {
    assert.equal(String(url), `${base('hunmer', external.id)}/manifest.json`);
    return Response.json(manifest);
  }));
  assert.deepEqual(loads, [
    { path: 'mini-app/index.json' }, { path: 'mini-app/external-apps.json', rememberSource: false },
  ]);
  assert.equal(result.failed, 0);
  assert.deepEqual(result.items.map(item => item.id), ['internal', external.id]);
  const item = result.items[1];
  assert.equal(item.baseUrl, base('hunmer', external.id));
  assert.equal(item.storeUrl, `${item.baseUrl}/manifest.json`);
  assert.equal(item.introUrl, `${item.baseUrl}/README.md`);
  assert.equal(item.iconUrl, `${item.baseUrl}/icon.png`);
  assert.equal(item.hasIntro, true);
  assert.deepEqual(item.development, manifest.development);
  assert.deepEqual(item.enabledPlugins, manifest.enabledPlugins);
});

test('external source wins duplicate IDs and supports an explicit branch', async () => {
  const result = await loadMiniAppStoreIndex(async <T>(path: string) => (
    path.endsWith('/index.json') ? [{ id: external.id, name: '旧来源' }] : [{ ...external, branch: 'release' }]
  ) as T[], base, request(async url => {
    assert.match(String(url), /\/heads\/release\/manifest.json$/);
    return Response.json(manifest);
  }));
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].name, manifest.name);
});

test('an unavailable external list keeps internal apps visible', async () => {
  const result = await loadMiniAppStoreIndex(async <T>(path: string) => {
    if (path.endsWith('/external-apps.json')) throw new Error('404');
    return [{ id: 'internal', name: '内部' }] as T[];
  }, base);
  assert.equal(result.failed, 1);
  assert.equal(result.items[0].id, 'internal');
});

test('an unavailable internal list or external app does not hide other external apps', async () => {
  const result = await loadMiniAppStoreIndex(async <T>(path: string) => {
    if (path.endsWith('/index.json')) throw new Error('offline');
    return [external, { id: 'broken', repository: 'https://github.com/hunmer/broken' }] as T[];
  }, base, request(async url => String(url).includes('/broken/')
    ? new Response('', { status: 404 }) : Response.json(manifest)));
  assert.equal(result.failed, 2);
  assert.deepEqual(result.items.map(item => item.id), [external.id]);
});

test('mismatched IDs are rejected to keep checksum updates consistent', async () => {
  const result = await loadMiniAppStoreIndex(async <T>(path: string) => (
    path.endsWith('/index.json') ? [] : [external]
  ) as T[], base, request(async () => Response.json({ ...manifest, id: 'wrong-id' })) as typeof fetch);
  assert.equal(result.failed, 1);
  assert.equal(result.items.length, 0);
});


test('external manifest and checksums load without requesting file lists', async () => {
  const calls: string[] = [];
  const registration = { ...external, iconUrl: 'icon.png', hasIntro: true, hasDevelopment: true };
  const result = await loadMiniAppStoreIndex(async <T>(path: string) => (
    path.endsWith('/index.json') ? [] : [registration]
  ) as T[], base, (async url => {
    calls.push(String(url));
    return Response.json(String(url).endsWith('/checksums.json')
      ? { [external.id]: manifest.md5 }
      : { id: external.id, name: '画布' });
  }) as typeof fetch);
  assert.equal(result.failed, 0);
  assert.deepEqual(calls, [base('hunmer', external.id) + '/manifest.json', base('hunmer', external.id) + '/checksums.json']);
  assert.equal(result.items[0].hasIntro, true);
  assert.equal(result.items[0].hasDevelopment, true);
  assert.equal(result.items[0].md5, manifest.md5);
  assert.equal(result.items[0].files, undefined);
  assert.equal(result.items[0].iconUrl, base('hunmer', external.id) + '/icon.png');
});

test('invalid external checksums are reported as a failure', async () => {
  const result = await loadMiniAppStoreIndex(async <T>(path: string) => (
    path.endsWith('/index.json') ? [] : [external]
  ) as T[], base, (async url => Response.json(String(url).endsWith('/checksums.json')
    ? { [external.id]: 'invalid' } : { id: external.id, name: '画布' })) as typeof fetch);
  assert.equal(result.failed, 1);
  assert.equal(result.items.length, 0);
});
