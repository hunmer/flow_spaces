import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const require = createRequire(new URL('../../../package.json', import.meta.url));
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');
const compiled = ts.transpileModule(
  readFileSync(new URL('./workflow-node-handles-render.tsx', import.meta.url), 'utf8'),
  { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS } },
).outputText;

for (const handleId of ['source', 'case-0', 'default', 'output:result']) {
  test(`popover trigger preserves workflow handle ${handleId}`, () => {
    let renderedHandle;
    const onContextMenu = () => {};
    const onPointerDown = () => {};
    function Handle(props) {
      renderedHandle = props;
      return React.createElement('div', {
        'data-handleid': props.id, role: props.role,
        tabIndex: props.tabIndex, 'aria-label': props['aria-label'],
      });
    }
    const exports = {};
    runInNewContext(compiled, {
      exports,
      require(name) {
        if (name === 'react') return { ...React, default: React };
        if (name === '@xyflow/react') return { Handle };
        if (name === './workflow-node-types') return { NODE_COLORS: [] };
        if (name === '@/components/ui/popover') return {
          Popover: ({ children }) => children,
          // Simulate the props injected by React Aria's Pressable.
          PopoverTrigger: ({ render }) => React.cloneElement(render, {
            id: 'react-aria-generated-trigger', onPointerDown,
          }),
          PopoverContent: () => null,
        };
        return {};
      },
    });
    function Harness() {
      const { renderHandleColorPopover } = exports.useWorkflowNodeHandles({
        isCanvasLocked: false, handleColors: {}, handleCtx: {},
        dispatchNodeUpdate() {}, t: key => key,
      });
      return renderHandleColorPopover(handleId, React.createElement(Handle, {
        id: handleId, type: 'source', onContextMenu,
      }));
    }
    const html = renderToStaticMarkup(React.createElement(Harness));
    assert.equal(renderedHandle.id, handleId);
    assert.equal(renderedHandle.type, 'source');
    assert.equal(renderedHandle.onContextMenu, onContextMenu);
    assert.equal(renderedHandle.onPointerDown, onPointerDown);
    assert.equal(renderedHandle.role, 'button');
    assert.equal(renderedHandle.tabIndex, 0);
    assert.equal(renderedHandle['aria-label'], 'nodeUi.color');
    assert.ok(html.includes(`data-handleid="${handleId}"`));
    assert.ok(html.includes('role="button"'));
  });
}
