import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { HttpClient } from '../../sdk/src/client.js';
import { createMiniAppApi } from '../../sdk/src/modules/mini-apps.js';
import { readMiniAppInstallStream, type MiniAppInstallProgress } from '../../sdk/src/modules/mini-app-install.js';

test('installation pushes progress before download completes and preserves JSON clients', { timeout: 10_000 }, async (t) => {
  const previousDir = process.env.FLOW_SPACES_DATA_DIR;
  const dataDir = mkdtempSync(join(tmpdir(), 'mini-app-install-stream-'));
  process.env.FLOW_SPACES_DATA_DIR = dataDir;
  const originalFetch = globalThis.fetch;
  let releaseDownload!: () => void;
  const downloadGate = new Promise<void>(resolve => { releaseDownload = resolve; });
  t.after(() => {
    releaseDownload();
    globalThis.fetch = originalFetch;
    if (previousDir === undefined) delete process.env.FLOW_SPACES_DATA_DIR;
    else process.env.FLOW_SPACES_DATA_DIR = previousDir;
    rmSync(dataDir, { recursive: true, force: true });
  });
  const { default: router } = await import('../src/routes/mini-apps.js');
  const app = express();
  app.use(express.json());
  app.use('/api/mini-apps', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const address = server.address() as { port: number };
  const api = createMiniAppApi(new HttpClient({ baseUrl: `http://127.0.0.1:${address.port}`, getToken: () => null }));
  const contents = '<html>下载内容</html>';
  globalThis.fetch = (async (url, options) => {
    if (String(url).startsWith('https://store.example/')) {
      await downloadGate;
      return new Response(contents);
    }
    return originalFetch(url, options);
  }) as typeof fetch;
  const input = {
    id: 'stream-test', baseUrl: 'https://store.example/app',
    manifest: { name: 'stream-test', type: 'html' as const, mainFile: 'index.html' },
    files: [{ path: 'src/index.html', md5: createHash('md5').update(contents).digest('hex') }],
  };
  const progress: MiniAppInstallProgress[] = [];
  const result = await api.installFromStore(input, update => {
    progress.push(update);
    if (update.completed === 0) releaseDownload();
  });
  assert.equal(result.downloaded, 1);
  assert.deepEqual(progress.map(update => [update.completed, update.total]), [[0, 1], [1, 1]]);
  assert.equal(progress[1].downloaded, 1);
  assert.equal(progress[1].path, 'src/index.html');

  const repeated: MiniAppInstallProgress[] = [];
  await api.installFromStore(input, update => repeated.push(update));
  assert.equal(repeated.at(-1)?.skipped, 1);
  assert.equal(repeated.at(-1)?.completed, 1);
  const jsonResult = await api.installFromStore(input);
  assert.equal(jsonResult.skipped, 1);
  await assert.rejects(api.installFromStore({ ...input, files: [] }, () => {}), /400/);
  await assert.rejects(api.installFromStore({
    ...input, files: [{ path: 'src/broken.html', md5: '0'.repeat(32) }],
  }, () => {}), /checksum mismatch/);
});

test('SDK handles fragmented UTF-8 SSE frames and rejects incomplete streams', async () => {
  const progress = { total: 1, completed: 1, downloaded: 1, skipped: 0, path: 'src/中文.html', installDevelopment: false };
  const result = { project: { id: 'app' }, downloaded: 1, skipped: 0 };
  const encoded = new TextEncoder().encode(
    `data: ${JSON.stringify({ type: 'progress', data: progress })}\n\n` +
    `data: ${JSON.stringify({ type: 'result', data: result })}\n\n`,
  );
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const byte of encoded) controller.enqueue(new Uint8Array([byte]));
      controller.close();
    },
  });
  const received: MiniAppInstallProgress[] = [];
  assert.deepEqual(await readMiniAppInstallStream(new Response(stream), update => received.push(update)), result);
  assert.deepEqual(received, [progress]);
  await assert.rejects(readMiniAppInstallStream(new Response(`data: ${JSON.stringify({ type: 'progress', data: progress })}\n\n`), () => {}), /ended before completion/);
});
