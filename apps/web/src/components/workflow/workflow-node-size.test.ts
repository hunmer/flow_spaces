import assert from 'node:assert/strict';
import test from 'node:test';
import { getWorkflowNodeSize, getWorkflowNodeVariableReferences } from './workflow-node-size';

test('runtime graph and execution results do not contribute variable badges or get traversed', () => {
  const source = { prompt: '{{ __inputs__.prompt }}' };
  const runtimeData = {
    ...source,
    executionLogData: source,
    get workflowEdges(): never { throw new Error('must not scan the graph'); },
    get workflowVariableContext(): never { throw new Error('must not scan all nodes'); },
    get executionSteps(): never { throw new Error('must not scan execution results'); },
  };
  assert.deepEqual(getWorkflowNodeSize(undefined, runtimeData), getWorkflowNodeSize(undefined, source));
});

test('nested business expressions and duplicate references retain badge sizing', () => {
  const source = { fields: [{ value: '{{ __data__["a"].output }}' }, { value: '{{ __inputs__.value }}' }], duplicate: '{{ __inputs__.value }}' };
  assert.equal(new Set(getWorkflowNodeVariableReferences(source)).size, 2);
  assert.equal(getWorkflowNodeSize(undefined, source).minHeight, 60 + 9 + 2 * 20);
});

test('explicit property mode uses its own initial size without scanning runtime objects', () => {
  const data = { nodeDisplayMode: 'properties', get workflowEdges(): never { throw new Error('must not scan graph'); } };
  const size = getWorkflowNodeSize(undefined, data);
  assert.equal(size.width, 420);
  assert.equal(size.height, 560);
});
