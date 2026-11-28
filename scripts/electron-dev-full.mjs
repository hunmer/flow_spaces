#!/usr/bin/env node
// Electron 开发模式：启动或复用后端与 Vite，后端就绪后启动 Electron。
//
// 用法：node scripts/electron-dev-full.mjs
//   （procm-commands.json 的 electron:dev:full 条目指向本脚本）
//
// 背景：apps/web package.json 原有的 electron:dev:full 是 Unix 语法
// （vite & sleep 2 && electron …; kill %1），在 Windows cmd 下 `&` 为顺序
// 执行、vite 永不退出，electron 永远不会启动。本脚本改为并发启动：
// Electron 主进程自带 waitForServer（apps/web/electron/main.mjs），
// 会自行轮询 http://127.0.0.1:5173 就绪（30s 预算，vite 实测 <1s ready）。
// vite 显式 --host 127.0.0.1：Vite v7 默认只绑 IPv6 ::1，而 DEV_URL 是
// IPv4 字面地址（main.mjs:17），需对齐。
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { ensureDevServer } from "./dev-server.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webDir = path.join(root, "apps", "web");
const win = process.platform === "win32";
let backend = null;
let vite = null;
let electron = null;
let exiting = false;

const start = (name, cmd, cmdArgs, options = {}) => {
  const child = spawn(cmd, cmdArgs, {
    cwd: webDir,
    // 不继承 procm 的 stdin/管道句柄，避免 Windows 子进程启动阻塞。
    stdio: ["ignore", "pipe", "pipe"],
    shell: false, // 直接运行 Node，兼容包含空格的安装路径。
    ...options,
  });
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
  console.log(`[dev-full] ${name} started pid=${child.pid}`);
  child.on("error", (error) => {
    console.error(`[dev-full] ${name} 启动失败: ${error.message}`);
    shutdown(1);
  });
  child.on("exit", (code) => {
    console.log(`[dev-full] ${name} exited code=${code}`);
    shutdown(name === "electron" ? (code ?? 0) : 1);
  });
  return child;
};

const devUrl = process.env.ELECTRON_DEV_URL || "http://127.0.0.1:5173";
let serverReady = false;
try {
  serverReady = (await fetch(devUrl, { signal: AbortSignal.timeout(2000) })).ok;
} catch { /* 未启动，由本脚本拉起默认 Vite */ }
// 显式指定的服务由调用者管理，不替换其地址。
vite = !serverReady && !process.env.ELECTRON_DEV_URL
  ? start("vite", process.execPath, [path.join(webDir, "node_modules", "vite", "bin", "vite.js"), "--host", "127.0.0.1", "--port", "5173", "--strictPort"])
  : null;
console.log(`[dev-full] ${serverReady ? "复用前端服务" : "等待前端服务"} ${devUrl}`);
function killTree(child) {
  if (!child || child.exitCode !== null || !child.pid) return;
  if (win) {
    // win 上 child.kill 只杀 pnpm 壳，需 taskkill /T 收整个子树
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  } else {
    child.kill("SIGTERM");
  }
}

function shutdown(exitCode) {
  if (exiting) return;
  exiting = true;
  killTree(backend);
  killTree(vite);
  killTree(electron);
  // 给 taskkill 一点时间完成清理再退出
  setTimeout(() => process.exit(exitCode ?? 0), 800);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(0));
}

try {
  const backendUrl = process.env.NEXT_PUBLIC_SERVER_URL || process.env.SERVER_URL || "http://127.0.0.1:3110";
  const target = new URL(backendUrl);
  await ensureDevServer({
    url: backendUrl,
    start: () => {
      if (process.env.NEXT_PUBLIC_SERVER_URL || process.env.SERVER_URL) {
        throw new Error(`指定的后端不可用，请先启动: ${backendUrl}`);
      }
      const serverDir = path.join(root, "packages", "server");
      backend = start("backend", process.execPath, [path.join(serverDir, "node_modules", "tsx", "dist", "cli.mjs"), "watch", "src/app.ts"], {
        cwd: serverDir,
        env: { ...process.env, PORT: target.port || "3110", HOST: target.hostname },
      });
      return backend;
    },
  });
  console.log(`[dev-full] 后端已就绪 ${backendUrl}`);
  if (!exiting) electron = start("electron", process.execPath, [path.join(root, "scripts", "electron-dev.mjs")]);
} catch (error) {
  console.error(`[dev-full] ${error.message}`);
  shutdown(1);
}
