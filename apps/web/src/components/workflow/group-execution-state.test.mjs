import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const require = createRequire(new URL('../../../package.json', import.meta.url));
const ts = require('typescript');
const root = new URL('../../../../../packages/server/flow-spaces-data/mini-apps/game-asset-canvas/src/', import.meta.url);
const executionUtils = await import(new URL('utils/group-execution.js', root));
const helpers = await import(new URL('utils/group-helpers.js', root));
const updates = await import(new URL('utils/canvas-state-updates.js', root));
const clone = (value) => JSON.parse(JSON.stringify(value));
const compile = (file) => ts.transpileModule(readFileSync(new URL(file, root), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, allowJs: true }, fileName: file,
}).outputText;

function harness() {
  let index = 0;
  const slots = [];
  let effects = [];
  let api;
  let sequence = 0;
  const node = { id: 'node', type: 'editImage', data: { params: { prompt: 'original', size: '1k' }, status: 'idle', uploadedImages: ['a.png'] } };
  const execution = executionUtils.ensureGroupExecution({ mode: 'assets', assets: {
    activeId: 'a', templateNodeStates: { node: clone(node.data) },
    runs: ['a', 'b'].map((id) => ({ id, url: `${id}.png`, nodeStates: { node: { ...clone(node.data), uploadedImages: [`${id}.png`] } } })),
  } }, [node], ['node'], 'group');
  const state = {
    nodes: [node], edges: [],
    groups: [{ id: 'group', childNodeIds: ['node'], childGroupIds: [], batchExecution: execution }],
  };
  const react = {
    useRef: (value) => slots[index++] ||= { current: value },
    useState: (value) => {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = value;
      return [slots[slot], (next) => { slots[slot] = typeof next === 'function' ? next(slots[slot]) : next; }];
    },
    useMemo: (fn) => fn(), useCallback: (fn) => fn,
    useEffect: (effect) => effects.push(effect),
  };
  const exports = {};
  runInNewContext(compile('hooks/useGroupExecution.js'), {
    exports, console, setTimeout,
    requestAnimationFrame: (fn) => queueMicrotask(() => { render(); fn(); }),
    require: (name) => ({
      react, '../utils/group-execution': executionUtils,
      '../utils/group-helpers': helpers, '../utils/canvas-state-updates': updates,
      '../utils/canvas-id': { genId: () => `id-${++sequence}` },
    })[name] || {},
  });
  function render() {
    index = 0; effects = [];
    api = exports.default({ ...state, updateCanvasData: (request) => {
      const collection = `${request.targetType}s`;
      state[collection] = updates.applyCanvasCollectionUpdate(state[collection], request);
    } });
    return api;
  }
  render();
  return {
    state, render, get api() { return api; },
    flushEffects: () => effects.forEach((effect) => effect()),
    edit: (prompt) => { state.nodes = state.nodes.map((n) => n.id === 'node' ? { ...n, data: { ...n.data, params: { ...n.data.params, prompt } } } : n); render(); },
  };
}

test('切换素材先保存当前表单，每个素材编辑值可独立恢复', () => {
  const h = harness();
  h.edit('edited-a');
  h.api.switchRun('group', 'assets', 'b'); h.render();
  assert.equal(h.state.nodes[0].data.params.prompt, 'original');
  h.edit('edited-b');
  h.api.switchRun('group', 'assets', 'a'); h.render();
  assert.equal(h.state.nodes[0].data.params.prompt, 'edited-a');
  h.api.switchRun('group', 'assets', 'b'); h.render();
  assert.equal(h.state.nodes[0].data.params.prompt, 'edited-b');
});

test('执行状态回写保留当前表单；后台素材更新不覆盖当前显示', () => {
  const h = harness();
  h.edit('edited');
  const a = h.api.getExecutionTargetForNode('node');
  h.api.updateExecutionNodeData(a, { status: 'running' }); h.render();
  assert.equal(h.state.nodes[0].data.params.prompt, 'edited');
  h.api.switchRun('group', 'assets', 'b'); h.render();
  h.edit('edited-b');
  h.api.updateExecutionNodeData(a, { status: 'cancelled', loading: false }); h.render();
  assert.equal(h.state.nodes[0].data.params.prompt, 'edited-b');
  assert.notEqual(h.state.nodes[0].data.status, 'cancelled');
  assert.equal(h.api.getExecutionNodeData(a).status, 'cancelled');
});

