export const BUILT_IN_AGENT_TOOL_CATEGORIES = {
  channel: {
    order: 10,
    icon: 'Hash',
  },
  files: {
    order: 50,
    icon: 'Files',
  },
  workflow: {
    order: 60,
    icon: 'Workflow',
  },
} as const;

export type BuiltInAgentToolCategoryName = keyof typeof BUILT_IN_AGENT_TOOL_CATEGORIES;

export const BUILT_IN_AGENT_TOOLS = [
  {
    name: 'CreateCurrentChannelIssue',
    label: 'Create Current Issue',
    description: 'Create and bind an issue for the current channel.',
    category: 'channel',
  },
  {
    name: 'ListAgentSessions',
    label: 'List Agent Sessions',
    description: 'List session records and session IDs for an agent.',
    category: 'channel',
  },
  {
    name: 'GetAgentSessionDetail',
    label: 'Get Agent Session Detail',
    description: 'Get messages, prompts, usage, and raw data for an agent session.',
    category: 'channel',
  },
  {
    name: 'ViewCurrentChannelIssue',
    label: 'View Current Issue',
    description: 'View the issue and comments bound to the current channel.',
    category: 'channel',
  },
  {
    name: 'AddCurrentChannelComment',
    label: 'Add Current Comment',
    description: 'Add a comment to the issue bound to the current channel.',
    category: 'channel',
  },
  {
    name: 'ListWorkspaceFiles',
    label: 'List Workspace Files',
    description: 'List files and directories in the current workspace filesystem.',
    category: 'files',
  },
  {
    name: 'SearchWorkspaceFiles',
    label: 'Search Workspace Files',
    description: 'Search workspace file paths and UTF-8 text file content.',
    category: 'files',
  },
  {
    name: 'ReadWorkspaceFile',
    label: 'Read Workspace File',
    description: 'Read a UTF-8 text file from the current workspace filesystem.',
    category: 'files',
  },
  {
    name: 'ReadWorkspaceFileLines',
    label: 'Read Workspace File Lines',
    description: 'Read UTF-8 workspace file lines from a start line.',
    category: 'files',
  },
  {
    name: 'WriteWorkspaceFile',
    label: 'Write Workspace File',
    description: 'Write UTF-8 text content to a workspace file.',
    category: 'files',
  },
  {
    name: 'ReplaceWorkspaceFileLine',
    label: 'Replace Workspace File Line',
    description: 'Replace one line in a UTF-8 workspace file.',
    category: 'files',
  },
  {
    name: 'DeleteWorkspacePath',
    label: 'Delete Workspace Path',
    description: 'Delete a workspace file or directory recursively.',
    category: 'files',
  },
  {
    name: 'MoveWorkspacePath',
    label: 'Move Workspace Path',
    description: 'Move or rename a workspace file or directory.',
    category: 'files',
  },
  {
    name: 'list_available_agent_capabilities',
    label: 'List Available Agent Capabilities',
    description: 'List all available MCP servers, skills, and built-in tools in the current environment.',
  },
  {
    name: 'list_agent_capabilities',
    label: 'List Agent Capabilities',
    description: 'List available agent presets and their configured MCPs, skills, and tools.',
  },
  {
    name: 'list_workflows',
    label: 'List Workflows',
    description: 'List saved workflows and their start node input fields.',
    category: 'workflow',
  },
  {
    name: 'search_workflow',
    label: 'Search Workflow',
    description: 'Search saved workflows by name or description.',
    category: 'workflow',
  },
  {
    name: 'execute_workflow_sync',
    label: 'Execute Workflow Sync',
    description: 'Start a workflow and wait for completion, pause, error, or timeout.',
    category: 'workflow',
  },
  {
    name: 'execute_workflow_async',
    label: 'Execute Workflow Async',
    description: 'Start a workflow and return its execution ID immediately.',
    category: 'workflow',
  },
  {
    name: 'get_workflow_result',
    label: 'Get Workflow Result',
    description: 'Read a workflow execution result by execution ID.',
    category: 'workflow',
  },
  {
    name: 'get_workflow_latest_result',
    label: 'Get Latest Workflow Result',
    description: 'Read the latest execution result for a workflow.',
    category: 'workflow',
  },
  {
    name: 'get_bound_workflow_plugin_tool',
    label: 'Get Bound Workflow Plugin Tool',
    description: 'Query workflow plugin tools that are explicitly bound to the current agent.',
    category: 'workflow',
  },
  {
    name: 'execute_bound_workflow_plugin_tool',
    label: 'Execute Bound Workflow Plugin Tool',
    description: 'Execute a workflow plugin tool that is explicitly bound to the current agent.',
    category: 'workflow',
  },
] as const;

export type BuiltInAgentToolName = typeof BUILT_IN_AGENT_TOOLS[number]['name'];

