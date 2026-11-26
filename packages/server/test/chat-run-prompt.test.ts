import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChatRuntimePrompt, buildStoredFullPrompt, collectRuntimeTimeline, resolveSessionFileWorkspace } from '../src/routes/chat-run.js';
import type { WorkflowAgentTimelineItem } from '@flow-spaces/shared';

test('buildStoredFullPrompt keeps system prompt ahead of user prompt', () => {
  assert.equal(
    buildStoredFullPrompt('You are a writing assistant.', 'hello'),
    'You are a writing assistant.\n\nhello',
  );
});

test('buildStoredFullPrompt falls back to prompt when system prompt is empty', () => {
  assert.equal(buildStoredFullPrompt('   ', 'hello'), 'hello');
  assert.equal(buildStoredFullPrompt(undefined, 'hello'), 'hello');
});

test('buildChatRuntimePrompt injects bound workflow context', () => {
  const prompt = buildChatRuntimePrompt({
    workspaceId: 'ws-1',
    systemPrompt: 'You are a writing assistant.',
    userPrompt: 'hello',
    historyMessages: [],
    workingDir: 'G:/agent_spaces',
    builtInTools: [{ name: 'execute_bound_workflow_plugin_tool', description: 'run bound workflow plugin tool' }],
    boundWorkflowIds: ['workflow-1'],
    boundWorkflowPluginTools: [{ pluginId: 'plugin-a', toolName: 'tool-b' }],
  });

  assert.match(prompt, /Bound workflow capabilities:/);
  assert.match(prompt, /Bound workflows: workflow-1/);
  assert.match(prompt, /Bound workflow plugin tools: plugin-a:tool-b/);
  assert.match(prompt, /execute_bound_workflow_plugin_tool/);
});

test('buildChatRuntimePrompt does not advertise MCP servers or skills for chat', () => {
  const prompt = buildChatRuntimePrompt({
    workspaceId: 'ws-1',
    systemPrompt: 'You are a writing assistant.',
    userPrompt: 'hello',
    historyMessages: [],
    workingDir: 'G:/agent_spaces',
    builtInTools: [{ name: 'agent_run', description: 'run an agent' }],
  });

  assert.match(prompt, /MCP servers configured for this agent: none/);
  assert.match(prompt, /Skills configured for this agent: none/);
  assert.match(prompt, /- Tools: agent_run/);
  assert.doesNotMatch(prompt, /configured MCP tools/);
  assert.doesNotMatch(prompt, /through LangChain/);
});

test('collectRuntimeTimeline pairs parallel tool results by tool call id', () => {
  const timeline: WorkflowAgentTimelineItem[] = [];
  collectRuntimeTimeline(timeline, { type: 'tool_use', id: 'call-1', name: 'toolA', input: { a: 1 }, line: '' });
  collectRuntimeTimeline(timeline, { type: 'tool_use', id: 'call-2', name: 'toolB', input: { b: 2 }, line: '' });

  collectRuntimeTimeline(timeline, { type: 'tool_result', toolUseId: 'call-2', result: { success: true, value: 'B' } });
  collectRuntimeTimeline(timeline, { type: 'tool_result', toolUseId: 'call-1', result: { success: false, error: 'A failed' } });

  assert.equal(timeline.length, 2);
  const [first, second] = timeline as Array<WorkflowAgentTimelineItem & { type: 'tool'; name: string; status: string; result: unknown }>;
  assert.equal(first.name, 'toolA');
  assert.equal(first.status, 'error');
  assert.deepEqual(first.result, { success: false, error: 'A failed' });
  assert.equal(second.name, 'toolB');
  assert.equal(second.status, 'success');
  assert.deepEqual(second.result, { success: true, value: 'B' });
});

test('collectRuntimeTimeline falls back to the latest running tool when ids are missing', () => {
  const timeline: WorkflowAgentTimelineItem[] = [];
  collectRuntimeTimeline(timeline, { type: 'tool_use', id: '', name: 'toolA', input: {}, line: '' });
  collectRuntimeTimeline(timeline, { type: 'tool_use', id: '', name: 'toolB', input: {}, line: '' });

  collectRuntimeTimeline(timeline, { type: 'tool_result', toolUseId: undefined, result: 'orphan' });

  assert.equal(timeline.length, 2);
  const second = timeline[1] as WorkflowAgentTimelineItem & { type: 'tool'; name: string; status: string; result: unknown };
  assert.equal(second.name, 'toolB');
  assert.equal(second.status, 'success');
  assert.equal(second.result, 'orphan');
});

test('resolveSessionFileWorkspace keeps file tools on the agent workspace', () => {
  const agentWorkspace = {
    id: 'chat:agent-1',
    name: 'Chat Agent',
    boundDirs: ['G:/agent_spaces/packages/server/flow-spaces-data/chat/agent-1/workspaces'],
    agentspaceDir: 'G:/agent_spaces/packages/server/flow-spaces-data/chat/agent-1/workspaces',
    createdAt: '',
    updatedAt: '',
    activeChannels: [],
    activeIssues: [],
  };

  assert.deepEqual(resolveSessionFileWorkspace(agentWorkspace, {}), agentWorkspace);
  assert.deepEqual(
    resolveSessionFileWorkspace(agentWorkspace, { editorDirectoryTabs: [{ path: 'G:/extra' }] })?.boundDirs,
    [...agentWorkspace.boundDirs, 'G:/extra'],
  );
});
