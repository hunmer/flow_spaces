#!/usr/bin/env node
// Logical file bytes (not allocated disk blocks); do not follow directory symlinks.
// Usage: node scripts/analyze-package-size.mjs [output.json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(root, 'apps/web');
function files(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) return [];
    if (entry.isDirectory()) return files(full, base);
    return [{ path: path.relative(base, full).replaceAll('\\', '/'), bytes: fs.statSync(full).size }];
  });
}
const total = rows => rows.reduce((sum, row) => sum + row.bytes, 0);
const largest = rows => rows.toSorted((a, b) => b.bytes - a.bytes).slice(0, 25);
function breakdown(rows) {
  const groups = new Map();
  for (const row of rows) {
    const group = row.path.split('/')[0];
    groups.set(group, (groups.get(group) ?? 0) + row.bytes);
  }
  return [...groups].map(([name, bytes]) => ({ name, bytes })).sort((a, b) => b.bytes - a.bytes);
}
const manifest = JSON.parse(fs.readFileSync(path.join(web, 'package.json'), 'utf8'));
const dependencies = Object.keys(manifest.dependencies).map(name => {
  const link = path.join(web, 'node_modules', name);
  return { name, bytes: fs.existsSync(link) ? total(files(fs.realpathSync(link))) : null };
}).sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0));
const dist = path.join(web, 'dist');
const webFiles = files(dist);
const unpacked = path.join(web, 'electron-build/out/win-unpacked');
const electronFiles = files(unpacked);
const serverFiles = files(path.join(unpacked, 'resources/server'));
const nodeModuleFiles = files(path.join(unpacked, 'resources/server/node_modules'));
const pnpmFiles = files(path.join(unpacked, 'resources/server/node_modules/.pnpm'));
const serverModuleDir = path.join(unpacked, 'resources/server/node_modules');
const serverPackages = pnpmFiles.some(row => row.path.includes('/node_modules/')) ? breakdown(pnpmFiles) :
  (fs.existsSync(serverModuleDir) ? fs.readdirSync(serverModuleDir, { withFileTypes: true }).flatMap(entry => {
    if (!entry.isDirectory() || entry.name.startsWith('.')) return [];
    const dir = path.join(serverModuleDir, entry.name);
    return entry.name.startsWith('@')
      ? fs.readdirSync(dir).map(name => ({ name: `${entry.name}/${name}`, bytes: total(files(path.join(dir, name))) }))
      : [{ name: entry.name, bytes: total(files(dir)) }];
  }).sort((a, b) => b.bytes - a.bytes) : []);
const report = {
  generatedAt: new Date().toISOString(),
  units: 'bytes; logical file sizes, symlinks excluded; dependency rows exclude transitive dependencies',
  dependencies,
  web: {
    bytes: total(webFiles), groups: breakdown(webFiles),
    largest: largest(webFiles).map(row => ({ ...row,
      ...(/\.(js|css)$/.test(row.path) ? { gzipBytes: gzipSync(fs.readFileSync(path.join(dist, row.path))).length } : {}),
    })),
  },
  electron: {
    bytes: total(electronFiles), groups: breakdown(electronFiles), largest: largest(electronFiles),
    server: {
      bytes: total(serverFiles), groups: breakdown(serverFiles),
      packages: serverPackages.slice(0, 30),
      nodeModules: {
        groups: breakdown(nodeModuleFiles),
        extensions: breakdown(nodeModuleFiles.map(row => ({ ...row, path: path.extname(row.path) || '(none)' }))),
      },
    },
    // Exclude unpacked directories and builder intermediates from installer totals.
    artifacts: files(path.join(web, 'electron-build/out')).filter(row => !row.path.includes('/') && /\.(exe|zip|dmg|AppImage|blockmap)$/.test(row.path)),
  },
};
const json = JSON.stringify(report, null, 2) + '\n';
if (process.argv[2]) fs.writeFileSync(path.resolve(process.argv[2]), json);
else process.stdout.write(json);
