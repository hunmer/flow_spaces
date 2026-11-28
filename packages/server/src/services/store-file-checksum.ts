import { createHash } from 'node:crypto';

const md5 = (buffer: Buffer) => createHash('md5').update(buffer).digest('hex');

/** Return bytes matching the published checksum, including legacy Git newline conversion. */
export function verifyStoreFileBuffer(buffer: Buffer, expected: string, path: string): Buffer {
  const actual = md5(buffer);
  if (actual === expected) return buffer;

  const text = buffer.toString('utf8');
  // Only try reversible newline conversion for UTF-8 text, never binary files.
  if (!text.includes('\0') && Buffer.from(text, 'utf8').equals(buffer)) {
    const lf = text.replace(/\r\n/g, '\n');
    for (const value of [lf, lf.replace(/\n/g, '\r\n')]) {
      const candidate = Buffer.from(value, 'utf8');
      if (md5(candidate) === expected) return candidate;
    }
  }
  throw new Error(`checksum mismatch after download: ${path} (expected ${expected}, received ${actual}); refresh the store index and retry`);
}
