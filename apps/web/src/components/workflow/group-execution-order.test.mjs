import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const require = createRequire(new URL('../../../package.json', import.meta.url));
const ts = require('typescript');
const root = new URL('../../../../../packages/server/flow-spaces-data/mini-apps/game-asset-canvas/src/', import.meta.url);
const { orderBatchRunNodes } = await import(new URL('utils/batch-run.js', root));
const images = await import(new URL('utils/input-images.js', root));
const constants = await import(new URL('utils/constants.js', root));
const compile = (file) => ts.transpileModule(readFileSync(new URL(file, root), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, allowJs: true }, fileName: file,
}).outputText;
const buildExports = {};
runInNewContext(compile('hooks/useCanvasAgentRpc.js'), { exports: buildExports, window: { location: { origin: 'https://test.local' } },
  require: (name) => name.includes('constants') ? constants : { promptToText: (value) => String(value) } });

function queueHarness() {
  let index = 0; const slots = []; let effects = []; let api;
  const cancelled = [];
  const react = {
    useRef: (value) => slots[index++] ||= { current: value },
    useState: (value) => { const slot = index++; if (!(slot in slots)) slots[slot] = value;
      return [slots[slot], (next) => { slots[slot] = typeof next === 'function' ? next(slots[slot]) : next; }]; },
    useCallback: (fn) => fn, useEffect: (fn) => effects.push(fn),
  };
  const exports = {};
  runInNewContext(compile('hooks/useExecutionQueue.js'), { exports, console, window: {},
    require: (name) => name === 'react' ? react : { genId: () => 'history' } });
  function render() { index = 0; effects = []; api = exports.default({ concurrency: 3, onCancel: (job) => cancelled.push(job.id) }); return api; }
  const flush = async () => { render(); effects.forEach((fn) => fn()); await Promise.resolve(); await Promise.resolve(); render(); };
  render();
  return { get api() { return api; }, flush, render, cancelled };
}

test('拓扑顺序保留经过展示节点的依赖，汇合等待所有上游，循环拒绝执行', () => {
  const edges = [{ source: 'a', target: 'display' }, { source: 'display', target: 'b' },
    { source: 'c', target: 'b' }];
  const ordered = orderBatchRunNodes(['b', 'display', 'a', 'c'], edges);
  assert.ok(ordered.indexOf('a') < ordered.indexOf('display'));
  assert.ok(ordered.indexOf('display') < ordered.indexOf('b'));
  assert.ok(ordered.indexOf('c') < ordered.indexOf('b'));
  assert.throws(() => orderBatchRunNodes(['a', 'b'], [{ source: 'a', target: 'b' }, { source: 'b', target: 'a' }]), /循环/);
});

test('真实队列等待上游完成，清理已完成任务后依赖仍可继续', async () => {
  const h = queueHarness(); const calls = []; let finish;
  const first = h.api.submit({ execute: () => new Promise((resolve) => { calls.push('a'); finish = resolve; }) });
  const second = h.api.submit({ dependsOn: [first], execute: async () => { calls.push('b'); } });
  await h.flush(); assert.deepEqual(calls, ['a']);
  finish(); await h.flush();
  h.api.clearFinished(); h.render(); assert.ok(h.api.jobs.some((job) => job.id === first));
  await h.flush(); assert.deepEqual(calls, ['a', 'b']);
  await h.flush(); assert.equal(h.api.jobs.find((job) => job.id === second).status, 'done');
});

test('真实队列在失败或取消后停止所有后续节点', async () => {
  for (const stopped of [false, true]) {
    const h = queueHarness(); const calls = [];
    const first = h.api.submit({ execute: async () => { calls.push('a'); throw new Error('生成失败'); } });
    const second = h.api.submit({ dependsOn: [first], execute: async () => calls.push('b') });
    const third = h.api.submit({ dependsOn: [second], execute: async () => calls.push('c') });
    h.render(); if (stopped) h.api.cancel(first);
    for (let i = 0; i < 5; i++) await h.flush();
    assert.deepEqual(calls, stopped ? [] : ['a']);
    assert.equal(h.api.jobs.find((job) => job.id === third).status, 'stopped');
  }
});

function canvasHarness() {
  const source = readFileSync(new URL('components/Canvas.jsx', root), 'utf8');
  const start = source.indexOf('  const collectBatchRunNodes =');
  const end = source.indexOf('  const handleRunAllGroup', start);
  const nodes = [
    { id: 'a', type: 'textToImage', data: { params: { prompt: 'generate' }, status: 'idle' } },
    { id: 'b', type: 'editImage', data: { params: { prompt: 'edit' }, status: 'idle' } },
  ];
  const calls = []; let fail = false;
  const ctx = { useCallback: (fn) => fn, NODE_TYPES: constants.NODE_TYPES, console,
    nodesRef: { current: nodes }, decoratedNodesRef: { current: nodes },
    activeQueueNodeIdsRef: { current: new Set() }, reservedBatchNodeIdsRef: { current: new Set() },
    edgesRef: { current: [{ source: 'a', target: 'b' }] },
    groupExecution: { getExecutionTargetForNode: () => null },
    buildNodeExecution: buildExports.buildNodeExecution, ...images, orderBatchRunNodes,
    waitForCanvasState: async () => {},
    handleGenerate: async (id, type, options) => {
      calls.push({ id, input: options.input });
      const node = nodes.find((node) => node.id === id);
      node.data = { ...node.data, status: fail ? 'error' : 'done', output: { images: ['/new.png'] } };
    }, handleGenerateMedia: async () => {},
  };
  const tasks = [];
  Object.assign(ctx, {
    NODE_META: {}, toast: { success() {}, warning() {}, error() {} }, handleCancelProcess() {},
    submit: (task) => { tasks.push(task); return `job-${tasks.length}`; },
  });
  const submitStart = source.indexOf('  const submitBatchRun =');
  const submitEnd = source.indexOf('  const requestBatchRun =', submitStart);
  runInNewContext(`${source.slice(start, end)}\n${source.slice(submitStart, submitEnd)}\nthis.api = { collectBatchRunNodes, executeCurrentGroupRun, executeBatchNode, submitBatchRun };`, ctx);
  return { ...ctx.api, calls, nodes, tasks, setFail: () => { fail = true; } };
}

test('真实 Canvas 回调保留无初始图片的下游，并使用本次生成的新图片继续执行', async () => {
  const h = canvasHarness();
  assert.equal(h.collectBatchRunNodes(['b', 'a']).candidates.length, 2);
  await h.executeCurrentGroupRun(['b', 'a']);
  assert.deepEqual(h.calls.map((call) => call.id), ['a', 'b']);
  assert.deepEqual(Array.from(h.calls[1].input.images), ['https://test.local/new.png']);
});

test('分组标题批量入队按连线排序，第二节点在启动时获取新图片', async () => {
  const h = canvasHarness();
  h.submitBatchRun(['b', 'a']);
  assert.deepEqual(h.tasks.map((task) => task.placeholderNodeId), ['a', 'b']);
  assert.deepEqual(Array.from(h.tasks[1].dependsOn), ['job-1']);
  assert.deepEqual(h.calls, []);
  await h.tasks[0].execute();
  await h.tasks[1].execute();
  assert.deepEqual(Array.from(h.calls[1].input.images), ['https://test.local/new.png']);
});

test('真实 Canvas 回调在上游失败后不启动下游', async () => {
  const h = canvasHarness(); h.setFail();
  await assert.rejects(h.executeCurrentGroupRun(['a', 'b']), /失败/);
  assert.deepEqual(h.calls.map((call) => call.id), ['a']);
});
