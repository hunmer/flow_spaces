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
import { php } from '@codemirror/lang-php';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { rust } from '@codemirror/lang-rust';
import { go } from '@codemirror/lang-go';
import { sql } from '@codemirror/lang-sql';
import { markdown } from '@codemirror/lang-markdown';
import { csharp, kotlin, scala, dart } from '@codemirror/legacy-modes/mode/clike';
import { ruby } from '@codemirror/legacy-modes/mode/ruby';
import { perl } from '@codemirror/legacy-modes/mode/perl';
import { lua } from '@codemirror/legacy-modes/mode/lua';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { powerShell } from '@codemirror/legacy-modes/mode/powershell';
import { haskell } from '@codemirror/legacy-modes/mode/haskell';
import { erlang } from '@codemirror/legacy-modes/mode/erlang';
import { clojure } from '@codemirror/legacy-modes/mode/clojure';
import { groovy } from '@codemirror/legacy-modes/mode/groovy';
import { swift } from '@codemirror/legacy-modes/mode/swift';
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile';
import { properties } from '@codemirror/legacy-modes/mode/properties';
import { toml } from '@codemirror/legacy-modes/mode/toml';
import { r } from '@codemirror/legacy-modes/mode/r';
import { d } from '@codemirror/legacy-modes/mode/d';
import { cmake } from '@codemirror/legacy-modes/mode/cmake';
import { stex } from '@codemirror/legacy-modes/mode/stex';

/** 常见语言 id 别名（markdown 代码块等来源使用短名）。 */
const LANGUAGE_ALIASES: Record<string, string> = {
  ts: 'typescript',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  coffee: 'coffeescript',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  console: 'shell',
  py: 'python',
  rb: 'ruby',
  golang: 'go',
  rs: 'rust',
  'c++': 'cpp',
  yml: 'yaml',
  md: 'markdown',
  docker: 'dockerfile',
  tex: 'latex',
  ps: 'powershell',
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

/** 根据文件路径推断语言 id（沿用原 Monaco 语言映射）。 */
export function getLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    // Web
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
    // Data / Config
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'ini',
    ini: 'ini',
    env: 'ini',
    // Scripting
    py: 'python',
    pyw: 'python',
    rb: 'ruby',
    pl: 'perl',
    pm: 'perl',
    php: 'php',
    lua: 'lua',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    fish: 'shell',
    ps1: 'powershell',
    psm1: 'powershell',
    // Systems
    rs: 'rust',
    go: 'go',
    c: 'c',
    h: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    hpp: 'cpp',
    hh: 'cpp',
    hxx: 'cpp',
    cs: 'csharp',
    java: 'java',
    kt: 'kotlin',
    kts: 'kotlin',
    swift: 'swift',
    dart: 'dart',
    scala: 'scala',
    // Functional
    hs: 'haskell',
    lhs: 'haskell',
    ex: 'elixir',
    exs: 'elixir',
    erl: 'erlang',
    clj: 'clojure',
    cljs: 'clojure',
    // JVM
    groovy: 'groovy',
    gradle: 'groovy',
    // Markup / Docs
    md: 'markdown',
    mdx: 'markdown',
    tex: 'latex',
    // Database
    sql: 'sql',
    graphql: 'graphql',
    gql: 'graphql',
    // Other
    dockerfile: 'dockerfile',
    r: 'r',
    d: 'd',
    zig: 'zig',
  };
  // 按文件名匹配特殊文件
  const name = path.split('/').pop()?.toLowerCase() || '';
  if (name === 'dockerfile' || name.startsWith('dockerfile.')) return 'dockerfile';
  if (name === 'makefile' || name === 'gnumakefile') return 'makefile';
  if (name === 'cmakelists.txt' || name.endsWith('.cmake')) return 'cmake';
  if (name === '.gitignore' || name === '.dockerignore' || name === '.eslintignore') return 'plaintext';
  return map[ext || ''] || 'plaintext';
}

/**
 * 语言 id → CodeMirror 6 语言扩展。
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
    case 'yaml':
      return yaml();
    case 'ini':
      return StreamLanguage.define(properties);
    case 'toml':
      return StreamLanguage.define(toml);
    case 'python':
      return python();
    case 'ruby':
      return StreamLanguage.define(ruby);
    case 'perl':
      return StreamLanguage.define(perl);
    case 'php':
      return php();
    case 'lua':
      return StreamLanguage.define(lua);
    case 'shell':
      return StreamLanguage.define(shell);
    case 'powershell':
      return StreamLanguage.define(powerShell);
    case 'rust':
      return rust();
    case 'go':
      return go();
    case 'c':
    case 'cpp':
      return cpp();
    case 'csharp':
      return StreamLanguage.define(csharp);
    case 'java':
      return java();
    case 'kotlin':
      return StreamLanguage.define(kotlin);
    case 'swift':
      return StreamLanguage.define(swift);
    case 'dart':
      return StreamLanguage.define(dart);
    case 'scala':
      return StreamLanguage.define(scala);
    case 'haskell':
      return StreamLanguage.define(haskell);
    case 'erlang':
      return StreamLanguage.define(erlang);
    case 'clojure':
      return StreamLanguage.define(clojure);
    case 'groovy':
      return StreamLanguage.define(groovy);
    case 'markdown':
      return markdown();
    case 'latex':
      return StreamLanguage.define(stex);
    case 'sql':
      return sql();
    case 'dockerfile':
      return StreamLanguage.define(dockerFile);
    case 'r':
      return StreamLanguage.define(r);
    case 'd':
      return StreamLanguage.define(d);
    case 'cmake':
      return StreamLanguage.define(cmake);
    default:
      // CodeMirror 无对应语言包：plaintext
      return null;
  }
}
