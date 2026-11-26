import test from 'node:test';
import assert from 'node:assert/strict';
import { createChatRunRegistry } from './chat-handler.js';

test('start aborts the previous run of the same agent', () => {
  const runs = createChatRunRegistry();
  const first = runs.start('agent-1');
  assert.equal(first.isCurrent(), true);
  const second = runs.start('agent-1');
  assert.equal(first.controller.signal.aborted, true);
  assert.equal(first.isCurrent(), false);
  assert.equal(second.isCurrent(), true);
  assert.equal(runs.isActive('agent-1'), true);
});

test('start on another agent does not disturb the first', () => {
  const runs = createChatRunRegistry();
  const a = runs.start('agent-a');
  const b = runs.start('agent-b');
  assert.equal(a.controller.signal.aborted, false);
  assert.equal(a.isCurrent(), true);
  assert.equal(b.isCurrent(), true);
});

test('stop aborts and unregisters the current run; absent is a no-op', () => {
  const runs = createChatRunRegistry();
  const run = runs.start('agent-1');
  assert.equal(runs.stop('agent-1'), true);
  assert.equal(run.controller.signal.aborted, true);
  assert.equal(run.isCurrent(), false);
  assert.equal(runs.isActive('agent-1'), false);
  assert.equal(runs.stop('agent-1'), false);
});

test('release from a superseded run does not unregister the newer controller', () => {
  const runs = createChatRunRegistry();
  const first = runs.start('agent-1');
  const second = runs.start('agent-1'); // aborts first
  runs.release('agent-1', first.controller); // old finally must not remove the new run
  assert.equal(runs.isActive('agent-1'), true);
  assert.equal(second.isCurrent(), true);
  runs.release('agent-1', second.controller);
  assert.equal(runs.isActive('agent-1'), false);
});

test('late resolve after stop is not current (then-guard skips save/broadcast)', () => {
  const runs = createChatRunRegistry();
  const run = runs.start('agent-1');
  runs.stop('agent-1');
  // Mirrors the handler guard: if (!isCurrent() || controller.signal.aborted) return;
  const shouldPublish = run.isCurrent() && !run.controller.signal.aborted;
  assert.equal(shouldPublish, false);
});

test('a new run after stop registers fresh', () => {
  const runs = createChatRunRegistry();
  runs.start('agent-1');
  runs.stop('agent-1');
  const fresh = runs.start('agent-1');
  assert.equal(fresh.isCurrent(), true);
  assert.equal(runs.isActive('agent-1'), true);
});
