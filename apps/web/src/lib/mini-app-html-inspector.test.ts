import assert from 'node:assert/strict';
import test from 'node:test';
import { annotateMiniAppHtml } from './mini-app-html-inspector';

test('HTML markers use original CRLF line/column and preserve scripts, comments and quoted attributes', () => {
  const html = '<!doctype html>\r\n<html><head>\r\n<script type="module">const template = "<button>fake</button>";</script>\r\n<style>p::before { content: "<a>"; }</style></head>\r\n<body><!-- <button>comment</button> -->\r\n  <button title="a > b"><span>play</span></button></body></html>';
  const marked = annotateMiniAppHtml(html, 'app-1', 'pages/player.html');
  assert.match(marked, /<button data-mini-app-source-project="app-1" data-mini-app-source-file="pages\/player.html" data-mini-app-source-line="6" data-mini-app-source-column="3" title="a > b">/);
  assert.match(marked, /const template = "<button>fake<\/button>";/);
  assert.equal(marked.replace(/ data-mini-app-source-(?:project|file|line|column)="[^"]*"/g, ''), html);
});

test('HTML fragments mark templates and SVG without inventing positions for implicit nodes', () => {
  const html = '<template><button>template</button></template>\n<svg><linearGradient id="g" /></svg>\n<input disabled><image src="x">';
  const marked = annotateMiniAppHtml(html, 'app"<&', 'file".html');
  assert.match(marked, /<button data-mini-app-source-project="app&quot;&lt;&amp;"/);
  assert.match(marked, /<linearGradient data-mini-app-source-project=/);
  assert.match(marked, /<input [^>]*data-mini-app-source-line="3"[^>]*data-mini-app-source-column="1" disabled>/);
  assert.match(marked, /<image data-mini-app-source-project=/);
  assert.equal(marked.replace(/ data-mini-app-source-(?:project|file|line|column)="[^"]*"/g, ''), html);
});
