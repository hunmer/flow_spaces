#!/usr/bin/env node
// Electron 桌面打包统一入口（本地与 CI 共用）。
//
// 用法：node scripts/electron-build.mjs [--skip-build] [-- <electron-builder 参数...>]
//   --skip-build            跳过 pnpm 构建与依赖安装（假定产物已就绪，调试打包用）
//   其余参数透传给 electron-builder，如：-- --mac dmg zip --publish always
//
// 流程：
//   1. pnpm build                      → sdk + apps/web vite 产物（dist/）
//   2. server build                    → packages/server/dist（tsc）
//   3. frozen-lockfile + hoisted install → apps/web/electron-build/server-node
//      （独立生产依赖目录，避免 Windows 安装器展开 pnpm 链接造成重复与解析错误）
//   4. 在 apps/web 下调用 electron-builder（配置见 apps/web/electron-builder.yml）
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { deployElectronServer, prepareElectronRuntime } from './electron-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRequire = createRequire(path.join(root, 'apps/web/package.json'));
await build({
  entryPoints: [webRequire.resolve('electron-updater')],
  outfile: path.join(root, 'apps/web/electron/updater.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron'],
});
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
  // 生产依赖暂存目录：先清空，避免残留干扰
  const deployDir = path.join(root, "apps/web/electron-build/server-node");
  if (existsSync(deployDir)) rmSync(deployDir, { recursive: true, force: true });
  deployElectronServer({ root, webRequire, run });
}
pruneNodePtyPrebuilds();
await prepareElectronRuntime({ root, webRequire, args: passthrough });

// 保留目标平台与架构的 PTY 预编译模块。
function pruneNodePtyPrebuilds() {
  const platform = passthrough.includes('--win') ? 'win32' : passthrough.includes('--mac') ? 'darwin' : passthrough.includes('--linux') ? 'linux' : process.platform;
  const arch = passthrough.includes('--arm64') ? 'arm64' : passthrough.includes('--x64') ? 'x64' : process.arch;
  const prebuilds = path.join(root, 'apps/web/electron-build/server-node/node_modules/node-pty/prebuilds');
  if (!existsSync(prebuilds)) return;
  for (const name of readdirSync(prebuilds)) {
    if (name !== platform + '-' + arch) {
      console.log('[electron-build] prune node-pty prebuild: ' + name);
      rmSync(path.join(prebuilds, name), { recursive: true, force: true });
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
run("pnpm", ["--filter", "@flow-spaces/web", "exec", "electron-builder", ...passthrough]);
console.log("\n[electron-build] done. 产物在 apps/web/electron-build/out/");
