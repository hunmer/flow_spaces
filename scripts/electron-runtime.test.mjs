import assert from 'node:assert/strict';
import { test } from 'node:test';
import { projectServerDeployment } from './electron-runtime.mjs';

test('standalone deployment pins production versions and retains native optional dependencies', () => {
  const manifest = { dependencies: { sharp: '^1', '@flow-spaces/shared': 'workspace:*' }, devDependencies: { tsc: '1' }, optionalDependencies: { agent: '1' }, scripts: { postinstall: 'build' } };
  const lock = { importers: { 'packages/server': { dependencies: { sharp: { specifier: '^1', version: '1.2.3(peer@4)' }, '@flow-spaces/shared': { version: 'link:../shared' } }, optionalDependencies: { agent: { version: '1' } } } }, snapshots: { 'sharp@1.2.3(peer@4)': { optionalDependencies: { native: '1.2.3' } } } };
  const result = projectServerDeployment(manifest, lock, 'pnpm@10.17.1');
  assert.deepEqual(result.pkg.dependencies, { sharp: '^1' });
  assert.equal(result.pkg.scripts, undefined);
  assert.equal(result.pkg.optionalDependencies, undefined);
  assert.equal(result.pkg.devDependencies, undefined);
  assert.equal(result.pkg.packageManager, 'pnpm@10.17.1');
  assert.equal(result.lock.importers['.'].dependencies.sharp.version, '1.2.3(peer@4)');
  assert.deepEqual(result.lock.snapshots, lock.snapshots);
  assert.equal(manifest.dependencies['@flow-spaces/shared'], 'workspace:*');
  assert.ok(lock.importers['packages/server']);
});
