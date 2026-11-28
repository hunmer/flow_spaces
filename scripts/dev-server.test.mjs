import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { ensureDevServer } from './dev-server.mjs';

async function fixture(t) {
  let ready = false;
  const server = createServer((_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: ready ? 'ok' : 'starting' }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return { url: `http://127.0.0.1:${server.address().port}`, ready: () => { ready = true; } };
}

test('reuses a healthy existing backend without starting or owning it', async t => {
  const backend = await fixture(t);
  backend.ready();
  await ensureDevServer({ url: backend.url, start: () => assert.fail('must reuse backend') });
});

test('starts backend and waits for health before continuing', async t => {
  const backend = await fixture(t);
  let starts = 0;
  await ensureDevServer({ url: backend.url, intervalMs: 5, start: () => {
    starts++;
    setTimeout(backend.ready, 20);
    return { exitCode: null };
  } });
  assert.equal(starts, 1);
});

test('reports backend failure and readiness timeout', async t => {
  const backend = await fixture(t);
  await assert.rejects(ensureDevServer({ url: backend.url, start: () => ({ exitCode: 1 }) }), /后端已退出: 1/);
  await assert.rejects(ensureDevServer({ url: backend.url, timeoutMs: 20, intervalMs: 5, start: () => ({ exitCode: null }) }), /后端连接超时/);
});
