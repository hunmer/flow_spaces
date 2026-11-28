import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppInfoClient } from './app-info';

test('Electron uses IPC without querying npm server', async () => {
  const info = { name: 'Flow Spaces', version: '1.0.0', platform: 'win32', runtime: 'electron' as const };
  const client = createAppInfoClient({ getInfo: async () => info, checkUpdate: async () => ({ ...info, updateAvailable: true }) }, async () => { throw new Error('must not use HTTP'); });
  assert.equal((await client.getInfo()).runtime, 'electron');
  assert.equal((await client.checkUpdate()).updateAvailable, true);
});

test('npm uses authenticated server endpoints and propagates failures', async () => {
  const calls: unknown[] = [];
  const client = createAppInfoClient(undefined, async (url, init) => {
    calls.push([url, init?.method]);
    return Response.json({ version: '1.0.0' });
  });
  await client.getInfo();
  await client.checkUpdate();
  assert.deepEqual(calls, [['/api/app-info', 'GET'], ['/api/app-info/check-update', 'POST']]);
  const failing = createAppInfoClient(undefined, async () => new Response('', { status: 502 }));
  await assert.rejects(failing.checkUpdate(), /request failed/);
});
