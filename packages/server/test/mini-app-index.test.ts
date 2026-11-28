import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as store from '../src/storage/mini-app-store.js';

test('store index survives runtime rebuilds and edits with image metadata intact', () => {
  const root = mkdtempSync(join(tmpdir(), 'mini-app-index-'));
  const previous = process.env.FLOW_SPACES_MINI_APPS_DIR;
  process.env.FLOW_SPACES_MINI_APPS_DIR = root;
  try {
    const manifest = { id: 'demo', name: 'Demo', type: 'react', mainFile: 'index.jsx', createdAt: '' };
    const published = JSON.stringify([{ ...manifest, iconUrl: 'mini-app/demo/icon.png', coverUrl: 'mini-app/demo/cover.jpg', md5: 'a'.repeat(32) }]);
    mkdirSync(join(root, 'demo'));
    writeFileSync(join(root, 'demo/manifest.json'), JSON.stringify(manifest));
    writeFileSync(join(root, 'demo/icon.png'), 'icon');
    writeFileSync(join(root, 'demo/cover.jpg'), 'cover');
    writeFileSync(join(root, 'checksums.json'), JSON.stringify({ demo: 'a'.repeat(32) }));
    writeFileSync(join(root, 'index.json'), published);
    const [project] = store.rebuildIndex();
    assert.equal(project.avatarUrl, 'icon.png');
    assert.equal(project.backgroundUrl, 'cover.jpg');
    assert.equal(readFileSync(join(root, 'index.json'), 'utf8'), published);
    assert.equal(JSON.parse(readFileSync(join(root, 'runtime-index.json'), 'utf8'))[0].backgroundUrl, 'cover.jpg');
    store.updateProject('demo', { description: 'edited' });
    assert.equal(store.getProject('demo')?.description, 'edited');
    store.rebuildIndex();
    assert.equal(store.getProject('demo')?.avatarUrl, 'icon.png');
    store.deleteProject('demo');
    assert.deepEqual(store.listProjects(), []);
    assert.equal(readFileSync(join(root, 'index.json'), 'utf8'), published);
  } finally {
    if (previous === undefined) delete process.env.FLOW_SPACES_MINI_APPS_DIR;
    else process.env.FLOW_SPACES_MINI_APPS_DIR = previous;
    rmSync(root, { recursive: true, force: true });
  }
});

test('legacy runtime registration migrates without losing linked apps or image choices', () => {
  const root = mkdtempSync(join(tmpdir(), 'mini-app-index-migration-'));
  const previous = process.env.FLOW_SPACES_MINI_APPS_DIR;
  process.env.FLOW_SPACES_MINI_APPS_DIR = root;
  try {
    const localPath = join(root, 'linked');
    mkdirSync(localPath);
    const linked = { id: 'linked', name: 'Linked', type: 'react', mainFile: 'index.jsx', createdAt: '', localPath, avatarUrl: 'custom.png', backgroundUrl: 'custom.jpg', storeChecksum: 'a'.repeat(32) };
    const legacy = JSON.stringify([linked]);
    writeFileSync(join(root, 'index.json'), legacy);
    writeFileSync(join(root, 'checksums.json'), '{}');
    assert.deepEqual(store.rebuildIndex(), [linked]);
    assert.equal(readFileSync(join(root, 'index.json'), 'utf8'), legacy);
    writeFileSync(join(root, 'index.json'), '[]');
    assert.deepEqual(store.listProjects(), [linked]);
  } finally {
    if (previous === undefined) delete process.env.FLOW_SPACES_MINI_APPS_DIR;
    else process.env.FLOW_SPACES_MINI_APPS_DIR = previous;
    rmSync(root, { recursive: true, force: true });
  }
});
