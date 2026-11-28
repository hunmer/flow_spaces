#!/usr/bin/env node
import { readFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { build } from 'esbuild';

// 与 react-renderer 的宿主模块映射保持一致；其余依赖由 esbuild 打进 bundle。
const external = [
  'react', 'react-dom', 'react-dom/client', 'embla-carousel-react',
  '@flow-spaces/mini-app-inspector/jsx-dev-runtime',
  '@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities',
  '@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-placeholder',
  '@tiptap/extension-task-list', '@tiptap/extension-task-item',
  '@xyflow/react', '@dagrejs/dagre', 'html-to-image', '@flow-spaces/ui', 'diff', 'tiny-pinyin',
];

if (!process.argv[2]) throw new Error('Usage: pnpm mini-app:build "/absolute/path/to/mini-app"');
const projectDir = resolve(process.argv[2]);
const manifest = JSON.parse(readFileSync(join(projectDir, 'manifest.json'), 'utf8'));
if (manifest.type !== 'react') throw new Error('Component bundles currently support React mini apps only');
const srcDir = join(projectDir, 'src');
const entry = resolve(srcDir, manifest.mainFile || 'index.jsx');
if (!entry.startsWith(srcDir + sep)) throw new Error('mainFile must be inside src/');
mkdirSync(join(projectDir, 'dist'), { recursive: true });
const result = await build({
  absWorkingDir: srcDir,
  entryPoints: [entry],
  outfile: join(projectDir, 'dist/index.cjs'),
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  // 保留原始文件/行列；运行时复用宿主 React，生产宿主不注入 DOM 标记。
  jsx: 'automatic',
  jsxDev: true,
  jsxImportSource: '@flow-spaces/mini-app-inspector',
  minify: true,
  metafile: true,
  external,
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info',
});
// 移除前一次构建遗留的样式，避免删除 CSS 导入后仍加载旧样式。
if (!Object.keys(result.metafile.outputs).some((path) => path.endsWith('.css'))) {
  rmSync(join(projectDir, 'dist/index.css'), { force: true });
}
