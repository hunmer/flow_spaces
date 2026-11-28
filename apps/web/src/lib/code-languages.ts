import type { Extension } from '@codemirror/state';
import { StreamLanguage } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { css } from '@codemirror/lang-css';
import { sass } from '@codemirror/lang-sass';
import { html } from '@codemirror/lang-html';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';
import { python } from '@codemirror/lang-python';
import { markdown } from '@codemirror/lang-markdown';
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile';
import { properties } from '@codemirror/legacy-modes/mode/properties';
import { toml } from '@codemirror/legacy-modes/mode/toml';

/**
 * 语言高亮白名单（2026-11 体积裁剪）：仅保留
 * - 前端技术：js/ts/jsx、css/less/scss/sass、html、xml/svg、markdown、json
 * - Python
 * - 配置文件：yaml、ini/properties、toml、dockerfile
 * 其余语言一律回落 plaintext（languageExtension 返回 null）。
 */

/** 常见语言 id 别名（markdown 代码块等来源使用短名）。 */
const LANGUAGE_ALIASES: Record<string, string> = {
  ts: 'typescript',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  yml: 'yaml',
  md: 'markdown',
  docker: 'dockerfile',
  dos: 'plaintext',
  text: 'plaintext',
  txt: 'plaintext',
};

/** 把任意输入归一为内部语言 id；未知值回落 plaintext。 */
export function normalizeLanguageId(input: string | undefined | null): string {
  if (!input) return 'plaintext';
  const id = input.toLowerCase().trim();
  return LANGUAGE_ALIASES[id] ?? id;
}

/** 根据文件路径推断语言 id；白名单之外的扩展回落 plaintext。 */
export function getLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    // Web / 前端
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    json: 'json',
    jsonc: 'json',
    css: 'css',
    scss: 'scss',
    less: 'less',
    html: 'html',
    htm: 'html',
    vue: 'html',
    svg: 'xml',
    xml: 'xml',
    md: 'markdown',
    mdx: 'markdown',
    // Python
    py: 'python',
    pyw: 'python',
    // Data / Config
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'ini',
    ini: 'ini',
    env: 'ini',
    properties: 'ini',
  };
  // 按文件名匹配特殊文件
  const name = path.split('/').pop()?.toLowerCase() || '';
  if (name === 'dockerfile' || name.startsWith('dockerfile.')) return 'dockerfile';
  if (name === '.gitignore' || name === '.dockerignore' || name === '.eslintignore') return 'plaintext';
  return map[ext || ''] || 'plaintext';
}

/**
 * 语言 id → CodeMirror 6 语言扩展（白名单见文件头注释）。
 * 返回 null 表示无需语言扩展（plaintext）。
 */
export function languageExtension(langInput: string | undefined | null, path?: string): Extension | null {
  const lang = normalizeLanguageId(langInput);
  switch (lang) {
    case 'typescript':
    case 'javascript':
    case 'jsx': {
      const isJsx = path ? /\.(tsx|jsx|vue)$/i.test(path) : true;
      return javascript({ jsx: isJsx, typescript: lang === 'typescript' });
    }
    case 'json':
    case 'jsonc':
      return json();
    case 'css':
    case 'less':
      return css();
    case 'scss':
    case 'sass':
      return sass({ indented: lang === 'sass' });
    case 'html':
      return html();
    case 'xml':
    case 'svg':
      return xml();
    case 'markdown':
      return markdown();
    case 'python':
      return python();
    case 'yaml':
      return yaml();
    case 'ini':
      return StreamLanguage.define(properties);
    case 'toml':
      return StreamLanguage.define(toml);
    case 'dockerfile':
      return StreamLanguage.define(dockerFile);
    default:
      // 白名单之外：plaintext
      return null;
  }
}
