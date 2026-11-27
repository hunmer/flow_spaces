import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('store installs runtime files by default, adds development on request, and resumes incrementally', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'mini-app-store-install-'));
  const previousDataDir = process.env.FLOW_SPACES_DATA_DIR;
  process.env.FLOW_SPACES_DATA_DIR = dataDir;
  const originalFetch = globalThis.fetch;
  try {
    const { installFromStore, store } = await import('../src/services/mini-apps.js');
    const runtimePath = 'src/vendor/editor/dist/index.html';
    const sourcePath = 'src/vendor/editor/src/main.ts';
    const configPath = 'src/vendor/editor/package.json';
    const contents = new Map([
      [runtimePath, '<html>built</html>'],
      [sourcePath, 'console.log("source")'],
      [configPath, '{"scripts":{"build":"vite build"}}'],
    ]);
    const entry = (path: string) => ({ path, md5: createHash('md5').update(contents.get(path)!).digest('hex') });
    const requested: string[] = [];
    globalThis.fetch = (async (url: string | URL | Request) => {
      const path = String(url).replace('https://store.example/app/', '');
      requested.push(path);
      assert.ok(contents.has(path), `unexpected download: ${path}`);
      return new Response(contents.get(path));
    }) as typeof fetch;
    const input = {
      id: 'test-development', baseUrl: 'https://store.example/app',
      storeUrl: 'https://store.example/app/app.json', storeChecksum: 'a'.repeat(32),
      manifest: { name: 'test-development', type: 'html' as const, mainFile: 'index.html' },
      // 模拟旧 files 中仍有源码，development 仍须仅在明确选择后下载。
      files: [entry(runtimePath), entry(sourcePath)],
      development: [entry(sourcePath), entry(configPath), { path: '../escape.ts', md5: '0'.repeat(32) }],
    };
    const regular = await installFromStore(input);
    assert.equal(regular.downloaded, 1);
    assert.deepEqual(requested, [runtimePath]);
    const root = store.getProjectDir(regular.project.id);
    assert.equal(existsSync(join(root, sourcePath)), false);
    requested.length = 0;
    const development = await installFromStore({ ...input, installDevelopment: true });
    assert.equal(development.downloaded, 2);
    assert.equal(development.skipped, 1);
    assert.deepEqual(requested, [sourcePath, configPath]);
    assert.equal(readFileSync(join(root, sourcePath), 'utf8'), contents.get(sourcePath));
    requested.length = 0;
    const repeated = await installFromStore({ ...input, installDevelopment: true });
    assert.equal(repeated.downloaded, 0);
    assert.equal(repeated.skipped, 3);
    assert.deepEqual(requested, []);
    assert.equal(repeated.project.storeDevelopment, true);
    assert.equal(repeated.project.storeChecksum, input.storeChecksum);
    // 后续更新不传模式时继续下载开发源码。
    contents.set(sourcePath, 'console.log("updated source")');
    const sourceUpdate = await installFromStore({ ...input, development: [entry(sourcePath), entry(configPath)] });
    assert.equal(sourceUpdate.downloaded, 1);
    assert.equal(sourceUpdate.project.storeDevelopment, true);
    // 服务重启重建索引后来源、MD5、开发模式仍存在。
    const rebuilt = store.rebuildIndex().find(project => project.id === input.id)!;
    assert.equal(rebuilt.storeUrl, input.storeUrl);
    assert.equal(rebuilt.storeChecksum, input.storeChecksum);
    assert.equal(rebuilt.storeDevelopment, true);
    // 下载失败不能提交新 checksum，下一次检查仍应提示更新。
    await assert.rejects(installFromStore({
      ...input, storeChecksum: 'b'.repeat(32),
      files: [{ path: runtimePath, md5: '0'.repeat(32) }],
    }), /checksum mismatch/);
    assert.equal(store.getProject(input.id)?.storeChecksum, input.storeChecksum);
    // 没有 development 的旧应用继续按原清单安装。
    const legacy = await installFromStore({ ...input, id: 'test-legacy', manifest: { ...input.manifest, name: 'test-legacy' }, files: [entry(runtimePath), entry(sourcePath)], development: undefined });
    assert.equal(legacy.downloaded, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousDataDir === undefined) delete process.env.FLOW_SPACES_DATA_DIR;
    else process.env.FLOW_SPACES_DATA_DIR = previousDataDir;
    rmSync(dataDir, { recursive: true, force: true });
  }
});