test('应用到其他实例仅复制一次，后续编辑独立且不修改模板', () => {
  const h = harness();
  h.edit('copy-once');
  h.api.requestPropertyApply('node'); h.render();
  h.api.applyPropertiesToRuns(['params.prompt']); h.render();
  h.edit('after-copy');
  h.api.switchRun('group', 'assets', 'b'); h.render();
  assert.equal(h.state.nodes[0].data.params.prompt, 'copy-once');
  assert.equal(h.state.groups[0].batchExecution.assets.templateNodeStates.node.params.prompt, 'original');
  h.edit('independent-b');
  h.api.switchRun('group', 'assets', 'a'); h.render();
  assert.equal(h.state.nodes[0].data.params.prompt, 'after-copy');
  h.api.switchRun('group', 'assets', 'b'); h.render();
  assert.equal(h.state.nodes[0].data.params.prompt, 'independent-b');
});

test('批量运行读取各素材独立表单，结束后恢复原素材编辑值', async () => {
  const h = harness();
  h.edit('prompt-a');
  h.api.switchRun('group', 'assets', 'b'); h.render(); h.edit('prompt-b');
  const prompts = [];
  await h.api.runAllRuns('group', ['a', 'b'], async (_ids, runId) => {
    prompts.push([runId, h.state.nodes[0].data.params.prompt]);
    h.api.updateExecutionNodeData(h.api.getExecutionTargetForNode('node', runId), { status: 'done' });
  });
  h.render();
  assert.deepEqual(prompts, [['a', 'prompt-a'], ['b', 'prompt-b']]);
  assert.equal(h.state.nodes[0].data.params.prompt, 'prompt-b');
  assert.equal(h.api.runAllStates.group.running, false);
});

test('上游增加素材不重置已有实例表单与输出', () => {
  const h = harness();
  const group = h.state.groups[0];
  group.batchExecution.assets.binding = { sourceNodeId: 'source' };
  group.batchExecution.assets.runs[0].id = 'group-output-source-1';
  group.batchExecution.assets.activeId = 'group-output-source-1';
  h.state.nodes.push({ id: 'source', type: 'textToImage', data: { output: { images: ['a.png', 'new.png'] } } });
  h.edit('preserve-edits');
  h.state.nodes[0].data.output = { images: ['result.png'] };
  h.render(); h.flushEffects(); h.render();
  assert.equal(h.state.nodes[0].data.params.prompt, 'preserve-edits');
  assert.deepEqual(h.state.nodes[0].data.output.images, ['result.png']);
  assert.equal(h.state.groups[0].batchExecution.assets.runs.length, 2);
});

test('节点表单更新回调写入当前执行实例，不再只更新画布', () => {
  const exports = {};
  runInNewContext(compile('hooks/useNodeExecutions.js'), { exports, require: (name) => name === 'react' ? { useCallback: (fn) => fn } : {} });
  const calls = [];
  const target = { nodeId: 'instance' };
  const api = exports.default({ settings: {}, getExecutionTargetForNode: () => target,
    updateNodeData: () => assert.fail('不应仅写画布'), updateExecutionNodeData: (t, patch) => calls.push([t, patch]) });
  const patch = { params: { prompt: 'new' } };
  api.makeOnUpdate('node')(patch);
  assert.equal(calls[0][0], target);
  assert.equal(calls[0][1], patch);
});

test('取消操作按当前实例匹配队列任务并结束队列运行状态', () => {
  const source = readFileSync(new URL('components/Canvas.jsx', root), 'utf8');
  const start = source.indexOf('const handleScopedCancelProcess = useCallback(');
  const end = source.indexOf('\n  const { handleAutoSize', start);
  const calls = [];
  const exports = {};
  runInNewContext(`${source.slice(start, end)}\nexports.cancel = handleScopedCancelProcess;`, {
    exports, console, useCallback: (fn) => fn,
    groupExecution: { getExecutionTargetForNode: () => ({ nodeId: 'current-instance' }) },
    jobs: [{ id: 'current', status: 'running', executionNodeId: 'current-instance' }, { id: 'other', status: 'running', executionNodeId: 'other-instance' }],
    cancel: (id) => calls.push(id), handleCancelProcess: () => assert.fail('应通过队列取消'),
  });
  exports.cancel('node');
  assert.deepEqual(calls, ['current']);
});

test('工作流取消立即清理 loading 并使用执行实例身份中断', () => {
  const exports = {};
  const calls = [];
  const handle = { executionId: 'workflow' };
  runInNewContext(compile('hooks/useNodeExecutions.js'), {
    exports, window: { AgentSpaces: { stopWorkflow: (id) => calls.push(id) } },
    require: (name) => name === 'react' ? { useCallback: (fn) => fn }
      : name.includes('processing-controllers') ? { getWorkflowHandle: () => handle, markWorkflowAborted: (id) => calls.push(id) } : {},
  });
  let patch;
  const api = exports.default({ settings: {}, updateExecutionNodeData: (_target, value) => { patch = value; } });
  api.handleCancelProcess('node', { nodeId: 'instance' });
  assert.deepEqual(calls, ['instance', 'workflow']);
  assert.equal(patch.status, 'cancelled');
  assert.equal(patch.loading, false);
});


