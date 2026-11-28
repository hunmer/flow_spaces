import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateMiniAppDist, loadMiniAppDist } from './mini-app-dist';
import * as HostReact from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('builds a multi-file component and CSS, reusing host React and UI instances', () => {
  const directory = mkdtempSync(join(tmpdir(), 'mini-app-dist-'));
  mkdirSync(join(directory, 'src'));
  writeFileSync(join(directory, 'manifest.json'), JSON.stringify({ type: 'react', mainFile: 'index.jsx' }));
  writeFileSync(join(directory, 'src/index.jsx'), `
    import React from 'react';
    import { Button } from '@flow-spaces/ui';
    import { label } from './label';
    import './style.css';
    export default function App() { return <Button>{label}</Button>; }
  `);
  writeFileSync(join(directory, 'src/label.js'), 'export const label = "built app";');
  writeFileSync(join(directory, 'src/style.css'), '.mini-app { display: flex; }');
  try {
    const script = fileURLToPath(new URL('../../../../scripts/build-mini-app.mjs', import.meta.url));
    execFileSync(process.execPath, [script, directory], { stdio: 'pipe' });
    const code = readFileSync(join(directory, 'dist/index.cjs'), 'utf8');
    const css = readFileSync(join(directory, 'dist/index.css'), 'utf8');
    const Button = () => null;
    const React = { createElement: (type: unknown, props: { children?: unknown } | null, child: unknown) => ({ type, child: child ?? props?.children }) };
    const requested: string[] = [];
    const Component = evaluateMiniAppDist(code, (id) => {
      requested.push(id);
      return id === 'react' ? React : id === '@flow-spaces/ui' ? { Button } : undefined;
    }, React, {}) as () => unknown;
    assert.deepEqual(Component(), { type: Button, child: 'built app' });
    assert.deepEqual(requested.sort(), ['@flow-spaces/ui', 'react']);
    assert.match(css, /display:flex/);
    assert.throws(() => evaluateMiniAppDist('require("missing")', () => undefined, {}, {}), /Unsupported dist external/);
    assert.throws(() => evaluateMiniAppDist('exports.named = 1;', () => undefined, {}, {}), /default component/);
    writeFileSync(join(directory, 'src/index.jsx'), 'export default function App() { return null; }');
    execFileSync(process.execPath, [script, directory], { stdio: 'pipe' });
    assert.equal(existsSync(join(directory, 'dist/index.css')), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('minified bundles preserve entry and child JSX locations while production DOM stays unmarked', () => {
  const directory = mkdtempSync(join(tmpdir(), 'mini-app-inspect bundle-'));
  mkdirSync(join(directory, 'src/components'), { recursive: true });
  writeFileSync(join(directory, 'manifest.json'), JSON.stringify({ type: 'react', mainFile: 'index.tsx' }));
  writeFileSync(join(directory, 'src/index.tsx'), "import Child from './components/Child';\nexport default function App() {\n  return <main><Child /></main>;\n}");
  writeFileSync(join(directory, 'src/components/Child.jsx'), 'export default function Child() {\n  return <button key="player" {...{title: "player"}}><span>play</span></button>;\n}');
  try {
    const script = fileURLToPath(new URL('../../../../scripts/build-mini-app.mjs', import.meta.url));
    execFileSync(process.execPath, [script, directory], { stdio: 'pipe' });
    const code = readFileSync(join(directory, 'dist/index.cjs'), 'utf8');
    const render = (projectId?: string) => {
      const Component = evaluateMiniAppDist(code, () => undefined, HostReact, {}, projectId) as HostReact.ComponentType;
      return renderToStaticMarkup(HostReact.createElement(Component));
    };
    const html = render('renamed-app');
    assert.match(html, /<main [^>]*data-mini-app-source-project="renamed-app"[^>]*data-mini-app-source-file="index.tsx"[^>]*data-mini-app-source-line="3"[^>]*data-mini-app-source-column="10">/);
    assert.match(html, /<button [^>]*data-mini-app-source-file="components\/Child.jsx"[^>]*data-mini-app-source-line="2"[^>]*data-mini-app-source-column="10"/);
    assert.doesNotMatch(render(), /data-mini-app-source/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('loads a valid bundle and permits source fallback for missing, empty and old-server responses', async () => {
  const bundle = { code: 'exports.default = function App() {};', css: 'body{}' };
  assert.equal(await loadMiniAppDist({ getDist: async () => bundle }, 'app'), bundle);
  assert.equal(await loadMiniAppDist({ getDist: async () => null }, 'app'), null);
  assert.equal(await loadMiniAppDist({ getDist: async () => ({ code: '  ' }) }, 'app'), null);
  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(await loadMiniAppDist({ getDist: async () => { throw new Error('404'); } }, 'app'), null);
  } finally { console.warn = warn; }
});
