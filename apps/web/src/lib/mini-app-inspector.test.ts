import assert from 'node:assert/strict';
import test from 'node:test';
import * as Babel from '@babel/standalone';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { miniAppInspectorPlugin } from './mini-app-inspector';

function compile(source: string, filePath: string, requireModule: (id: string) => unknown = () => undefined) {
  const code = Babel.transform(source, {
    filename: filePath,
    presets: ['react'],
    plugins: [miniAppInspectorPlugin('app-1', filePath), 'transform-modules-commonjs'],
  }).code!;
  const exports: { default?: React.ComponentType } = {};
  new Function('React', 'exports', 'require', code)(React, exports, requireModule);
  return exports;
}

test('entry and imported components retain their own source file, line and column', () => {
  const child = compile('export default function Child() {\n  return <button><span>child</span></button>;\n}', 'components/Child.jsx');
  const entry = compile("import Child from './components/Child';\nexport default function App() {\n  return <main><Child /></main>;\n}", 'index.jsx', () => child);
  const html = renderToStaticMarkup(React.createElement(entry.default!));
  assert.match(html, /<main data-mini-app-source-project="app-1" data-mini-app-source-file="index.jsx" data-mini-app-source-line="3" data-mini-app-source-column="10">/);
  assert.match(html, /<button data-mini-app-source-project="app-1" data-mini-app-source-file="components\/Child.jsx" data-mini-app-source-line="2" data-mini-app-source-column="10">/);
  assert.match(html, /<span [^>]*data-mini-app-source-column="18">child/);
});

test('marks native elements through fragments and spreads without adding props to custom components', () => {
  const entry = compile(`
    function Guard(props) {
      if (Object.keys(props).some(key => key.startsWith('data-mini-app-source'))) throw new Error('Unexpected inspector props');
      return <svg><path d="M0 0" /></svg>;
    }
    export default function App() {
      return <><div {...{'data-mini-app-source-file': 'wrong.jsx'}} /><Guard /></>;
    }
  `, 'index.jsx');
  const html = renderToStaticMarkup(React.createElement(entry.default!));
  assert.doesNotMatch(html, /wrong\.jsx/);
  assert.match(html, /<svg [^>]*data-mini-app-source-file="index.jsx"/);
  assert.match(html, /<path [^>]*data-mini-app-source-file="index.jsx"/);
});