test('分组级应用复制所有节点表单，保留目标素材、产出、状态与模板', () => {
  const h = harness();
  const execution = h.state.groups[0].batchExecution;
  h.state.groups[0].childNodeIds.push('second');
  h.state.nodes.push({ id: 'second', type: 'textToImage', data: {
    params: { prompt: 'second-new' }, status: 'done', output: { images: ['source-output'] },
    versions: [{ output: { images: ['source-old-output'] } }],
  } });
  execution.assets.runs[1].nodeStates.second = {
    params: { prompt: 'second-old' }, status: 'idle', output: { images: ['target-output'] },
    versions: [{ output: { images: ['target-old-output'] } }],
  };
  h.edit('first-new');
  h.state.nodes[0].data.groupAssetInputUrls = ['a.png'];
  execution.assets.runs[1].nodeStates.node.groupAssetInputUrls = ['b.png'];
  h.render();
  assert.equal(h.api.applyGroupProperties('group'), 1); h.render();
  const target = h.state.groups[0].batchExecution.assets.runs[1].nodeStates;
  assert.equal(target.node.params.prompt, 'first-new');
  assert.deepEqual(target.node.uploadedImages, ['b.png']);
  assert.equal(target.second.params.prompt, 'second-new');
  assert.equal(target.second.status, 'idle');
  assert.deepEqual(target.second.output.images, ['target-output']);
  assert.deepEqual(target.second.versions[0].output.images, ['target-old-output']);
  assert.equal(h.state.groups[0].batchExecution.assets.templateNodeStates.node.params.prompt, 'original');
  h.edit('later-edit');
  h.api.switchRun('group', 'assets', 'b'); h.render();
  assert.equal(h.state.nodes[0].data.params.prompt, 'first-new');
});

test('分组运行中不应用表单；次数模式也支持整组一次性应用', () => {
  const h = harness();
  h.state.nodes[0].data.status = 'running'; h.render();
  assert.equal(h.api.applyGroupProperties('group'), undefined);
  assert.equal(h.state.groups[0].batchExecution.assets.runs[1].nodeStates.node.params.prompt, 'original');
  h.state.nodes[0].data.status = 'idle';
  const execution = h.state.groups[0].batchExecution;
  execution.mode = 'count';
  execution.count = { activeId: 'one', runs: ['one', 'two'].map((id) => ({ id, nodeStates: { node: { params: { prompt: 'old' } } } })) };
  h.edit('count-form');
  assert.equal(h.api.applyGroupProperties('group'), 1); h.render();
  assert.equal(h.state.groups[0].batchExecution.count.runs[1].nodeStates.node.params.prompt, 'count-form');
});


test('分组标题按钮调用整组应用并在运行中禁用', () => {
  const exports = {};
  const calls = [];
  const react = {
    useState: (value) => [typeof value === 'function' ? value() : value, () => {}],
    useEffect: () => {},
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    Fragment: 'fragment',
  };
  const ui = { WorkflowGroupOverlay: 'overlay', Copy: 'copy', Play: 'play', toast: { success: () => {} } };
  const code = ts.transpileModule(readFileSync(new URL('components/canvas/GroupOverlays.jsx', root), 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, allowJs: true }, fileName: 'GroupOverlays.jsx',
  }).outputText;
  runInNewContext(code, { exports, React: react, require: (name) => name === 'react' ? react : name === '@flow-spaces/ui' ? ui : {} });
  const h = harness();
  const props = { items: [{ group: h.state.groups[0], childNodes: h.state.nodes }], groups: h.state.groups,
    nodes: h.state.nodes, runningGroupIds: new Set(), inputSlotCounts: new Map(),
    onApplyGroupProperties: (id) => { calls.push(id); return 1; } };
  const find = (tree, predicate) => {
    if (!tree || typeof tree !== 'object') return null;
    if (Array.isArray(tree)) { for (const child of tree) { const found = find(child, predicate); if (found) return found; } return null; }
    if (predicate(tree)) return tree;
    return find(tree.props?.children, predicate);
  };
  const button = (props) => {
    const overlay = find(exports.default(props), (el) => el.type === 'overlay');
    return find(overlay.props.headerRight, (el) => el.type === 'button');
  };
  assert.equal(button(props).props.disabled, false);
  button(props).props.onClick({ stopPropagation() {} });
  assert.deepEqual(calls, ['group']);
  props.runningGroupIds.add('group');
  assert.equal(button(props).props.disabled, true);
});
