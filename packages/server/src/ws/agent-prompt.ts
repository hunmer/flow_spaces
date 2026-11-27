import type { Message } from '@flow-spaces/shared';
import { stripHtml } from './html-utils.js';
import { MINI_APP_COMPONENT_CATEGORY_DESCRIPTIONS } from '../services/builtin-tools/mini-app-tools.js';
import { prependPersistentAgentContext } from '../services/persistent-agent-context.js';

export interface BuiltInToolContext {
  name: string;
  description: string;
}

interface MiniAppPromptContext {
  projectId: string;
  activeFilePath?: string;
  projectType?: 'react' | 'html';
}

export function buildAgentPrompt(
  workspaceId: string,
  systemPrompt: string | undefined,
  userPrompt: string,
  history: Message[] = [],
  runtimeConfig?: {
    runtimeKind?: string;
    mcpServers: string[];
    skills: string[];
    boundDirs?: string[];
    workingDir?: string;
    excludeNativeClaudeMd?: boolean;
    builtInTools?: BuiltInToolContext[];
    boundWorkflowIds?: string[];
    boundWorkflowPluginTools?: Array<{ pluginId: string; toolName: string }>;
    miniAppContext?: MiniAppPromptContext;
  },
): string {
  const parts: string[] = [];
  const trimmedSystemPrompt = systemPrompt?.trim();
  if (trimmedSystemPrompt) parts.push(trimmedSystemPrompt);

  if (runtimeConfig) {
    const configLines = [
      'Agent runtime configuration:',
      `- Current workspace id: ${workspaceId}`,
      `- MCP servers configured for this agent: ${runtimeConfig.mcpServers.length ? runtimeConfig.mcpServers.join(', ') : 'none'}`,
      `- Skills configured for this agent: ${runtimeConfig.skills.length ? runtimeConfig.skills.join(', ') : 'none'}`,
      formatRuntimeToolsLine(runtimeConfig.runtimeKind),
      `- Tools: ${runtimeConfig.builtInTools?.length ? runtimeConfig.builtInTools.map((tool) => tool.name).join(', ') : 'none'}`,
    ];
    if (runtimeConfig.boundDirs?.length) {
      configLines.push(`- Code directories (boundDirs): ${runtimeConfig.boundDirs.join(', ')}`);
    }
    configLines.push('- For Bash commands that create or modify files under the current working directory, use relative paths such as `mkdir -p css js` instead of absolute paths.');
    if (runtimeConfig.builtInTools?.length) {
      configLines.push(...formatBuiltInToolContext(workspaceId, runtimeConfig.builtInTools));
    }
    if (runtimeConfig.boundWorkflowIds?.length || runtimeConfig.boundWorkflowPluginTools?.length) {
      configLines.push(...formatBoundWorkflowContext(runtimeConfig.boundWorkflowIds, runtimeConfig.boundWorkflowPluginTools));
    }
    if (runtimeConfig.miniAppContext) {
      configLines.push(...formatMiniAppPromptContext(runtimeConfig.miniAppContext));
    }
    configLines.push(
      'When asked what MCP servers, skills, runtime tools, or Agent Spaces channel tools you have, answer from this configuration only.',
      'Important distinction: MCP servers configured for this agent are only the names in "MCP servers configured for this agent". Agent Spaces channel tools are built-in runtime tools and must not be listed as agent-configured MCP servers.',
      'Do not infer availability from provider-side function names, hidden runtime internals, previous sessions, or filesystem settings.',
    );
    parts.push(configLines.join('\n'));
  }

  if (history.length > 0) {
    const historyLines = formatConversationHistory(history);
    if (historyLines.length > 0) parts.push(['Conversation history:', ...historyLines].join('\n'));
  }

  parts.push(`User message:\n${userPrompt}`);
  return prependPersistentAgentContext(parts.join('\n\n'), {
    workspaceId,
    workingDir: runtimeConfig?.workingDir ?? runtimeConfig?.boundDirs?.[0] ?? process.cwd(),
    boundDirs: runtimeConfig?.boundDirs,
    excludeNativeClaudeMd: runtimeConfig?.excludeNativeClaudeMd,
  });
}

function formatConversationHistory(history: Message[]): string[] {
  const historyLines: string[] = [];
  let remainingBudget = 24_000;

  for (const msg of history) {
    const role = msg.senderId === 'user' ? 'User' : (msg.senderRole || 'Agent');
    const text = msg.senderId === 'user' ? stripHtml(msg.content) : getAgentFinalMessage(msg);
    appendHistoryLine(historyLines, `[${role}]`, text, remainingBudget);
    remainingBudget -= text.length;
    if (remainingBudget <= 0) break;

    for (const reply of msg.replies ?? []) {
      const replyRole = reply.senderId === 'user' ? 'User' : (reply.senderRole || 'Agent');
      const replyText = reply.senderId === 'user' ? stripHtml(reply.content) : getReplyFinalMessage(reply);
      appendHistoryLine(historyLines, `[${replyRole} reply]`, replyText, remainingBudget);
      remainingBudget -= replyText.length;
      if (remainingBudget <= 0) break;
    }
  }
  return historyLines;
}

