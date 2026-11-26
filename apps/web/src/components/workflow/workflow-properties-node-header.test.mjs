import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const require = createRequire(new URL('../../../package.json', import.meta.url));
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');

function load(relativePath, modules) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  runInNewContext(compiled, {
    exports,
    require(name) {
      if (name === 'react') return React;
      if (name === 'react/jsx-runtime') return require(name);
      return modules[name] ?? {};
    },
  });
  return exports;
}

test('workflow node preset menu renders a native button for Pressable', () => {
  const cx = (...values) => values.filter(Boolean).join(' ');
  const { PopoverTrigger } = load('../ui/popover.tsx', { '@/utils/cx': { cx } });
  const { NodeHeader } = load('./workflow-properties-node-header.tsx', {
    'next-intl': { useTranslations: () => key => key },
    '@/lib/utils': { cn: cx },
    '@/components/ui/input': { Input: () => React.createElement('input') },
    '@/components/base/badges/chip': { Chip: ({ children }) => React.createElement('span', null, children) },
    './workflow-node-icon': { WorkflowNodeDefinitionIcon: () => null },
    'lucide-react': { ChevronDown: () => null },
    '@/components/ui/popover': {
      Popover: ({ children }) => children,
      PopoverTrigger,
      PopoverContent: () => null,
    },
  });
  const html = renderToStaticMarkup(React.createElement(NodeHeader, {
    node: { id: 'code-node', type: 'run_code', label: 'Code' },
    data: {}, jsonPresets: [], selectedJsonPresetId: '', selectedJsonPreset: null,
  }));
  assert.match(html, /<button type="button"[^>]*><span>editor\.jsonPreset<\/span><\/button>/);
});
