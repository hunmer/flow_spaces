#!/usr/bin/env node
// Electron 桌面打包统一入口（本地与 CI 共用）。
//
// 用法：node scripts/electron-build.mjs [--skip-build] [-- <electron-builder 参数...>]
//   --skip-build            跳过 pnpm 构建与 deploy（假定产物已就绪，调试打包用）
//   其余参数透传给 electron-builder，如：-- --mac dmg zip --publish always
//
// 流程：
//   1. pnpm build                      → sdk + apps/web vite 产物（dist/）
//   2. server build                    → packages/server/dist（tsc）
//   3. pnpm --filter server --prod deploy → apps/web/electron-build/server-node
//      （把 workspace 依赖展开成普通 node_modules 布局；Node-API 原生模块随包携带）
//   4. 在 apps/web 下调用 electron-builder（配置见 apps/web/electron-builder.yml）
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readlinkSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const skipBuild = args.includes("--skip-build");
const passthrough = args.includes("--") ? args.slice(args.indexOf("--") + 1) : [];

const die = (msg) => { console.error(`[electron-build] ERROR: ${msg}`); process.exit(1); };

const run = (cmd, cmdArgs, opts = {}) => {
  console.log(`\n[electron-build] + ${cmd} ${cmdArgs.join(" ")}`);
  const r = spawnSync(cmd, cmdArgs, { stdio: "inherit", cwd: root, shell: process.platform === "win32", ...opts });
  if (r.status !== 0) die(`command failed: ${cmd} ${cmdArgs.join(" ")}`);
};

if (!skipBuild) {
  run("pnpm", ["build"]); // sdk + web（root script）
  run("pnpm", ["--filter", "@flow-spaces/server", "build"]);
  // deploy 产物目录：先清空，避免残留干扰
  const deployDir = path.join(root, "apps/web/electron-build/server-node");
  if (existsSync(deployDir)) rmSync(deployDir, { recursive: true, force: true });
  // --legacy：workspace 未启用 inject-workspace-packages 时 pnpm v10 要求的标志
  // --no-optional：剔除 @openai/codex-sdk（~242M 平台二进制，无静态引用，UI 按需安装）
  //   与 @codeany/open-agent-sdk —— server 源码不 require 它们（installable 机制运行时装）
  // 注：--config.node-linker=hoisted 会触发 pnpm#lockfile optional 解析 bug（extended-eventsource）
  //   ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY，故保持默认 symlink 布局 + 下方清悬空链接。
  run("pnpm", [
    "--filter", "@flow-spaces/server", "--prod", "--legacy", "--no-optional",
    "deploy", "apps/web/electron-build/server-node",
  ]);
  pruneNodePtyPrebuilds();
}
// 清悬空链接幂等，--skip-build 时也执行（上一次 deploy 的残留同样要清）
removeDanglingSymlinks(path.join(root, "apps/web/electron-build/server-node"));

/** 清理 node_modules 中指向 deploy 目录之外的 symlink。
 *  deploy 输出的 .pnpm/node_modules/@flow-spaces/server 链接指向 workspace 源
 *  （packages/server）——在源目录 stat 正常，但 electron-builder 把它原样拷进
 *  app bundle 后变成悬空链接，signing/打包遍历即 ENOENT。运行时 server 进程
 *  不会 require 自身，删除安全。解析目标在 server-node 内的链接（如 shared）保留。 */
function removeDanglingSymlinks(deployDir) {
  const nmDir = path.join(deployDir, "node_modules");
  if (!existsSync(nmDir)) return;
  const targets = [nmDir, path.join(nmDir, ".pnpm", "node_modules")];
  const checkLink = (dir, name) => {
    const p = path.join(dir, name);
    let st;
    try { st = lstatSync(p); } catch { return; }
    if (!st.isSymbolicLink()) return;
    let resolved;
    try {
      const target = readlinkSync(p);
      resolved = path.resolve(dir, target); // 相对链接按链接所在目录解析
    } catch { return; }
    const inside = resolved.startsWith(deployDir + path.sep);
    if (!inside) {
      console.log(`[electron-build] remove external symlink: ${path.relative(root, p)} -> ${path.relative(root, resolved)}`);
      rmSync(p, { force: true });
    }
  };
  for (const dir of targets) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (name === ".pnpm" || name === ".bin") continue;
      if (name.startsWith("@")) {
        // scope 目录：下钻一层（如 @flow-spaces/server）
        const scopeDir = path.join(dir, name);
        try {
          for (const sub of readdirSync(scopeDir)) checkLink(scopeDir, sub);
        } catch { /* 非 scope 目录结构，忽略 */ }
      } else {
        checkLink(dir, name);
      }
    }
  }
}

// 目标平台（从 passthrough 推断；默认本机）→ 剪掉 node-pty 其他平台的 prebuilds（win32 二进制 ~28M/平台）
function pruneNodePtyPrebuilds() {
  const wantsWin = passthrough.some((a) => /^--win/i.test(a));
  const wantsMac = passthrough.some((a) => /^--mac/i.test(a));
  const target = wantsWin && !wantsMac ? "win" : wantsMac && !wantsWin ? "mac" : process.platform === "win32" ? "win" : "mac";
  const ptyPrebuilds = path.join(root, "apps/web/electron-build/server-node/node_modules/node-pty/prebuilds");
  if (!existsSync(ptyPrebuilds)) return;
  const keep = (name) =>
    target === "win"
      ? name.startsWith("win32-x64") // 只出 x64 安装包；win32-arm64 28M 剔除
      : name.startsWith("darwin-");
  for (const name of readdirSync(ptyPrebuilds)) {
    if (!keep(name)) {
      console.log(`[electron-build] prune node-pty prebuild: ${name}`);
      rmSync(path.join(ptyPrebuilds, name), { recursive: true, force: true });
    }
  }
}

// 产物自检（缺了 electron-builder 会静默打出坏包）
const checks = [
  path.join(root, "apps/web/dist/index.html"),
  path.join(root, "packages/server/dist/app.js"),
  path.join(root, "apps/web/electron-build/server-node/node_modules"),
  path.join(root, "packages/templates"),
];
for (const c of checks) if (!existsSync(c)) die(`missing build artifact: ${c}`);
const serverEntry = path.join(root, "apps/web/electron-build/server-node/dist/app.js");
if (!existsSync(serverEntry)) {
  // pnpm 10 deploy 遵循 files 字段：dist 应在 deploy 输出中；缺失说明 files 配置变化
  console.warn("[electron-build] warn: deploy output missing dist/app.js（extraResources 直接引用 packages/server/dist，可忽略）");
}

run("pnpm", ["--filter", "@flow-spaces/web", "exec", "electron-builder", ...passthrough]);
console.log("\n[electron-build] done. 产物在 apps/web/electron-build/out/");
