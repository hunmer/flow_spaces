import test from 'node:test';
import assert from 'node:assert/strict';
import { checkNpmUpdate, getAppInfo } from './app-info.js';

test('npm check queries the installed package with timeout and compares semantic versions', async () => {
  const run = (async (command, args, options) => {
    assert.equal(command, process.platform === 'win32' ? 'cmd.exe' : 'npm');
    assert.ok(args.join(' ').includes(`${getAppInfo().packageName}@latest`));
    assert.equal(options.timeout, 30_000);
    return { stdout: '"0.10.0"', stderr: '' };
  }) as Parameters<typeof checkNpmUpdate>[0];
  assert.equal((await checkNpmUpdate(run)).updateAvailable, true);
});

test('equal/older versions do not offer downgrade; malformed output fails', async () => {
  const run = (stdout: string) => (async () => ({ stdout, stderr: '' })) as Parameters<typeof checkNpmUpdate>[0];
  assert.equal((await checkNpmUpdate(run(JSON.stringify(getAppInfo().version)))).updateAvailable, false);
  assert.equal((await checkNpmUpdate(run('"0.0.1"'))).updateAvailable, false);
  await assert.rejects(checkNpmUpdate(run('"broken"')), /Invalid npm/);
  await assert.rejects(checkNpmUpdate(run('not json')));
  await assert.rejects(checkNpmUpdate((async () => { throw new Error('npm missing'); }) as Parameters<typeof checkNpmUpdate>[0]), /npm missing/);
});
