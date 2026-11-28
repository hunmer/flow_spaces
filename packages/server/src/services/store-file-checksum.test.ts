import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { verifyStoreFileBuffer } from './store-file-checksum.js';

const md5 = (buffer: Buffer) => createHash('md5').update(buffer).digest('hex');

test('preserves exact binary and text bytes', () => {
  for (const bytes of [Buffer.from([0, 255, 13, 10]), Buffer.from('音乐🎵\n')]) {
    assert.equal(verifyStoreFileBuffer(bytes, md5(bytes), 'file'), bytes);
  }
});

test('restores legacy CRLF checksums after Git converts published text to LF', () => {
  const expected = Buffer.from('[\r\n  {"name":"音乐🎵"}\r\n]\r\n');
  const downloaded = Buffer.from(expected.toString().replace(/\r\n/g, '\n'));
  const installed = verifyStoreFileBuffer(downloaded, md5(expected), 'agents.json');
  assert.deepEqual(installed, expected);
  assert.equal(md5(installed), md5(expected));
});

test('accepts the reverse newline conversion only when its checksum matches', () => {
  const lf = Buffer.from('line one\nline two\n');
  assert.deepEqual(verifyStoreFileBuffer(Buffer.from('line one\r\nline two\r\n'), md5(lf), 'README.md'), lf);
  assert.throws(() => verifyStoreFileBuffer(Buffer.from('changed\n'), md5(lf), 'README.md'), /checksum mismatch.*README.md.*expected.*received/);
});

test('never rewrites invalid UTF-8 or binary content to satisfy text checksums', () => {
  const invalid = Buffer.from([255, 10]);
  const transformed = Buffer.from(invalid.toString().replace(/\n/g, '\r\n'));
  assert.throws(() => verifyStoreFileBuffer(invalid, md5(transformed), 'icon.png'), /checksum mismatch/);
  const binary = Buffer.from('header\0\n');
  assert.throws(() => verifyStoreFileBuffer(binary, md5(Buffer.from('header\0\r\n')), 'file.bin'), /checksum mismatch/);
});
