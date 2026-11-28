#!/usr/bin/env node
// 在 Electron 原生初始化之前修复 Windows 完整性标记；放在 main.mjs 中已来不及。
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webDir = path.join(root, "apps", "web");
const require = createRequire(path.join(webDir, "package.json"));
const electronPath = require("electron");

// 仅开发环境生效：icacls 完整性修复只应在 dev 启动链（electron:dev /
// electron:dev:full → 本脚本）执行；生产/打包路径不得改动系统 ACL。
const devOnly = process.env.NODE_ENV !== "production" && process.env.ELECTRON_SKIP_DEV_REPAIR !== "1";
if (process.platform === "win32" && devOnly) {
  // 工作区的 Low 标签可能被重新安装的文件继承。只处理 Electron 运行目录，
  // 包括 DLL 和资源：仅恢复 exe 仍可能导致 renderer 启动失败。
  const repair = spawnSync("icacls.exe", [
    path.dirname(electronPath), "/setintegritylevel", "(OI)(CI)M", "/T", "/C", "/Q",
  ], { encoding: "utf8", windowsHide: true });
  if (repair.error || repair.status !== 0) {
    console.error("[electron-dev] 无法恢复 Electron 目录的中完整性标记：",
      repair.error?.message || repair.stderr || repair.stdout);
    process.exit(1);
  }
  console.log("[electron-dev] Electron 运行目录已恢复为中完整性");
}

const child = spawn(electronPath, ["electron/main.mjs", ...process.argv.slice(2)], {
  cwd: webDir,
  stdio: "inherit",
});
child.on("error", (error) => {
  console.error("[electron-dev] 启动失败：", error.message);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
