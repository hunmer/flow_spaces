import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const require = createRequire(new URL('../../../package.json', import.meta.url));
const ts = require('typescript');
const source = readFileSync(new URL('./workflow-group-node.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS },
}).outputText;

function setup() {
  let effects = [];
  const handles = [];
  const stateUpdates = [];
  const document = Object.assign(new EventTarget(), {
    querySelectorAll: () => handles.filter((handle) => !handle.disabled),
    elementsFromPoint: () => [],
  });
  class Element {
    constructor(id) { this.id = id; }
    closest() { return this; }
    getAttribute() { return this.id; }
  }
  class Button extends EventTarget {
    captured = false;
    constructor(props) {
      super();
      this.disabled = props.disabled;
      this.dataset = { groupConnectId: props['data-group-connect-id'] };
    }
    getBoundingClientRect() { return this.rect || { left: 96, right: 116, top: 96, bottom: 116, width: 20, height: 20 }; }
    closest() { return null; }
    getAttribute(name) { return name === 'data-handleid' ? (this.handleId ?? null) : null; }
    setPointerCapture() { this.captured = true; }
    hasPointerCapture() { return this.captured; }
    releasePointerCapture() { this.captured = false; }
  }
  const React = {
    createElement(type, props, ...children) {
      if (type === 'button') {
        const element = new Button(props);
        if (props.ref) props.ref.current = element;
        if (props['data-group-connect-id']) handles.push(element);
        props = { ...props, element };
      }
      return { type, props: props || {}, children: children.flat(Infinity) };
    },
    useState: (value) => [value, (next) => stateUpdates.push(next)],
    useMemo: (factory) => factory(),
    useCallback: (callback) => callback,
    useRef: (current) => ({ current }),
    useEffect: (effect) => effects.push(effect),
  };
  const exports = {};
  runInNewContext(compiled, {
    exports, document, Element, CustomEvent,
    require: (name) => {
      if (name === 'react') return { ...React, default: React };
      if (name === 'react-dom') return { createPortal: (node) => node };
      if (name === 'next-intl') return { useTranslations: () => (key) => key };
      return {};
    },
  });
  function mount(id, overrides = {}) {
    effects = [];
    const tree = exports.WorkflowGroupOverlay({
      group: { id, name: id, childNodeIds: ['inside'], locked: false },
      childNodes: [], collapsed: false, isSelected: false, isDropTarget: false,
      ...overrides,
    });
    const cleanups = effects.map((effect) => effect()).filter(Boolean);
    const buttons = [];
    function visit(node) {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'button') buttons.push(node);
      node.children?.forEach(visit);
    }
    visit(tree);
    return {
      input: buttons.find((button) => button.props['data-group-connect-id']),
      output: buttons.find((button) => button.props['aria-label'] === 'connectTooltip'),
      unmount: () => cleanups.forEach((cleanup) => cleanup()),
    };
  }
  function start(output) {
    output.props.onPointerDown({
      button: 0, pointerId: 1, clientX: 106, clientY: 106,
      currentTarget: output.props.element, preventDefault() {}, stopPropagation() {},
    });
  }
  function pointer(type, x = 106, y = 106, pointerId = 1) {
    const event = new Event(type);
    Object.assign(event, { clientX: x, clientY: y, pointerId });
    document.dispatchEvent(event);
  }
  function addNodeHandle(id, x, y) {
    const handle = new Button({});
    handle.closest = () => new Element(id);
    handle.rect = { left: x - 10, top: y - 10, width: 20, height: 20 };
    handles.push(handle);
    return handle;
  }
  return { document, Element, mount, start, pointer, addNodeHandle, stateUpdates };
}

test('默认隐藏连接点；启用后左侧接收、右侧拖出', () => {
  const { mount } = setup();
  assert.equal(mount('default').input, undefined);
  assert.equal(mount('default').output, undefined);
  const group = mount('enabled', { handlesEnabled: true, onReceiveConnect() {} });
  assert.ok(group.input);
  assert.ok(group.output);
  assert.equal(group.input.props.style.top, 0);
  assert.equal(group.input.props.style.left, 0);
  assert.equal(group.output.props.style.top, 0);
  assert.equal(group.output.props.style.right, 0);
});

