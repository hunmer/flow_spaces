#!/usr/bin/env node
// Electron 开发模式：复用已有 Vite，否则并发启动 Vite 与 Electron。
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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webDir = path.join(root, "apps", "web");
const win = process.platform === "win32";

const start = (name, cmd, cmdArgs) => {
  const child = spawn(cmd, cmdArgs, {
    cwd: webDir,
    stdio: "inherit",
    shell: false, // 直接运行 Node，兼容包含空格的安装路径。
  });
  console.log(`[dev-full] ${name} started pid=${child.pid}`);
  return child;
};

const devUrl = process.env.ELECTRON_DEV_URL || "http://127.0.0.1:5173";
let serverReady = false;
try {
  serverReady = (await fetch(devUrl, { signal: AbortSignal.timeout(2000) })).ok;
} catch { /* 未启动，由本脚本拉起默认 Vite */ }
// 显式指定的服务由调用者管理，不替换其地址。
const vite = !serverReady && !process.env.ELECTRON_DEV_URL
  ? start("vite", process.execPath, [path.join(webDir, "node_modules", "vite", "bin", "vite.js"), "--host", "127.0.0.1", "--port", "5173", "--strictPort"])
  : null;
console.log(`[dev-full] ${serverReady ? "复用前端服务" : "等待前端服务"} ${devUrl}`);
const electron = start("electron", process.execPath, [path.join(root, "scripts", "electron-dev.mjs")]);

let exiting = false;
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
  killTree(vite);
  killTree(electron);
  // 给 taskkill 一点时间完成清理再退出
  setTimeout(() => process.exit(exitCode ?? 0), 800);
}

// 任一成员退出即整体收尾：electron 关窗 = 正常结束；vite 崩溃也不留孤儿窗口
for (const [name, child] of [["vite", vite], ["electron", electron]]) {
  if (!child) continue;
  child.on("error", (error) => {
    console.error(`[dev-full] ${name} 启动失败: ${error.message}`);
    shutdown(1);
  });
  child.on("exit", (code) => {
    console.log(`[dev-full] ${name} exited code=${code}`);
    shutdown(name === "electron" ? (code ?? 0) : 1);
  });
}
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(0));
}
