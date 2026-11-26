import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addCloneToSourceGroups,
  alignAutoLayoutLayers,
  appendImmediateCanvasClone,
  collectLockedWorkflowGroupNodeIds,
  findSmallestContainingRectId,
  getGridLayoutPositions,
  resolveGroupBoundsNode,
} from './workflow-canvas-helpers';

test('collectLockedWorkflowGroupNodeIds includes nodes in nested child groups', () => {
  const groups = [
    { id: 'locked', name: 'Locked', locked: true, disabled: false, childNodeIds: ['direct'], childGroupIds: ['nested'], savedNodeStates: {} },
    { id: 'nested', name: 'Nested', locked: false, disabled: false, childNodeIds: ['nested-node'], childGroupIds: [], savedNodeStates: {} },
    { id: 'unlocked', name: 'Unlocked', locked: false, disabled: false, childNodeIds: ['free'], childGroupIds: [], savedNodeStates: {} },
  ];

  assert.deepEqual(
    [...collectLockedWorkflowGroupNodeIds(groups)].sort(),
    ['direct', 'nested-node'],
  );
});

test('findSmallestContainingRectId picks the innermost matching group', () => {
  const targets = [
    { id: 'outer', rect: { left: 0, top: 0, right: 200, bottom: 200 } },
    { id: 'inner', rect: { left: 50, top: 50, right: 100, bottom: 100 } },
  ];

  assert.equal(findSmallestContainingRectId({ x: 75, y: 75 }, targets), 'inner');
  assert.equal(findSmallestContainingRectId({ x: 250, y: 250 }, targets), null);
});

test('resolveGroupBoundsNode freezes a detaching node at its drag-start position', () => {
  const live = { id: 'node', position: { x: 300, y: 200 } };
  const initial = { id: 'node', position: { x: 10, y: 20 } };

  assert.equal(resolveGroupBoundsNode(live, initial, true), initial);
  assert.equal(resolveGroupBoundsNode(live, initial, false), live);
});

test('addCloneToSourceGroups keeps a cloned node in its source group', () => {
  const groups = [
    { id: 'source-group', childNodeIds: ['source'] },
    { id: 'other-group', childNodeIds: ['other'] },
  ];

  assert.deepEqual(addCloneToSourceGroups(groups, 'source', 'clone'), [
    { id: 'source-group', childNodeIds: ['source', 'clone'] },
    groups[1],
  ]);
});

test('appendImmediateCanvasClone shows the clone at drag start', () => {
  const source = { id: 'source', position: { x: 10, y: 20 }, selected: true, dragging: true };

  assert.deepEqual(appendImmediateCanvasClone([source], source, 'clone'), [
    source,
    { id: 'clone', position: { x: 10, y: 20 }, selected: false, dragging: false },
  ]);
});

test('getGridLayoutPositions keeps even gaps around differently sized nodes', () => {
  const positions = getGridLayoutPositions([
    { id: 'a', width: 100, height: 50, badgeLeft: 0, badgeTop: 0 },
    { id: 'b', width: 80, height: 70, badgeLeft: 0, badgeTop: 0 },
    { id: 'c', width: 120, height: 40, badgeLeft: 0, badgeTop: 0 },
  ], 2, 20, 30);

  assert.deepEqual(Object.fromEntries(positions), {
    a: { x: 0, y: 0 },
    b: { x: 140, y: 0 },
    c: { x: 0, y: 100 },
  });
});

test('alignAutoLayoutLayers aligns and compacts the primary axis by topology layer', () => {
  const nodes = [
    { id: 'a', width: 100, height: 60, badgeLeft: 0, badgeTop: 0 },
    { id: 'b', width: 240, height: 160, badgeLeft: 0, badgeTop: 0 },
    { id: 'c', width: 120, height: 80, badgeLeft: 0, badgeTop: 0 },
    { id: 'd', width: 180, height: 120, badgeLeft: 0, badgeTop: 0 },
  ];
  const edges = [{ source: 'a', target: 'c' }, { source: 'b', target: 'd' }];

  const vertical = alignAutoLayoutLayers(nodes, edges, new Map([
    ['a', { x: 0, y: 50 }], ['b', { x: 160, y: 0 }],
    ['c', { x: 0, y: 150 }], ['d', { x: 170, y: 250 }],
  ]), 'TB', 80);
  assert.equal(vertical.get('a')?.y, 0);
  assert.equal(vertical.get('b')?.y, 0);
  assert.equal(vertical.get('c')?.y, 240);
  assert.equal(vertical.get('d')?.y, 240);

  const horizontal = alignAutoLayoutLayers(nodes, edges, new Map([
    ['a', { x: 70, y: 0 }], ['b', { x: 0, y: 100 }],
    ['c', { x: 350, y: 0 }], ['d', { x: 320, y: 130 }],
  ]), 'LR', 80);
  assert.equal(horizontal.get('a')?.x, 0);
  assert.equal(horizontal.get('b')?.x, 0);
  assert.equal(horizontal.get('c')?.x, 320);
  assert.equal(horizontal.get('d')?.x, 320);
});