test('输出拖入输入时由接收分组回调绑定，且不会再连到下层节点', () => {
  const { mount, start, pointer, document, Element } = setup();
  const received = [];
  const nodes = [];
  const fallback = [];
  const target = mount('target', {
    handlesEnabled: true, onReceiveConnect: (...args) => received.push(args),
  });
  const source = mount('source', {
    handlesEnabled: true, onConnect: (...args) => nodes.push(args),
    onConnectGroup: (...args) => fallback.push(args),
  });
  document.elementsFromPoint = () => [new Element('behind')];
  start(source.output);
  pointer('pointerup');
  assert.deepEqual(received, [['target', 'source']]);
  assert.deepEqual(nodes, []);
  assert.deepEqual(fallback, []);
  assert.equal(source.output.props.element.captured, false);
  target.unmount();
  source.unmount();
});

test('输出可连组外节点，拒绝组内节点与空白落点', () => {
  const { mount, start, pointer, document, Element } = setup();
  const connected = [];
  const group = mount('source', { handlesEnabled: true, onConnect: (...args) => connected.push(args) });
  for (const id of ['outside', 'inside', null]) {
    document.elementsFromPoint = () => id ? [new Element(id)] : [];
    start(group.output);
    pointer('pointerup', 300, 300);
  }
  assert.deepEqual(connected, [['source', 'outside']]);
});

test('锁定或执行中禁用连接；取消、卸载和其他指针不会误触连接', () => {
  const { mount, start, pointer, document, Element } = setup();
  const connected = [];
  document.elementsFromPoint = () => [new Element('outside')];
  for (const overrides of [{ handlesDisabled: true }, { group: { id: 'locked', locked: true, childNodeIds: [] } }]) {
    const group = mount('source', { handlesEnabled: true, onReceiveConnect() {}, onConnect: (...args) => connected.push(args), ...overrides });
    assert.equal(group.input.props.disabled, true);
    assert.equal(group.output.props.disabled, true);
    start(group.output);
    pointer('pointerup', 300, 300);
    group.unmount();
  }
  const group = mount('source', { handlesEnabled: true, onConnect: (...args) => connected.push(args) });
  start(group.output);
  pointer('pointerup', 300, 300, 2);
  assert.equal(group.output.props.element.captured, true);
  pointer('pointercancel');
  pointer('pointerup', 300, 300);
  start(group.output);
  group.unmount();
  pointer('pointerup', 300, 300);
  assert.equal(group.output.props.element.captured, false);
  assert.deepEqual(connected, []);
});


test('靠近分组输入点时吸附预览，松手连接最近目标', () => {
  const { mount, start, pointer, stateUpdates } = setup();
  const received = [];
  mount('far', { handlesEnabled: true, onReceiveConnect: (...args) => received.push(args) });
  const near = mount('near', { handlesEnabled: true, onReceiveConnect: (...args) => received.push(args) });
  near.input.props.element.rect = { left: 210, top: 90, width: 20, height: 20 };
  const source = mount('source', { handlesEnabled: true, connectionRadius: 160 });
  start(source.output);
  pointer('pointermove', 250, 100);
  assert.equal(stateUpdates.at(-1).x, 220);
  assert.equal(stateUpdates.at(-1).y, 100);
  pointer('pointerup', 250, 100);
  assert.deepEqual(received, [['near', 'source']]);
});

test('支持吸附普通节点输入点，并排除组内节点和超出半径的点', () => {
  const { mount, start, pointer, addNodeHandle, stateUpdates } = setup();
  const connected = [];
  addNodeHandle('outside', 400, 200);
  addNodeHandle('inside', 490, 200);
  const source = mount('source', {
    handlesEnabled: true, connectionRadius: 160, onConnect: (...args) => connected.push(args),
  });
  start(source.output);
  pointer('pointermove', 500, 200);
  assert.equal(stateUpdates.at(-1).x, 400);
  pointer('pointerup', 500, 200);
  assert.deepEqual(connected, [['source', 'outside', null]]);
  start(source.output);
  pointer('pointermove', 561, 200);
  assert.equal(stateUpdates.at(-1).x, 561);
  pointer('pointerup', 561, 200);
  assert.equal(connected.length, 1);
});

test('禁用的分组输入不参与吸附，且连接目标限制在当前画布', () => {
  const { mount, start, pointer, addNodeHandle } = setup();
  const received = [];
  mount('disabled', { handlesEnabled: true, handlesDisabled: true, onReceiveConnect: (...args) => received.push(args) });
  const connected = [];
  const source = mount('source', { handlesEnabled: true, connectionRadius: 160, onConnect: (...args) => connected.push(args) });
  const localHandle = addNodeHandle('local', 600, 200);
  addNodeHandle('other-canvas', 500, 200);
  source.output.props.element.closest = () => ({ querySelectorAll: () => [localHandle] });
  start(source.output);
  pointer('pointerup', 500, 200);
  assert.deepEqual(connected, [['source', 'local', null]]);
  assert.deepEqual(received, []);
});