/**
 * 将简单的 {role, content} 对话历史格式化为 "Conversation history:" 文本块。
 * 与 formatConversationHistory 共用 [User]/[Agent] 前缀和预算截断逻辑，
 * 供 mini-app agent 等无 Message 结构的场景复用。返回空字符串表示无历史。
 */
export function formatSimpleConversationHistory(history: Array<{ role: 'user' | 'agent'; content: string }>): string {
  if (!history.length) return '';
  const historyLines: string[] = [];
  let remainingBudget = 24_000;
  for (const msg of history) {
    const role = msg.role === 'user' ? 'User' : 'Agent';
    const text = msg.role === 'user' ? stripHtml(msg.content) : stripToolLikeHistoryLines(stripHtml(msg.content));
    appendHistoryLine(historyLines, `[${role}]`, text, remainingBudget);
    remainingBudget -= text.length;
    if (remainingBudget <= 0) break;
  }
  if (!historyLines.length) return '';
  return ['Conversation history:', ...historyLines].join('\n');
}

function getAgentFinalMessage(message: Message): string {
  const finalTextParts = message.parts
    ?.filter((part) => part.type === 'text')
    .map((part) => part.text.trim())
    .filter(Boolean);

  if (finalTextParts?.length) return finalTextParts.join('\n\n');

  if (message.parts?.length) return '';
  if (message.status && message.status !== 'completed') return '';

  return stripToolLikeHistoryLines(stripHtml(message.content));
}

function getReplyFinalMessage(reply: NonNullable<Message['replies']>[number]): string {
  const finalTextParts = reply.parts
    ?.filter((part) => part.type === 'text')
    .map((part) => part.text.trim())
    .filter(Boolean);

  if (finalTextParts?.length) return finalTextParts.join('\n\n');
  if (reply.parts?.length) return '';
  if (reply.status && reply.status !== 'completed') return '';
  return stripToolLikeHistoryLines(stripHtml(reply.content));
}

function stripToolLikeHistoryLines(content: string): string {
  const kept = content.split(/\r?\n/).filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    return !/^Tool:\s*\w+/i.test(trimmed)
      && !/^(Read|Write|Edit|MultiEdit|Bash|Grep|Glob|TodoWrite|Task)\b/i.test(trimmed)
      && !/^Claude Code initialized\b/i.test(trimmed)
      && !/^(Input|Output|Result|Error):\s*\{/i.test(trimmed);
  });

  return kept.join('\n').trim();
}

function appendHistoryLine(lines: string[], label: string, rawText: string, remainingBudget: number): void {
  const text = compactHistoryText(rawText);
  if (!text || remainingBudget <= 0) return;
  const clipped = clipText(text, Math.min(remainingBudget, 4_000));
  if (clipped) lines.push(`${label}: ${clipped}`);
}

