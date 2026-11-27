import { readdirSync } from 'node:fs';
import { join } from 'node:path';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function walkDir(
  root: string,
  opts: {
    skip?: (name: string, isDir: boolean) => boolean;
    visit: (fullPath: string, relPath: string, isDir: boolean) => void;
  },
): void {
  const recurse = (dir: string, prefix: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (opts.skip?.(entry.name, entry.isDirectory())) continue;
      const fullPath = join(dir, entry.name);
      const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      opts.visit(fullPath, relPath, entry.isDirectory());
      if (entry.isDirectory()) recurse(fullPath, relPath);
    }
  };
  recurse(root, '');
}
