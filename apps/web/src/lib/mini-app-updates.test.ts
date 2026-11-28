import test from 'node:test';
import assert from 'node:assert/strict';
import type { MiniAppProject } from '@flow-spaces/sdk';
import { checkMiniAppUpdates, loadMiniAppUpdate } from './mini-app-updates';

const oldMd5 = 'a'.repeat(32);
const newMd5 = 'b'.repeat(32);
const storeBase = 'https://store.example/mini-app/';
const project = (id: string, extra: Partial<MiniAppProject> = {}): MiniAppProject => ({
  id, name: id, version: '1.0.0', type: 'react', mainFile: 'index.jsx', createdAt: '', storeChecksum: oldMd5, ...extra,
});

function mockFetch(data: Record<string, unknown>) {
  const calls: string[] = [];
  const request = (async (url, init) => {
    calls.push(String(url));
    assert.equal(init?.cache, 'no-store');
    const body = data[String(url)];
    return body === undefined ? new Response('', { status: 404 }) : Response.json(body);
  }) as typeof fetch;
  return { request, calls };
}

test('shared store checks one small file and detects same-version changes', async () => {
  const { request, calls } = mockFetch({ [`${storeBase}checksums.json`]: { first: newMd5, second: oldMd5 } });
  const result = await checkMiniAppUpdates([
    project('first', { storeUrl: `${storeBase}first` }), project('second'), project('local'),
  ], storeBase, request);
  assert.deepEqual(calls, [`${storeBase}checksums.json`]);
  assert.deepEqual(result.updates.map(item => item.id), ['first']);
  assert.equal(result.checked, 2);
  assert.equal(result.skipped, 1);
  assert.equal(result.failed, 0);
  assert.equal(result.updates[0].manifestUrl, `${storeBase}first/files.json`);
});

test('independent repo uses checksums.json beside saved app.json and preserves its branch', async () => {
  const base = 'https://gh-proxy.org/https://github.com/owner/game/raw/refs/heads/master';
  const { request, calls } = mockFetch({ [`${base}/checksums.json`]: { game: newMd5 } });
  const result = await checkMiniAppUpdates([project('game', { storeUrl: `${base}/app.json` })], storeBase, request);
  assert.deepEqual(calls, [`${base}/checksums.json`]);
  assert.equal(result.updates[0].baseUrl, base);
  assert.equal(result.updates[0].manifestUrl, `${base}/files.json`);
});

test('missing local checksum offers an update; legacy ZIP source uses current store', async () => {
  const { request } = mockFetch({ [`${storeBase}checksums.json`]: { old: newMd5 } });
  const result = await checkMiniAppUpdates([project('old', { storeUrl: 'http://localhost:3101/mini-app/old.zip', storeChecksum: undefined })], storeBase, request);
  assert.equal(result.updates.length, 1);
  assert.equal(result.updates[0].baseUrl, `${storeBase}old`);
});

test('failed source does not prevent checking another source', async () => {
  const { request } = mockFetch({ [`${storeBase}checksums.json`]: { working: newMd5 } });
  const result = await checkMiniAppUpdates([
    project('broken', { storeUrl: 'https://broken.example/app.json' }), project('working'),
  ], storeBase, request);
  assert.equal(result.failed, 1);
  assert.equal(result.checked, 1);
  assert.equal(result.updates[0].id, 'working');
});

test('malformed checksum response is reported as a failure', async () => {
  const { request } = mockFetch({ [`${storeBase}checksums.json`]: { app: 'invalid' } });
  const result = await checkMiniAppUpdates([project('app')], storeBase, request);
  assert.equal(result.failed, 1);
  assert.equal(result.updates.length, 0);
});

test('update fetches only the selected app files.json', async () => {
  const app = { id: 'app', name: 'app', md5: newMd5, files: [{ path: 'src/index.jsx', md5: oldMd5 }], development: [{ path: 'src/vendor/editor/main.ts', md5: oldMd5 }] };
  const update = { id: 'app', name: 'app', md5: newMd5, baseUrl: `${storeBase}app`, manifestUrl: `${storeBase}app/files.json`, storeUrl: `${storeBase}app` };
  const { request, calls } = mockFetch({ [update.manifestUrl]: app });
  assert.deepEqual(await loadMiniAppUpdate(update, request), app);
  assert.deepEqual(calls, [update.manifestUrl]);
});

test('changed, empty or mismatched installation manifests are rejected', async () => {
  const update = { id: 'app', name: 'app', md5: newMd5, baseUrl: 'https://repo.example', manifestUrl: 'https://repo.example/files.json', storeUrl: '' };
  for (const app of [
    { id: 'app', md5: oldMd5, files: [{ path: 'src/index.jsx', md5: oldMd5 }] },
    { id: 'app', md5: newMd5, files: [] },
    { id: 'wrong', md5: newMd5, files: [{ path: 'src/index.jsx', md5: oldMd5 }] },
  ]) {
    const { request } = mockFetch({ [update.manifestUrl]: app });
    await assert.rejects(loadMiniAppUpdate(update, request), /Invalid or changed/);
  }
});

test('linked local apps are skipped without fetching remote updates', async () => {
  const { request, calls } = mockFetch({});
  const result = await checkMiniAppUpdates([project('local', { localPath: '/local/app' })], storeBase, request);
  assert.equal(result.skipped, 1);
  assert.equal(result.failed, 0);
  assert.deepEqual(calls, []);
});
