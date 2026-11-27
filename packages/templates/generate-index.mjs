#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync, statSync, mkdirSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { inflateRawSync, deflateRawSync, crc32 } from 'node:zlib';

const agentsDir = fileURLToPath(new URL('.', import.meta.url));

function folderMD5(dir) {
  const hashes = [];
  function walk(d) {
    for (const file of readdirSync(d)) {
      if (file === 'node_modules' || file === '.git') continue;
      const fullPath = join(d, file);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) walk(fullPath);
      else hashes.push(createHash('md5').update(readFileSync(fullPath)).digest('hex'));
    }
  }
  walk(dir);
  return createHash('md5').update(hashes.sort().join('')).digest('hex');
}

function fileMD5(filePath) {
  return createHash('md5').update(readFileSync(filePath)).digest('hex');
}

function fileMtime(filePath) {
  return statSync(filePath).mtime.toISOString();
}

function getLatestMtime(dir) {
  let latest = 0;
  function walk(d) {
    for (const file of readdirSync(d)) {
      if (file === 'node_modules' || file === '.git') continue;
      const fullPath = join(d, file);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) walk(fullPath);
      else if (stat.mtimeMs > latest) latest = stat.mtimeMs;
    }
  }
  walk(dir);
  return latest > 0 ? new Date(latest).toISOString() : undefined;
}

function loadExistingIndex(indexPath) {
  if (!existsSync(indexPath)) return new Map();
  try {
    const items = JSON.parse(readFileSync(indexPath, 'utf-8'));
    return new Map((Array.isArray(items) ? items : []).map(item => [item.id, item]));
  } catch {
    return new Map();
  }
}