test('实际分组操作回调为叶子输出建立指向指定输入点的边', async () => {
  const miniAppRoot = new URL('../../../../../packages/server/flow-spaces-data/mini-apps/game-asset-canvas/src/', import.meta.url);
  const helpers = await import(new URL('utils/group-helpers.js', miniAppRoot));
  const hookSource = readFileSync(new URL('hooks/useGroupOperations.js', miniAppRoot), 'utf8');
  const hookCode = ts.transpileModule(hookSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, allowJs: true },
    fileName: 'useGroupOperations.js',
  }).outputText;
  const exports = {};
  const react = {
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
    useRef: (current) => ({ current }),
    useState: (value) => [value, () => {}],
  };
  runInNewContext(hookCode, {
    exports,
    require(name) {
      if (name === 'react') return react;
      if (name === '@xyflow/react') return { addEdge: (edge, edges) => [...edges, edge], MarkerType: { ArrowClosed: 'arrowclosed' } };
      if (name.includes('group-helpers')) return helpers;
      return {};
    },
  });
  let edges = [{ source: 'a', target: 'b' }];
  const api = exports.default({
    groups: [{ id: 'group', childNodeIds: ['a', 'b'], childGroupIds: [] }],
    nodes: [{ id: 'a', position: { x: 0, y: 0 } }, { id: 'b', position: { x: 100, y: 0 } }],
    edges, setGroups() {}, setNodes() {},
    setEdges(update) { edges = update(edges); },
    reactFlow: {}, canvasRef: { current: null },
  });
  api.handleGroupConnect('group', 'target', 'target-top');
  assert.equal(edges.length, 2);
  assert.equal(edges[1].source, 'b');
  assert.equal(edges[1].target, 'target');
  assert.equal(edges[1].targetHandle, 'target-top');
  assert.equal(edges[1].data.sourceGroupId, 'group');
  api.handleGroupConnect('group', 'target', null);
  assert.equal(edges.length, 2);
  assert.equal(edges[1].data.sourceGroupId, 'group');
});

test('FloatingEdge 实际路径采用分组输出坐标，并保留目标坐标', () => {
  const filename = new URL('../../../../../packages/server/flow-spaces-data/mini-apps/game-asset-canvas/src/components/canvas/FloatingEdge.jsx', import.meta.url);
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, allowJs: true }, fileName: 'FloatingEdge.jsx',
  }).outputText;
  const exports = {};
  let pathOptions;
  runInNewContext(compiled, {
    exports,
    React: { createElement: () => null },
    require: (name) => name === '@xyflow/react' ? {
      getBezierPath: (options) => { pathOptions = options; return ['path', 0, 0]; },
      getSmoothStepPath: (options) => { pathOptions = options; return ['path', 0, 0]; },
    } : {},
  });
  exports.default({
    id: 'edge', sourceX: 10, sourceY: 20, sourcePosition: 'bottom',
    targetX: 800, targetY: 500, targetPosition: 'top',
    data: { groupSourcePosition: { x: 670, y: 142 } },
  });
  assert.equal(pathOptions.sourceX, 670);
  assert.equal(pathOptions.sourceY, 142);
  assert.equal(pathOptions.sourcePosition, 'right');
  assert.equal(pathOptions.targetX, 800);
  assert.equal(pathOptions.targetY, 500);
  assert.equal(pathOptions.targetPosition, 'top');
});