function compactHistoryText(text: string): string {
  return stripPromptContextLeak(stripToolLikeHistoryLines(text))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripPromptContextLeak(text: string): string {
  return text
    .replace(/Persistent agent instructions:\n[\s\S]*?(?=\n\n(?:Agent runtime configuration:|Conversation history:|User message:)|$)/g, '')
    .replace(/Workspace prompt:\n[\s\S]*?(?=\n\n(?:Agent runtime configuration:|Conversation history:|User message:)|$)/g, '')
    .trim();
}

function clipText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 32)).trimEnd()}\n[history truncated]`;
}

export function buildBuiltInTools(
  functionTools: Array<{ name: string; description: string }>,
): BuiltInToolContext[] {
  if (!functionTools.length) return [];

  return functionTools.map((functionTool) => ({
    name: functionTool.name,
    description: functionTool.description,
  }));
}

function formatBuiltInToolContext(workspaceId: string, tools: BuiltInToolContext[]): string[] {
  const lines = [
    'Built-in Agent Spaces tool rules:',
    '- These are real function-call tools exposed by the Agent Spaces runtime.',
    '- They are not agent-configured MCP servers and must be reported only as Agent Spaces channel tools.',
    '- Use the exact Agent Spaces tool names listed below when operating on Agent Spaces data.',
    '- Tool calls that require workspaceId must use the current workspace id.',
  ];
  lines.push(`- Current workspace id: ${workspaceId}`);

  for (const tool of tools) {
    lines.push(`- ${formatCallableToolName(tool.name)}: ${tool.description}`);
  }
  return lines;
}

function formatBoundWorkflowContext(
  workflowIds?: string[],
  pluginTools?: Array<{ pluginId: string; toolName: string }>,
): string[] {
  const lines = [
    'Bound workflow capabilities:',
    `- Bound workflows: ${workflowIds?.length ? workflowIds.join(', ') : 'none'}`,
    `- Bound workflow plugin tools: ${pluginTools?.length ? pluginTools.map((item) => `${item.pluginId}:${item.toolName}`).join(', ') : 'none'}`,
  ];
  if (workflowIds?.length) {
    lines.push('- Prefer the bound workflows above when the task matches an existing workflow capability.');
    lines.push('- Use list_workflows or get_workflow_latest_result only as supporting tools; the bound workflow IDs above are the approved workflow scope.');
  }
  if (pluginTools?.length) {
    lines.push('- To inspect the bound workflow plugin tool schema before execution, call mcp__flow-spaces__get_bound_workflow_plugin_tool.');
    lines.push('- To execute a bound workflow plugin tool, call mcp__flow-spaces__execute_bound_workflow_plugin_tool.');
    lines.push('- If execution fails, read the returned data.tool field for the exact tool schema and metadata.');
    lines.push('- Do not call unbound workflow plugin tools or invent plugin/tool names outside the bound list above.');
  }
  return lines;
}

function formatMiniAppPromptContext(context: MiniAppPromptContext): string[] {
  const projectType = context.projectType ?? 'unknown';
  const componentCategories = MINI_APP_COMPONENT_CATEGORY_DESCRIPTIONS
    .map((item) => `${item.category} (${item.description})`)
    .join(', ');
  const lines = [
    'Workflow UI project rules:',
    `- Current Workflow UI project id: ${context.projectId}`,
    `- Current Workflow UI project mode: ${projectType}`,
    '- All source code MUST be written under the project `src/` directory (e.g. `src/index.jsx`, `src/components/Foo.jsx`). The project root only holds `manifest.json`, `configs/`, `data/`, and `CLAUDE.md`; do NOT create source files outside `src/`.',
    `- FlowSpacesUI component categories for list_flow_spaces_ui_components: ${componentCategories}.`,
  ];
  if (context.activeFilePath) lines.push(`- Current active file: ${context.activeFilePath}`);

  lines.push(
    'CLAUDE.md workflow:',
    '- Before making any changes to the project, read `src/CLAUDE.md` to understand the project context, file structure, and design decisions.',
    '- After completing edits, update `src/CLAUDE.md` to reflect any new files, changed architecture, or important decisions.',
    '- Keep the File Structure section in `src/CLAUDE.md` in sync with the actual files.',
    '',
    '- If you need available host UI components, call list_flow_spaces_ui_components with the closest category before creating hand-written equivalents. Omit category only when you need the full categorized inventory.',
    '- If a window.FlowSpacesUI component usage, props, composition pattern, or import source is unclear, inspect its implementation at https://github.com/hunmer/flow-spaces/tree/main/packages/web/src/components/ui before using it.',
    '- In React mode, prefer components exposed by window.FlowSpacesUI over hand-written UI components. Lucide React icons are also exposed there by their standard names. Example: `const { Button, Card, CardContent, Search, Loader2 } = window.FlowSpacesUI;`.',
    '- In React mode, do not import host UI components from source paths; destructure them from window.FlowSpacesUI.',
    '- window.FlowSpacesUI components are built on base-ui (@base-ui/react), NOT Radix. Do not apply Radix controlled-API patterns from memory. For example: Slider takes a single numeric `value`, not an array (`value={[n]}`); `SelectValue` renders the raw selected value by default, so map value→label via a `SelectValue` render function or the `items` prop on Select. Inspect the component source before writing controlled props when unsure.',
    '',
    'Styling rules:',
    '- Prefer Tailwind CSS utility classes via `className` for layout, spacing, color, typography, borders, shadows, and responsive states.',
    '- Prefer theme-aware Tailwind color tokens such as `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-card`, `text-card-foreground`, `bg-primary`, and `text-primary-foreground` over hard-coded color utilities.',
    '- The Workflow UI host already provides the current light/dark theme through its renderer container. Do not implement an internal theme switcher, force `dark`/`light` classes, or override global theme CSS variables such as `--background`, `--foreground`, `--card-*`, or `--popover-*` inside preview code.',
    '- Avoid hard-coded text colors like `text-white`, `text-black`, `text-slate-*`, `text-gray-*`, or one-off hex colors unless they are tied to explicit semantic status states and include matching `dark:` variants.',
    '- Do not hard-code only the background color while leaving text to inherit unrelated theme tokens. Any custom dark or light surface must set a matching readable foreground color in the same container, preferably with semantic tokens or paired light/dark Tailwind classes.',
    '- When adding custom surface, border, or muted text styling, verify the class choices work in both light and dark themes; use paired light/dark utilities only when semantic tokens are not sufficient.',
    '- Avoid inline `style` objects and `<style>` blocks for ordinary UI styling. Use them only for dynamic runtime values, CSS variables, canvas/SVG sizing, or styles that Tailwind cannot express clearly.',
    '- When using window.FlowSpacesUI components in React mode, pass visual adjustments through `className` instead of wrapping components with custom styled elements.',
    '- Keep repeated class combinations in small local constants only when reuse improves readability; do not create a separate CSS file for simple Tailwind styling.',
    '- To execute enabled plugin tools from preview code, call `window.AgentSpaces.callPluginTool(pluginId, toolName, args)`.',
    '- Before consuming plugin tool results in preview code, inspect the tool detail when needed and follow its documented output shape. Do not assume business data is on the top-level `success` wrapper.',
    '- In preview code, assign `const result = await window.AgentSpaces.callPluginTool(...)` and read fields according to the plugin output. If the response is wrapped as `{ success, result }`, use the inner `result` object for plugin data.',
    '- `window.AgentSpacesAPI.callPluginTool` and `window.AgentSpacesAPI.executePluginTool` are compatibility aliases; prefer `window.AgentSpaces.callPluginTool` in new code.',
    '- When a plugin tool input schema property has a `default` value, `window.AgentSpaces.callPluginTool` can use that default automatically; do not add extra UI input fields for those properties unless the user explicitly needs to override them.',
    '- Do not build UI or code to read/write API keys, tokens, or account credentials in preview code. `window.AgentSpaces.callPluginTool` injects the plugin default credentials from plugin config at execution time, so omit credential arguments and let the plugin resolve them.',
    '- Preview code can persist JSON configuration with async helpers `await window.FlowSpacesUI.readConfigJson(path)` and `await window.FlowSpacesUI.writeConfigJson(path, value)`. Paths are relative to the Workflow UI project `configs/` directory.',
    '- For remembering the last submitted selection, prefer `await window.FlowSpacesUI.readLastSelection()` and `await window.FlowSpacesUI.writeLastSelection(value)`, which use `configs/last-selection.json`.',
    '- Preview code can save generated text or binary data under the Workflow UI project `data/` directory with `await window.FlowSpacesUI.saveDataFile(path, content)`.',
    '- Preview code can download a remote file into the Workflow UI project `data/` directory with `await window.FlowSpacesUI.downloadFile(url, path?)`.',
    '- The same config and data file helpers are also available on `window.AgentSpaces` and `window.AgentSpacesAPI` for compatibility.',
    '- In HTML mode, window.FlowSpacesUI and window.AgentSpaces are available, but plain HTML/CSS/JS is acceptable when React components are not practical.',
    '',
    'Multi-file project layout rules:',
    '- The preview renderer supports ES module imports between local files. You MUST split large projects into multiple files instead of writing everything in index.jsx.',
    '- The entry point is defined by manifest.json `mainFile` (default: `index.jsx`). This file MUST export a default React component.',
    '- Use standard import syntax: `import Foo from "./components/Foo"` or `import { helper } from "./utils"`. The renderer resolves `.jsx`/`.js` extensions and `index.jsx` barrel files automatically.',
    '- Recommended file structure for non-trivial projects:',
    '  - `index.jsx` — entry point, composes the top-level layout from sub-components.',
    '  - `components/` — one file per UI component (e.g. `components/Header.jsx`, `components/VoiceSelector.jsx`).',
    '  - `hooks/` — custom React hooks shared across components (e.g. `hooks/useTTS.js`).',
    '  - `utils/` — pure utility functions, constants, configuration helpers (e.g. `utils/providers.js`, `utils/styles.js`).',
    '- All files live under `src/` and are auto-discovered there. Sub-directories are supported, but do not place source files in the project root or in `configs/`/`data/`.',
    '- Each file should have a single responsibility. If a component exceeds ~200 lines, split it.',
    '- Do NOT use barrel re-export files (index.jsx that only re-exports). Import directly from the target file.',
    '- All files share the same `window.FlowSpacesUI`, `window.AgentSpaces`, and `window.AgentSpacesAPI` globals. Do not pass them through imports.',
  );

  return lines;
}

function formatCallableToolName(name: string): string {
  return `mcp__flow-spaces__${name}`;
}

function formatRuntimeToolsLine(_runtimeKind?: string): string {
  return '- Runtime tools available through LangChain: Agent Spaces function tools and configured MCP tools';
}
