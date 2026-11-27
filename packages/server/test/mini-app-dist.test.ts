import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as store from '../src/storage/mini-app-store.js';

test('dist reads support legacy projects, rebuilds and linked local apps without following escaping symlinks', () => {
  const directory = mkdtempSync(join(tmpdir(), 'mini-app-dist-store-'));
  const previous = process.env.FLOW_SPACES_MINI_APPS_DIR;
  process.env.FLOW_SPACES_MINI_APPS_DIR = join(directory, 'registry');
  try {
    const project = store.createProject({ name: 'dist-app', type: 'react', mainFile: 'index.jsx' });
    assert.equal(store.readDistBundle(project.id), null);
    const dist = join(store.getProjectDir(project.id), 'dist');
    mkdirSync(dist);
    writeFileSync(join(dist, 'index.cjs'), 'exports.default = () => null;');
    writeFileSync(join(dist, 'index.css'), '.app{}');
    assert.deepEqual(store.readDistBundle(project.id), { code: 'exports.default = () => null;', css: '.app{}' });
    writeFileSync(join(dist, 'index.cjs'), 'rebuilt');
    assert.equal(store.readDistBundle(project.id)?.code, 'rebuilt');
    rmSync(dist, { recursive: true });
    const outside = join(directory, 'outside');
    mkdirSync(outside);
    writeFileSync(join(outside, 'index.cjs'), 'outside');
    symlinkSync(outside, dist, 'dir');
    assert.throws(() => store.readDistBundle(project.id), /escapes/);
    assert.throws(() => store.readDistBundle('missing'), /not found/);

    const local = join(directory, 'local');
    mkdirSync(join(local, 'src'), { recursive: true });
    mkdirSync(join(local, 'dist'));
    writeFileSync(join(local, 'manifest.json'), JSON.stringify({ name: 'local', type: 'react', mainFile: 'index.jsx' }));
    writeFileSync(join(local, 'src/index.jsx'), 'source');
    writeFileSync(join(local, 'dist/index.cjs'), 'local bundle');
    const linked = store.addLocalProject(local);
    assert.equal(store.readDistBundle(linked.id)?.code, 'local bundle');
  } finally {
    if (previous === undefined) delete process.env.FLOW_SPACES_MINI_APPS_DIR;
    else process.env.FLOW_SPACES_MINI_APPS_DIR = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});
