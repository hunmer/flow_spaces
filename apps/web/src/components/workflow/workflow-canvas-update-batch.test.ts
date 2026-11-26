import assert from 'node:assert/strict';
import test from 'node:test';
import type { Node } from '@xyflow/react';
import { applyRuntimeNodeSizes, createWorkflowFrameBatch } from './workflow-canvas-update-batch';

function createFrames() {
  let nextId = 0;
  const callbacks = new Map<number, FrameRequestCallback>();
  return {
    request: (callback: FrameRequestCallback) => {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    },
    cancel: (id: number) => { callbacks.delete(id); },
    count: () => callbacks.size,
    flush: () => {
      const current = Array.from(callbacks.values());
      callbacks.clear();
      current.forEach(callback => callback(0));
    },
  };
}

test('mode switch batches 200 node internals requests into one update per frame', () => {
  const frames = createFrames();
  const calls: string[][] = [];
  const batch = createWorkflowFrameBatch<undefined>(
    updates => calls.push(Array.from(updates.keys())), frames.request, frames.cancel,
  );
  for (let i = 0; i < 200; i++) {
    batch.enqueue(`node-${i}`, undefined);
    batch.enqueue(`node-${i}`, undefined);
  }
  assert.equal(frames.count(), 1);
  assert.equal(calls.length, 0);
  frames.flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].length, 200);
  assert.equal(frames.count(), 0);

  // 后续属性高度变化仍应重新测量，不能只刷新模式切换的第一帧。
  batch.enqueue('node-0', undefined);
  frames.flush();
  assert.deepEqual(calls[1], ['node-0']);
});

test('multiple measurements for a node keep only its latest size', () => {
  const frames = createFrames();
  let result = new Map<string, number>();
  const batch = createWorkflowFrameBatch<number>(updates => { result = updates; }, frames.request, frames.cancel);
  batch.enqueue('a', 100);
  batch.enqueue('b', 200);
  batch.enqueue('a', 150);
  frames.flush();
  assert.deepEqual([...result], [['a', 150], ['b', 200]]);
});

test('effect cleanup removes unmounted nodes without canceling other node updates', () => {
  const frames = createFrames();
  const calls: string[][] = [];
  const batch = createWorkflowFrameBatch<undefined>(
    updates => calls.push([...updates.keys()]), frames.request, frames.cancel,
  );
  const removeA = batch.enqueue('a', undefined);
  batch.enqueue('b', undefined);
  removeA();
  frames.flush();
  assert.deepEqual(calls, [['b']]);
  const removeB = batch.enqueue('b', undefined);
  removeB();
  assert.equal(frames.count(), 0);
});

test('stale effect cleanup does not remove a newer request for the same node', () => {
  const frames = createFrames();
  const calls: number[] = [];
  const batch = createWorkflowFrameBatch<number>(updates => calls.push(updates.get('a')!), frames.request, frames.cancel);
  const removeOld = batch.enqueue('a', 1);
  batch.enqueue('a', 2);
  removeOld();
  frames.flush();
  assert.deepEqual(calls, [2]);
});

test('batch cancellation clears pending work and supports a later enqueue', () => {
  const frames = createFrames();
  const calls: string[][] = [];
  const batch = createWorkflowFrameBatch<undefined>(
    updates => calls.push([...updates.keys()]), frames.request, frames.cancel,
  );
  batch.enqueue('old', undefined);
  batch.cancel();
  frames.flush();
  assert.equal(calls.length, 0);
  batch.enqueue('new', undefined);
  frames.flush();
  assert.deepEqual(calls, [['new']]);
});

test('independent canvas batches do not mix nodes with the same id', () => {
  const frames = createFrames();
  const calls: number[] = [];
  const a = createWorkflowFrameBatch<number>(updates => calls.push(updates.get('node')!), frames.request, frames.cancel);
  const b = createWorkflowFrameBatch<number>(updates => calls.push(updates.get('node')!), frames.request, frames.cancel);
  a.enqueue('node', 1);
  b.enqueue('node', 2);
  frames.flush();
  assert.deepEqual(calls, [1, 2]);
});

function makeNode(id: string, mode: 'icon' | 'properties'): Node {
  return {
    id, position: { x: 10, y: 20 },
    data: { nodeDisplayMode: mode, label: id },
    style: { zIndex: 1 },
  };
}

test('200 runtime sizes are applied in one pass, preserving unrelated nodes', () => {
  const frames = createFrames();
  let nodes = Array.from({ length: 200 }, (_, index) => makeNode(`node-${index}`, 'properties'));
  const untouched = makeNode('untouched', 'properties');
  nodes.push(untouched);
  const original = nodes;
  let applications = 0;
  const batch = createWorkflowFrameBatch<{ width: number; height: number }>((updates) => {
    applications++;
    nodes = applyRuntimeNodeSizes(nodes, updates);
  }, frames.request, frames.cancel);
  for (let i = 0; i < 200; i++) batch.enqueue(`node-${i}`, { width: 420, height: 600 + i });
  frames.flush();
  assert.equal(applications, 1);
  assert.equal(nodes[200], untouched);
  assert.equal(original[0].width, undefined);
  assert.equal(nodes[0].width, 420);
  assert.equal(nodes[199].height, 799);
  assert.deepEqual(nodes[0].measured, { width: 420, height: 600 });
  assert.equal(nodes[0].initialHeight, 600);
  assert.equal(nodes[0].data.height, 600);
  assert.deepEqual(nodes[0].style, { zIndex: 1, width: 420, height: 600 });
  assert.equal(nodes[0].position, original[0].position);
});

test('pending property measurements do not overwrite nodes switched back to icon mode', () => {
  const nodes = [makeNode('a', 'icon')];
  assert.equal(applyRuntimeNodeSizes(nodes, new Map([['a', { width: 420, height: 600 }]])), nodes);
});

test('unchanged runtime sizes preserve the array and node references', () => {
  const nodes = [makeNode('a', 'properties')];
  const sizes = new Map([['a', { width: 420, height: 600 }]]);
  const sized = applyRuntimeNodeSizes(nodes, sizes);
  assert.equal(applyRuntimeNodeSizes(sized, sizes), sized);
  assert.equal(applyRuntimeNodeSizes(nodes, new Map()), nodes);
});