for (const direction of ['LR', 'TB'] as const) {
  test(`alignAutoLayoutLayers aligns serial nodes and branch lanes in ${direction}`, () => {
    const nodes = ['start', 'split', 'upper', 'middle', 'lower', 'merge', 'end'].map(id => ({
      id, width: 100, height: 60, badgeLeft: 0, badgeTop: 0,
    }));
    const edges = [
      { source: 'start', target: 'split' },
      ...['upper', 'middle', 'lower'].flatMap(id => [
        { source: 'split', target: id }, { source: id, target: 'merge' },
      ]),
      { source: 'merge', target: 'end' },
    ];
    const original = new Map(nodes.map((node, index) => [node.id, { x: index * 113, y: index * 79 }]));
    const snapshot = structuredClone(original);
    const result = alignAutoLayoutLayers(nodes, edges, original, direction, 80);
    const crossAxis = direction === 'LR' ? 'y' : 'x';
    const primaryAxis = direction === 'LR' ? 'x' : 'y';
    for (const id of ['split', 'middle', 'merge', 'end']) {
      assert.equal(result.get(id)?.[crossAxis], result.get('start')?.[crossAxis]);
    }
    for (const id of ['middle', 'lower']) {
      assert.equal(result.get(id)?.[primaryAxis], result.get('upper')?.[primaryAxis]);
    }
    assert.ok(result.get('upper')![crossAxis] < result.get('middle')![crossAxis]);
    assert.ok(result.get('middle')![crossAxis] < result.get('lower')![crossAxis]);
    assert.deepEqual(original, snapshot);
  });

  test(`alignAutoLayoutLayers aligns bodies and reserves overflow space in ${direction}`, () => {
    const nodes = [
      { id: 'a', width: 130, height: 90, badgeLeft: 30, badgeTop: 20 },
      { id: 'b', width: 240, height: 160, badgeLeft: 0, badgeTop: 0 },
      { id: 'c', width: 120, height: 80, badgeLeft: 10, badgeTop: 10 },
      { id: 'd', width: 180, height: 120, badgeLeft: 0, badgeTop: 0 },
    ];
    const result = alignAutoLayoutLayers(nodes, [
      { source: 'a', target: 'c' }, { source: 'b', target: 'd' },
    ], new Map([
      ['a', { x: 0, y: 0 }], ['b', { x: 300, y: 200 }],
      ['c', { x: 10, y: 10 }], ['d', { x: 310, y: 210 }],
    ]), direction, 80);
    const primaryAxis = direction === 'LR' ? 'x' : 'y';
    const crossAxis = direction === 'LR' ? 'y' : 'x';
    assert.equal(result.get('a')![primaryAxis], result.get('b')![primaryAxis]);
    assert.equal(result.get('c')![primaryAxis], result.get('d')![primaryAxis]);
    assert.equal(result.get('a')![crossAxis], result.get('c')![crossAxis]);
    assert.equal(result.get('b')![crossAxis], result.get('d')![crossAxis]);
    // 检查完整包围盒，而不只是本体尺寸。
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const aPos = result.get(a.id)!;
        const bPos = result.get(b.id)!;
        const ax = aPos.x - a.badgeLeft;
        const ay = aPos.y - a.badgeTop;
        const bx = bPos.x - b.badgeLeft;
        const by = bPos.y - b.badgeTop;
        assert.ok(ax + a.width <= bx || bx + b.width <= ax || ay + a.height <= by || by + b.height <= ay);
      }
    }
  });
}

test('alignAutoLayoutLayers handles empty and partially positioned layouts', () => {
  assert.equal(alignAutoLayoutLayers([], [], new Map(), 'LR', 80).size, 0);
  const nodes = ['a', 'b'].map(id => ({ id, width: 100, height: 60, badgeLeft: 0, badgeTop: 0 }));
  const result = alignAutoLayoutLayers(nodes, [], new Map([['b', { x: 20, y: 30 }]]), 'LR', 80);
  assert.deepEqual(Object.fromEntries(result), { b: { x: 0, y: 0 } });
});
