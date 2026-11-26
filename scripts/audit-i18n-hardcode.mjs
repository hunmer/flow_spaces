#!/usr/bin/env node
/**
 * 复核 i18n-workset.txt 清单内文件的非注释中文是否归零。
 *
 * 规则：剥离行/块注释后，正文与字符串字面量中的 CJK 表意字符
 * （\u3400-\u4dbf, \u4e00-\u9fff, \uf900-\ufaff）视为硬编码命中；
 * locales/ 与 shims/ 路径整文件豁免；注释中的中文豁免。
 *
 * 用法：node scripts/audit-i18n-hardcode.mjs [workset.txt]
 * 退出码：0 = 归零；1 = 仍有残留（逐条输出 file:line 片段）。
 * INTENTIONAL_KEEP 白名单：Lead 判定保留的数据键/身份匹配中文，计入 kept 不算 FAIL。
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const worksetPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(repoRoot, 'i18n-workset.txt');
const srcRoot = path.join(repoRoot, 'apps', 'web', 'src');

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

/**
 * Lead 判定的有意保留项：中文仅作数据查找键/身份匹配，非展示文案，
 * 接键会破坏存量数据匹配，故豁免（单独汇报为 kept）。
 */
const INTENTIONAL_KEEP = {
  'components/workflow/workflow-editor-agent-utils.ts': [
    /WORKFLOW_AGENT_LEGACY_NAME = '工作流助手'/,
  ],
  'components/workflow/workflow-group-node.tsx': [
    /\{ name: '(蓝色|绿色|紫色|橙色|粉色)'/,
    /name: '自定义'/,
    /color: color \|\| '蓝色'/,
  ],
};

/** 剥离注释（保留字符串内容），返回按行标注安全区间的源码行数组 */
function stripComments(source) {
  const lines = source.split(/\r?\n/);
  const masked = [];
  let state = 'code'; // code | line | block | single | double | template
  for (const line of lines) {
    let out = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      const next = line[i + 1];
      if (state === 'code') {
        if (c === '/' && next === '/') { state = 'line'; continue; }
        if (c === '/' && next === '*') { state = 'block'; i++; continue; }
        if (c === "'") { state = 'single'; out += c; continue; }
        if (c === '"') { state = 'double'; out += c; continue; }
        if (c === '`') { state = 'template'; out += c; continue; }
        out += c;
      } else if (state === 'line') {
        break; // 行注释剩余部分全部丢弃
      } else if (state === 'block') {
        if (c === '*' && next === '/') { state = 'code'; i++; }
        continue;
      } else {
        // 字符串/模板字面量：保留内容（中文需检出），处理转义与结束引号
        const quote = state === 'single' ? "'" : state === 'double' ? '"' : '`';
        if (c === '\\') { out += c + (next ?? ''); i++; continue; }
        if (c === quote) state = 'code';
        out += c;
      }
    }
    if (state === 'line') state = 'code'; // 行注释止于换行
    masked.push(out);
  }
  return masked;
}

const raw = await readFile(worksetPath, 'utf8');
const entries = raw
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))
  .map((l) => {
    const [rel, origCount] = l.split('|');
    return { rel: rel.replaceAll('\\', '/'), origCount: Number(origCount) || 0 };
  });

let totalHits = 0;
let keptHits = 0;
let audited = 0;
const findings = [];
const keeps = [];
for (const { rel, origCount } of entries) {
  if (rel.includes('/locales/') || rel.includes('/shims/')) continue; // 豁免
  const file = path.join(srcRoot, rel);
  let lines;
  try {
    lines = stripComments(await readFile(file, 'utf8'));
  } catch {
    findings.push(`✗ 无法读取: ${rel}`);
    totalHits += 1;
    continue;
  }
  audited += 1;
  lines.forEach((line, idx) => {
    if (!CJK.test(line)) return;
    const allow = INTENTIONAL_KEEP[rel];
    if (allow?.some((re) => re.test(line))) {
      keeps.push(`${rel}:${idx + 1} ${line.trim().slice(0, 120)}`);
      keptHits += 1;
      return;
    }
    const snippet = line.trim().slice(0, 120);
    findings.push(`✗ ${rel}:${idx + 1} ${snippet}`);
    totalHits += 1;
  });
  void origCount;
}

console.log(`审计 ${audited}/${entries.length} 个文件（locales/shims 豁免）`);
if (keeps.length) {
  keeps.forEach((k) => console.log(`  [intentional-keep] ${k}`));
  console.log(`有意保留 ${keptHits} 处（数据键/身份匹配，Lead 判定）`);
}
if (totalHits > 0) {
  findings.forEach((f) => console.error(f));
  console.error(`仍有 ${totalHits} 处非注释中文残留，AUDIT FAILED`);
  process.exit(1);
}
console.log(`✓ 非注释中文已归零（另有 ${keptHits} 处有意保留）`);
