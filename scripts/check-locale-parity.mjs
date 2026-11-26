#!/usr/bin/env node
/**
 * 校验 apps/web/src/locales/{en,zh}/*.json 的键对称性（只比键结构，不比值）。
 *
 * 用法：node scripts/check-locale-parity.mjs
 * 退出码：0 = 完全对称；1 = 文件集合不一致或存在缺失/多余键。
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localesDir = path.join(repoRoot, 'apps', 'web', 'src', 'locales');
const LANGS = ['en', 'zh'];

/** 拍平嵌套 JSON 为 dot-path 键集合（数组视为叶子值，不展开下标） */
function flattenKeys(obj, prefix = '', out = new Set()) {
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenKeys(value, full, out);
    } else {
      out.add(full);
    }
  }
  return out;
}

let failed = false;

// 1) 命名空间文件集合必须一致
const fileSets = {};
for (const lang of LANGS) {
  const dir = path.join(localesDir, lang);
  fileSets[lang] = new Set(
    (await readdir(dir)).filter((f) => f.endsWith('.json')).sort(),
  );
}
for (const file of new Set([...fileSets.en, ...fileSets.zh])) {
  const inEn = fileSets.en.has(file);
  const inZh = fileSets.zh.has(file);
  if (inEn !== inZh) {
    console.error(`✗ 文件不对称: en/${file}=${inEn}, zh/${file}=${inZh}`);
    failed = true;
  }
}

// 2) 每个命名空间内的键集合必须一致
let totalKeys = 0;
for (const file of [...fileSets.en].sort()) {
  if (!fileSets.en.has(file) || !fileSets.zh.has(file)) continue;
  const keySets = await Promise.all(
    LANGS.map(async (lang) => {
      const data = JSON.parse(
        await readFile(path.join(localesDir, lang, file), 'utf8'),
      );
      return flattenKeys(data);
    }),
  );
  const missingInZh = [...keySets[0]].filter((k) => !keySets[1].has(k));
  const missingInEn = [...keySets[1]].filter((k) => !keySets[0].has(k));
  if (missingInZh.length) {
    console.error(`✗ zh/${file} 缺键: ${missingInZh.join(', ')}`);
    failed = true;
  }
  if (missingInEn.length) {
    console.error(`✗ en/${file} 缺键: ${missingInEn.join(', ')}`);
    failed = true;
  }
  totalKeys += keySets[0].size;
}

if (failed) {
  console.error('locale parity check FAILED');
  process.exit(1);
}
console.log(
  `✓ en/zh 键完全对称：${fileSets.en.size} 个命名空间，${totalKeys} 个键`,
);