function scanPromptStore() {
  const dir = join(agentsDir, 'prompt');
  if (!existsSync(dir)) return;
  const indexPath = join(dir, 'index.json');
  const existing = loadExistingIndex(indexPath);
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  const index = files.map((filename) => {
    const id = basename(filename, '.md');
    const filePath = join(dir, filename);
    const content = readFileSync(filePath, 'utf-8');
    const firstHeading = content.split('\n').find((l) => /^#\s+/.test(l));
    const name = firstHeading ? firstHeading.replace(/^#\s+/, '').trim() : id.replace(/[-_]/g, ' ');
    const md5 = fileMD5(filePath);
    const prev = existing.get(id);
    const updatedAt = (!prev || prev.md5 !== md5) ? fileMtime(filePath) : prev.updatedAt;
    return { id, name, filename, md5, updatedAt };
  });
  writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  console.log(`[prompt] ${index.length} templates`);
}

function scanOutputStyleStore() {
  const dir = join(agentsDir, 'output-styles');
  if (!existsSync(dir)) return;
  const indexPath = join(dir, 'index.json');
  const existing = loadExistingIndex(indexPath);
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  const index = files.map((filename) => {
    const id = basename(filename, '.md');
    const filePath = join(dir, filename);
    const content = readFileSync(filePath, 'utf-8');
    const firstHeading = content.split('\n').find((l) => /^#\s+/.test(l));
    const name = firstHeading ? firstHeading.replace(/^#\s+/, '').trim() : id.replace(/[-_]/g, ' ');
    const md5 = fileMD5(filePath);
    const prev = existing.get(id);
    const updatedAt = (!prev || prev.md5 !== md5) ? fileMtime(filePath) : prev.updatedAt;
    return { id, name, filename, md5, updatedAt };
  });
  writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  console.log(`[output-styles] ${index.length} templates`);
}

function scanSkillStore() {
  const dir = join(agentsDir, 'skills');
  if (!existsSync(dir)) return;
  const indexPath = join(dir, 'index.json');
  const existing = loadExistingIndex(indexPath);
  const index = [];
  const addSkill = (skillDir, skillName, group) => {
    const skillFile = join(skillDir, 'SKILL.md');
    if (!existsSync(skillFile)) return;
    const content = readFileSync(skillFile, 'utf-8');
    const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    let name = skillName;
    if (fm) {
      const nameLine = fm[1].split(/\r?\n/).find((l) => /^\s*name\s*:/i.test(l));
      if (nameLine) name = nameLine.split(':', 2)[1].trim() || skillName;
    }
    const md5 = folderMD5(skillDir);
    const prev = existing.get(skillName);
    const updatedAt = (!prev || prev.md5 !== md5) ? getLatestMtime(skillDir) : prev.updatedAt;
    // 一级目录 skill（group 为空）path 即 skillName；二级 group skill path 为 group/skillName
    const path = group ? `${group}/${skillName}` : skillName;
    index.push({ id: skillName, name, group, path, md5, updatedAt });
  };
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const entryDir = join(dir, entry.name);
    // 一级 skill：目录本身含 SKILL.md
    if (existsSync(join(entryDir, 'SKILL.md'))) {
      addSkill(entryDir, entry.name, '');
      continue;
    }
    // 二级 group：entry 作为 group，遍历其子目录
    for (const skillEntry of readdirSync(entryDir, { withFileTypes: true })) {
      if (!skillEntry.isDirectory()) continue;
      addSkill(join(entryDir, skillEntry.name), skillEntry.name, entry.name);
    }
  }
  writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  console.log(`[skills] ${index.length} skills`);
}

function scanMcpStore() {
  const dir = join(agentsDir, 'mcps');
  if (!existsSync(dir)) return;
  const indexPath = join(dir, 'index.json');
  const existing = loadExistingIndex(indexPath);
  const files = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json');
  const index = files.map((filename) => {
    const id = basename(filename, '.json');
    const filePath = join(dir, filename);
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    const servers = data.mcpServers || data;
    const serverName = Object.keys(servers)[0] || id;
    const config = servers[serverName] || {};
    const envKeys = config.env ? Object.keys(config.env).filter((k) => !config.env[k]) : [];
    const md5 = fileMD5(filePath);
    const prev = existing.get(id);
    const updatedAt = (!prev || prev.md5 !== md5) ? fileMtime(filePath) : prev.updatedAt;
    return {
      id,
      name: serverName,
      description: config.command ? `${config.command} ${(config.args || []).join(' ')}` : '',
      filename,
      needsEnv: envKeys.length > 0 ? envKeys : undefined,
      md5,
      updatedAt,
    };
  });
  writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  console.log(`[mcps] ${index.length} templates`);
}
function scanAgentStore() {
  const dir = join(agentsDir, 'agents');
  if (!existsSync(dir)) return;
  const indexPath = join(dir, 'index.json');
  const existing = loadExistingIndex(indexPath);
  const index = [];
  for (const groupEntry of readdirSync(dir, { withFileTypes: true })) {
    if (!groupEntry.isDirectory()) continue;
    const group = groupEntry.name;
    const groupDir = join(dir, group);
    for (const file of readdirSync(groupDir)) {
      if (!file.endsWith('.md')) continue;
      const id = basename(file, '.md');
      const filePath = join(groupDir, file);
      const content = readFileSync(filePath, 'utf-8');
      const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      let name = id.replace(/[-_]/g, ' ');
      let description = '';
      let emoji = '';
      if (fm) {
        for (const line of fm[1].split(/\r?\n/)) {
          const m = line.match(/^\s*(\w+)\s*:\s*(.+)/);
          if (!m) continue;
          const [, key, val] = m;
          if (key === 'name') name = val.trim();
          else if (key === 'description') description = val.trim();
          else if (key === 'emoji') emoji = val.trim();
        }
      }
      const md5 = fileMD5(filePath);
      const prev = existing.get(id);
      const updatedAt = (!prev || prev.md5 !== md5) ? fileMtime(filePath) : prev.updatedAt;
      index.push({ id, name, group, path: `${group}/${id}`, description, emoji, md5, updatedAt });
    }
  }
  writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  console.log(`[agents] ${index.length} agents`);
}


scanAgentStore();

scanMcpStore();

scanPromptStore();
scanOutputStyleStore();
scanSkillStore();


// ---- Minimal zero-dependency ZIP reader (store + deflate) ----
function readZipEntries(buf) {
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x05 && buf[i + 3] === 0x06) {
      const cdCount = buf.readUInt16LE(i + 10);
      const cdOffset = buf.readUInt32LE(i + 16);
      const entries = [];
      let p = cdOffset;
      for (let j = 0; j < cdCount; j++) {
        if (buf.readUInt32LE(p) !== 0x02014b50) break;
        const compMethod = buf.readUInt16LE(p + 10);
        const compSize = buf.readUInt32LE(p + 20);
        const nameLen = buf.readUInt16LE(p + 28);
        const extraLen = buf.readUInt16LE(p + 30);
        const commentLen = buf.readUInt16LE(p + 32);
        const localHeaderOffset = buf.readUInt32LE(p + 42);
        const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
        entries.push({ name, compMethod, compSize, localHeaderOffset });
        p += 46 + nameLen + extraLen + commentLen;
      }
      return entries;
    }
  }
  throw new Error('Invalid zip: EOCD not found');
}

function readZipEntry(buf, entry) {
  if (entry.name.endsWith('/')) return null; // directory
  const lh = entry.localHeaderOffset;
  const dataStart = lh + 30 + buf.readUInt16LE(lh + 26) + buf.readUInt16LE(lh + 28);
  const raw = buf.subarray(dataStart, dataStart + entry.compSize);
  if (entry.compMethod === 0) return raw;      // stored
  if (entry.compMethod === 8) return inflateRawSync(raw); // deflated
  throw new Error(`Unsupported zip compression for ${entry.name}: ${entry.compMethod}`);
}

function readZip(filePath) {
  const buf = readFileSync(filePath);
  const entries = readZipEntries(buf);
  const findEntry = (name) =>
    entries.find((e) => e.name === name) ||
    entries.find((e) => !e.name.endsWith('/') && e.name.split('/').pop() === name);
  const ICON_RE = /(^|\/)(icon|avatar)\.(png|jpe?g|webp|gif|svg)$/i;
  return {
    read: (name) => {
      const e = findEntry(name);
      return e ? readZipEntry(buf, e) : null;
    },
    findIcon: () =>
      entries.find((e) => e.name === 'icon.png') ||
      entries.find((e) => e.name === 'avatar.png') ||
      entries.find((e) => ICON_RE.test(e.name)) ||
      null,
  };
}


// ---- ZIP store-mode packer (zero-dep, for skillspackage bundling) ----
// 写入 store + deflate 混合 zip：小文本走 deflate 压缩，其余（含内嵌 zip）走 store。
function collectDirFiles(dir, prefix) {
  const out = [];
  for (const file of readdirSync(dir)) {
    if (file === 'node_modules' || file === '.git') continue;
    const fullPath = join(dir, file);
    const rel = prefix ? `${prefix}/${file}` : file;
    const s = statSync(fullPath);
    if (s.isDirectory()) out.push(...collectDirFiles(fullPath, rel));
    else out.push({ rel, fullPath });
  }
  return out;
}

function scanSkillsPackageStore() {
  // 以 {slug}.zip 作为唯一真相源：扫描器只遍历 zip，从 zip 内读 manifest 生成索引。
  // 不再扫描源目录、不再自动重打包——zip 由外部维护。
  const dir = join(agentsDir, 'skillspackage');
  if (!existsSync(dir)) return;
  const indexPath = join(dir, 'index.json');
  const existing = loadExistingIndex(indexPath);
  const index = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.zip')) continue;
    const zipPath = join(dir, entry.name);
    const slugFromFile = entry.name.slice(0, -4);

    // 从 zip 内读 manifest.json：兼容 {slug}/manifest.json 与根 manifest.json 两种布局
    let manifest = {};
    try {
      const zip = readZip(zipPath);
      const raw =
        zip.read(`${slugFromFile}/manifest.json`) ||
        zip.read('manifest.json') ||
        null;
      if (raw) manifest = JSON.parse(raw.toString('utf-8'));
    } catch (e) {
      console.warn(`[skillspackage] skip ${entry.name}: ${e.message}`);
      continue;
    }
    const slug = manifest.slug || slugFromFile;
    const name = manifest.displayName || slug;
    const summary = manifest.summary || '';
    const skillSlugs = Array.isArray(manifest.skillSlugs) ? manifest.skillSlugs : [];

    const md5 = fileMD5(zipPath);
    const prev = existing.get(slug);
    const updatedAt = (!prev || prev.md5 !== md5) ? fileMtime(zipPath) : prev.updatedAt;

    index.push({
      id: slug,
      name,
      summary,
      skillSlugs,
      skillCount: skillSlugs.length,
      zipUrl: `skillspackage/${slug}.zip`,
      md5,
      updatedAt,
    });
  }
  writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  console.log(`[skillspackage] ${index.length} packages`);
}
scanSkillsPackageStore();