function setupBindingEdge({ sourceGroup = false, busy = false } = {}) {
  const root = new URL('../../../../../packages/server/flow-spaces-data/mini-apps/game-asset-canvas/src/components/canvas/', import.meta.url);
  let selected = null;
  const events = [];
  const listeners = new Map();
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity).filter(Boolean) }),
    useState: () => [selected, (value) => { selected = value; }],
    useEffect: (effect) => effect(),
  };
  const load = (file, dependencies) => {
    const exports = {};
    const compiled = ts.transpileModule(readFileSync(new URL(file, root), 'utf8'), {
      compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, allowJs: true }, fileName: file,
    }).outputText;
    runInNewContext(compiled, {
      exports, React: react,
      document: { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name) => listeners.delete(name) },
      window: { dispatchEvent: (event) => events.push(event.type) },
      CustomEvent: class { constructor(type) { this.type = type; } },
      require: (name) => dependencies[name] || {},
    });
    return exports;
  };
  const FloatingEdge = load('FloatingEdge.jsx', {
    '@xyflow/react': { getBezierPath: () => ['path', 0, 0], getSmoothStepPath: () => ['path', 0, 0] },
  }).default;
  const { GroupBindingEdges } = load('GroupOverlays.jsx', {
    react, './FloatingEdge': { default: FloatingEdge },
  });
  const target = { id: 'target-group', batchExecution: { assets: { binding: sourceGroup ? { sourceGroupId: 'source-group' } : { sourceNodeId: 'source' } } } };
  const disconnected = [];
  const props = {
    items: [{ group: target, childNodes: [] }, { group: { id: 'source-group' }, childNodes: [] }],
    nodes: [{ id: 'source', position: { x: 0, y: 0 } }],
    runningGroupIds: new Set(busy ? ['target-group'] : []),
    onDisconnect: (id) => { disconnected.push(id); target.batchExecution.assets.binding = null; },
  };
  const find = (tree, predicate) => !tree || typeof tree !== 'object' ? [] : [
    ...(predicate(tree) ? [tree] : []), ...(tree.children || []).flatMap((child) => find(child, predicate)),
  ];
  const renderEdge = () => {
    const element = find(GroupBindingEdges(props), (node) => node.type === FloatingEdge)[0];
    return element ? FloatingEdge(element.props) : null;
  };
  const click = { stopPropagation() {} };
  return { FloatingEdge, renderEdge, find, click, disconnected, events, listeners };
}

for (const sourceGroup of [false, true]) {
  test(`${sourceGroup ? '分组' : '节点'}输入绑定复用 FloatingEdge，点击选中后可删除并解除绑定`, () => {
    const h = setupBindingEdge({ sourceGroup });
    let tree = h.renderEdge();
    const hit = h.find(tree, (node) => node.props.className?.includes('react-flow__edge-interaction'))[0];
    assert.equal(hit.props.style.pointerEvents, 'stroke');
    hit.props.onClick(h.click);
    tree = h.renderEdge();
    const buttons = h.find(tree, (node) => node.type === 'button');
    assert.equal(buttons.length, 1);
    assert.equal(buttons[0].props.title, '删除连接');
    buttons[0].props.onClick(h.click);
    assert.deepEqual(h.disconnected, ['target-group']);
    assert.equal(h.renderEdge(), null);
    assert.deepEqual(h.events, []);
  });
}

test('输入边点击空白取消选中；执行中的绑定不显示删除按钮', () => {
  const h = setupBindingEdge();
  h.find(h.renderEdge(), (node) => node.props.className?.includes('react-flow__edge-interaction'))[0].props.onClick(h.click);
  h.renderEdge();
  h.listeners.get('pointerdown')({ target: {} });
  assert.equal(h.find(h.renderEdge(), (node) => node.type === 'button').length, 0);
  const busy = setupBindingEdge({ busy: true });
  busy.find(busy.renderEdge(), (node) => node.props.className?.includes('react-flow__edge-interaction'))[0].props.onClick(busy.click);
  assert.equal(busy.find(busy.renderEdge(), (node) => node.type === 'button').length, 0);
});

test('普通 FloatingEdge 保留选择/删除事件及原有三个操作按钮', () => {
  const h = setupBindingEdge();
  const tree = h.FloatingEdge({ id: 'normal', sourceX: 0, sourceY: 0, targetX: 100, targetY: 100, selected: true });
  h.find(tree, (node) => node.props.className?.includes('react-flow__edge-interaction'))[0].props.onClick(h.click);
  const buttons = h.find(tree, (node) => node.type === 'button');
  assert.equal(buttons.length, 3);
  buttons.find((node) => node.props.title === '删除连接').props.onClick(h.click);
  assert.deepEqual(h.events, ['workflow:select-edge', 'workflow:delete-edge']);
});

test('分组输入文案位于组件实际读取的 group 命名空间', () => {
  for (const locale of ['zh', 'en']) {
    const messages = JSON.parse(readFileSync(new URL(`../../locales/${locale}/workflows.json`, import.meta.url), 'utf8'));
    assert.equal(typeof messages.group.inputHandle, 'string');
    assert.ok(messages.group.inputHandle.length > 0);
    assert.equal(messages.menubar.inputHandle, undefined);
  }
});

test('吸附命中顶部输入时透传真实 targetHandle', () => {
  const { mount, start, pointer, addNodeHandle } = setup();
  const connected = [];
  const handle = addNodeHandle('outside', 400, 200);
  handle.handleId = 'target-top';
  const source = mount('source', { handlesEnabled: true, connectionRadius: 160, onConnect: (...args) => connected.push(args) });
  start(source.output);
  pointer('pointerup', 500, 200);
  assert.deepEqual(connected, [['source', 'outside', 'target-top']]);
});
