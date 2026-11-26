import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  compileApiJs,
  compileToolsJs,
  buildApiFunctionTools,
  createMiniAppToolsCatalogTool,
  registerMiniAppTools,
  resolveAgentCredentials,
  type ApiCtx,
} from '../src/services/mini-app-agent.js';

test('compileApiJs strips imports and converts export default to method map', () => {
  const code = `
import { something } from 'x';
export default {
  next_music: (_input, ctx) => { ctx.broadcast('miniApp.playerAction', { dir: 'next' }); return { ok: true }; },
  play_track: ({ id }, ctx) => { return { got: id }; },
};
`;
  const methods = compileApiJs(code);
  assert.deepEqual(Object.keys(methods).sort(), ['next_music', 'play_track']);
  assert.equal(typeof methods.next_music, 'function');
});

test('compileApiJs returns empty map on missing/invalid default export', () => {
  assert.deepEqual(compileApiJs('export const x = 1;'), {});
  assert.deepEqual(compileApiJs('not valid js {'), {});
});

test('compileApiJs strips single-line and multi-line import statements', () => {
  const code = `
import { single } from 'x';
import {
  multiA,
  multiB,
} from './not-resolved-because-no-entry-path.js';
export default {
  ok: () => ({ value: 1 }),
};
`;
  const methods = compileApiJs(code);
  assert.deepEqual(Object.keys(methods), ['ok']);
});

test('compileApiJs resolves relative imports from entry file path (multiline + dep-of-dep)', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'miniapp-api-'));
  writeFileSync(join(tmpDir, 'api.js'), `
import { HELLO } from './api/constants.js';
import {
  asString,
} from './api/helpers.js';
import { double } from './api/math.js';
export default {
  echo: (input) => ({ got: asString(input.text), doubled: double(HELLO) }),
};
`);
  mkdirSync(join(tmpDir, 'api'));
  writeFileSync(join(tmpDir, 'api', 'constants.js'), `export const HELLO = 'hello';\n`);
  writeFileSync(join(tmpDir, 'api', 'helpers.js'), `export function asString(v) { return typeof v === 'string' ? v.trim() : ''; }\n`);
  writeFileSync(join(tmpDir, 'api', 'math.js'), `
import { asString } from './helpers.js';
export function double(v) { return asString(v) + asString(v); }
`);
  const methods = compileApiJs(
    readFileSync(join(tmpDir, 'api.js'), 'utf-8'),
    join(tmpDir, 'api.js'),
  );
  assert.deepEqual(Object.keys(methods), ['echo']);
  assert.deepEqual((methods.echo as any)({ text: ' hi ' }), { got: 'hi', doubled: 'hellohello' });
});

test('compileApiJs reports dep modules that fail to load as empty map (not crash)', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'miniapp-api-'));
  writeFileSync(join(tmpDir, 'api.js'), `
import { missing } from './not-exist.js';
export default { ok: () => ({ value: 1 }) };
`);
  assert.deepEqual(
    compileApiJs(readFileSync(join(tmpDir, 'api.js'), 'utf-8'), join(tmpDir, 'api.js')),
    {},
  );
});

test('buildApiFunctionTools wraps each method as an AgentFunctionTool with empty object schema', () => {
  const methods = compileApiJs(`
export default {
  next_music: () => ({ ok: true }),
};
`);
  const ctx: ApiCtx = {
    projectId: 'p1',
    broadcast: () => {},
    callPluginTool: async () => ({ ok: true }),
    requestClient: async () => ({ ok: true }),
    readConfig: () => null,
    writeConfig: () => {},
  };
  const tools = buildApiFunctionTools(methods, () => ctx);
  assert.equal(tools.length, 1);
  assert.equal(tools[0].name, 'next_music');
  assert.deepEqual(tools[0].inputSchema, { type: 'object', properties: {} });
  // execute invokes the handler with the ctx
  return tools[0].execute({}).then((r: any) => assert.deepEqual(r, { ok: true }));
});

test('compileToolsJs loads mini-app tool metadata from default export array', () => {
  const tools = compileToolsJs(`
export default [
  {
    name: 'generate_music',
    description: '根据提示词生成一首歌曲',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '音乐风格描述' },
      },
      required: ['prompt'],
    },
  },
];
`);
  assert.equal(tools.length, 1);
  assert.equal(tools[0].name, 'generate_music');
  assert.deepEqual(tools[0].inputSchema, {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: '音乐风格描述' },
    },
    required: ['prompt'],
  });
});

test('buildApiFunctionTools uses tools.js metadata when provided', () => {
  const methods = compileApiJs(`
export default {
  generate_music: (input) => ({ prompt: input.prompt }),
};
`);
  const ctx: ApiCtx = {
    projectId: 'p1',
    broadcast: () => {},
    callPluginTool: async () => ({ ok: true }),
    requestClient: async () => ({ ok: true }),
    readConfig: () => null,
    writeConfig: () => {},
  };
  const tools = buildApiFunctionTools(methods, () => ctx, {
    generate_music: {
      name: 'generate_music',
      description: '根据提示词生成一首歌曲',
      inputSchema: {
        type: 'object',
        properties: { prompt: { type: 'string' } },
        required: ['prompt'],
      },
    },
  });
  assert.equal(tools[0].description, '根据提示词生成一首歌曲');
  assert.deepEqual(tools[0].inputSchema, {
    type: 'object',
    properties: { prompt: { type: 'string' } },
    required: ['prompt'],
  });
});

test('createMiniAppToolsCatalogTool queries registered mini-app tools by project id', async () => {
  const projectId = 'wui_1781192646059_cb4df369';
  registerMiniAppTools(projectId);
  const catalogTool = createMiniAppToolsCatalogTool(projectId);
  const result = await catalogTool.execute({ projectId }) as any;
  assert.equal(result.projectId, projectId);
  assert.ok(result.tools.some((tool: any) => tool.name === 'generate_music'));
});

test('resolveAgentCredentials: agentId resolves preset creds, local fields override', () => {
  const entry: any = {
    agentId: 'preset-1',
    modelId: 'local-model',        // 本地覆盖 preset 的 model
    systemPrompt: 'local persona', // 本地人设为准
  };
  const presets: any[] = [
    {
      id: 'preset-1',
      modelProvider: 'openai-chat-completions',
      modelId: 'preset-model',
      apiKey: 'sk-preset',
      apiBase: 'https://preset',
      systemPrompt: 'preset persona',
    },
  ];
  const resolved = resolveAgentCredentials(entry, presets);
  assert.equal(resolved.modelProvider, 'openai-chat-completions'); // 来自 preset
  assert.equal(resolved.modelId, 'local-model');                   // 本地覆盖
  assert.equal(resolved.apiKey, 'sk-preset');                      // 来自 preset
  assert.equal(resolved.systemPrompt, 'local persona');            // 本地为准
});

test('resolveAgentCredentials: preset missing falls back to local only', () => {
  const entry: any = { agentId: 'nope', modelId: 'm', apiKey: 'sk' };
  const resolved = resolveAgentCredentials(entry, []);
  assert.equal(resolved.modelId, 'm');
  assert.equal(resolved.apiKey, 'sk');
});

test('resolveAgentCredentials: nothing configured → empty (caller falls back to server default)', () => {
  const resolved = resolveAgentCredentials({}, []);
  assert.equal(resolved.modelId, undefined);
  assert.equal(resolved.apiKey, undefined);
});
