import assert from 'node:assert/strict';
import test from 'node:test';
import { downloadStoreFiles } from './store-download-pool.js';

test('downloads concurrently with at most four active files, processing every file once', async () => {
  let active = 0;
  let peak = 0;
  const completed: number[] = [];
  const files = Array.from({ length: 13 }, (_, index) => index);
  await downloadStoreFiles(files, async file => {
    active++;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    completed.push(file);
    active--;
  });
  assert.equal(peak, 4);
  assert.deepEqual(completed.sort((a, b) => a - b), files);
  assert.equal(active, 0);
});

test('stops new downloads on failure and waits for active writes before rejecting', async () => {
  const started: number[] = [];
  const completed: number[] = [];
  const failure = new Error('checksum mismatch');
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let settled = false;
  const pending = downloadStoreFiles([0, 1, 2, 3, 4, 5], async file => {
    started.push(file);
    if (file === 0) throw failure;
    await gate;
    completed.push(file);
  });
  const checked = assert.rejects(pending, error => error === failure).then(() => { settled = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(started, [0, 1, 2, 3]);
  assert.equal(settled, false);
  release();
  await checked;
  assert.deepEqual(completed, [1, 2, 3]);
});

test('handles empty lists and fewer than four files', async () => {
  await downloadStoreFiles([], async () => assert.fail('empty list'));
  const files: number[] = [];
  await downloadStoreFiles([1, 2], async file => { files.push(file); });
  assert.deepEqual(files, [1, 2]);
});
