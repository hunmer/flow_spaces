import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';

async function client({ production = true, configured = '', stored } = {}) {
  const { outputFiles } = await build({
    entryPoints: ['apps/web/src/lib/server.ts'],
    bundle: true, write: false, format: 'cjs',
    define: {
      'import.meta.env.PROD': JSON.stringify(production),
      'process.env.NEXT_PUBLIC_SERVER_URL': JSON.stringify(configured),
    },
  });
  const context = {
    module: { exports: {} }, URL, document: { cookie: '' },
    window: { location: new URL('http://127.0.0.1:49152/') },
    localStorage: { getItem: key => key === 'flow-spaces-servers' && stored ? JSON.stringify(stored) : null },
  };
  runInNewContext(outputFiles[0].text, context);
  return { api: context.module.exports, document: context.document };
}

test('production API, assets and cookie retain the embedded server dynamic port, including saved defaults', async () => {
  const { api, document } = await client({ stored: [{ id: 'default', name: 'Default', url: 'http://127.0.0.1:3110' }] });
  assert.equal(api.getActiveServerUrl(), 'http://127.0.0.1:49152');
  assert.equal(api.resolveServerAssetUrl('/uploads/avatar.png'), 'http://127.0.0.1:49152/uploads/avatar.png');
  api.setActiveServerCookie(api.getActiveServerUrl());
  assert.match(document.cookie, /active-server=http%3A%2F%2F127.0.0.1%3A49152;/);
});

test('development still targets the standalone server on 3110', async () => {
  const { api } = await client({ production: false });
  assert.equal(api.getActiveServerUrl(), 'http://127.0.0.1:3110');
});

test('explicit server configuration and saved custom servers preserve protocol and port', async () => {
  const { api } = await client({ configured: 'https://example.com:8443/' });
  assert.equal(api.getActiveServerUrl(), 'https://example.com:8443');
  assert.equal(api.normalizeServerUrl('example.com'), 'http://example.com:3110');
  assert.equal(api.normalizeServerUrl('127.0.0.1:49152'), 'http://127.0.0.1:49152');
  assert.equal(api.normalizeServerUrl('https://example.com'), 'https://example.com');
  const saved = await client({ stored: [{ id: 'custom', name: 'Custom', url: 'https://example.com:8443' }] });
  assert.equal(saved.api.getActiveServerUrl(), 'https://example.com:8443');
});
