import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as store from '../src/storage/mini-app-store.js';
import { executeDb, closeProjectDbs } from '../src/storage/mini-app-db.js';

test('local app stays in its original directory across registration, editing, rebuild and removal', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'mini-app-local-')));
  const previous = process.env.FLOW_SPACES_MINI_APPS_DIR;
  const registry = join(root, 'registry');
  process.env.FLOW_SPACES_MINI_APPS_DIR = registry;
  const directory = join(root, 'my-app');
  mkdirSync(join(directory, 'src'), { recursive: true });
  const manifest = JSON.stringify({ id: 'local-app', name: '本地应用', type: 'react', mainFile: 'index.jsx' });
  writeFileSync(join(directory, 'manifest.json'), manifest);
  writeFileSync(join(directory, 'src/index.jsx'), 'original');
  try {
    const project = store.addLocalProject(directory);
    assert.equal(project.localPath, directory);
    assert.equal(store.getProjectDir(project.id), directory);
    assert.equal(readFileSync(join(directory, 'manifest.json'), 'utf8'), manifest);
    assert.equal(existsSync(join(registry, project.id)), false);
    assert.equal(store.addLocalProject(directory).id, project.id);
    assert.equal(store.listProjects().length, 1);
    assert.equal(store.readFile(project.id, 'index.jsx'), 'original');
    store.writeFile(project.id, 'index.jsx', 'edited');
    assert.equal(readFileSync(join(directory, 'src/index.jsx'), 'utf8'), 'edited');
    assert.throws(() => store.resolveSrcPath(project.id, '../manifest.json'), /escapes/);
    store.updateProject(project.id, { description: 'updated' });
    assert.equal(JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8')).localPath, undefined);
    assert.equal(store.rebuildIndex().find(item => item.id === project.id)?.localPath, directory);
    assert.equal(store.readFile(project.id, 'index.jsx'), 'edited');
    executeDb(project.id, 'main', 'exec', 'CREATE TABLE test (value TEXT)');
    assert.ok(existsSync(join(directory, 'data/db/main.sqlite')));
    closeProjectDbs(project.id);
    assert.throws(() => store.upsertStoreProject({ id: project.id, name: project.name }), /Cannot overwrite/);
    assert.throws(() => store.importFromDir(directory, { ...project }), /Cannot overwrite/);
    store.deleteProject(project.id);
    assert.equal(store.getProject(project.id), null);
    assert.ok(existsSync(join(directory, 'manifest.json')));
    assert.equal(readFileSync(join(directory, 'src/index.jsx'), 'utf8'), 'edited');
    assert.ok(existsSync(join(directory, 'data/db/main.sqlite')));
  } finally {
    closeProjectDbs('local-app');
    if (previous === undefined) delete process.env.FLOW_SPACES_MINI_APPS_DIR;
    else process.env.FLOW_SPACES_MINI_APPS_DIR = previous;
    rmSync(root, { recursive: true, force: true });
  }
});

test('invalid directories and duplicate project IDs do not mutate registration or source', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'mini-app-local-invalid-')));
  const previous = process.env.FLOW_SPACES_MINI_APPS_DIR;
  process.env.FLOW_SPACES_MINI_APPS_DIR = join(root, 'registry');
  const directory = join(root, 'app');
  mkdirSync(join(directory, 'src'), { recursive: true });
  try {
    assert.throws(() => store.addLocalProject('relative/path'), /absolute/);
    assert.throws(() => store.addLocalProject(directory), /manifest.json/);
    writeFileSync(join(directory, 'manifest.json'), JSON.stringify({ id: 'app', name: 'app', type: 'html', mainFile: '../outside.html' }));
    writeFileSync(join(directory, 'outside.html'), 'outside');
    assert.throws(() => store.addLocalProject(directory), /inside src/);
    writeFileSync(join(directory, 'manifest.json'), JSON.stringify({ id: 'app', name: 'app', type: 'html', mainFile: 'index.html' }));
    assert.throws(() => store.addLocalProject(directory), /existing file/);
    writeFileSync(join(directory, 'src/index.html'), '<html>local</html>');
    store.createProject({ name: 'app', type: 'html' });
    assert.throws(() => store.addLocalProject(directory), store.DuplicateNameError);
    assert.equal(store.listProjects().length, 1);
    assert.equal(store.listProjects()[0].localPath, undefined);
    assert.equal(readFileSync(join(directory, 'src/index.html'), 'utf8'), '<html>local</html>');
  } finally {
    if (previous === undefined) delete process.env.FLOW_SPACES_MINI_APPS_DIR;
    else process.env.FLOW_SPACES_MINI_APPS_DIR = previous;
    rmSync(root, { recursive: true, force: true });
  }
});
