import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppInfoApi } from './app-info.mjs';

test('development never loads updater', async () => {
  const api = createAppInfoApi({ getVersion: () => '1.0.0', isPackaged: false }, () => { throw new Error('must not load'); });
  assert.equal((await api.checkUpdate()).disabled, true);
});

test('packaged check disables downloads, shares concurrent checks and reports updater result', async () => {
  let calls = 0;
  const updater = { on() {}, async checkForUpdates() { calls++; return { updateInfo: { version: '2.0.0' }, isUpdateAvailable: true }; } };
  const api = createAppInfoApi({ getVersion: () => '1.0.0', isPackaged: true }, async () => ({ autoUpdater: updater }));
  const [first, second] = await Promise.all([api.checkUpdate(), api.checkUpdate()]);
  assert.equal(calls, 1);
  assert.deepEqual(first, second);
  assert.equal(first.updateAvailable, true);
  assert.equal(updater.autoDownload, false);
  assert.equal(updater.autoInstallOnAppQuit, false);
});

test('failed updater load can be retried', async () => {
  let calls = 0;
  const api = createAppInfoApi({ getVersion: () => '1.0.0', isPackaged: true }, async () => {
    if (++calls === 1) throw new Error('offline');
    return { autoUpdater: { on() {}, async checkForUpdates() { return { updateInfo: { version: '1.0.0' }, isUpdateAvailable: false }; } } };
  });
  await assert.rejects(api.checkUpdate(), /offline/);
  assert.equal((await api.checkUpdate()).updateAvailable, false);
});
