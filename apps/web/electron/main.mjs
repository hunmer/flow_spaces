// Electron 主进程：开发模式下加载 Vite dev server（端口与 vite.config.ts 的 5173 对齐）。
import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEV_URL = process.env.ELECTRON_DEV_URL || "http://127.0.0.1:5173";

async function waitForServer(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 外部链接交给系统浏览器打开
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  const up = await waitForServer(DEV_URL);
  if (up) {
    await win.loadURL(DEV_URL);
  } else {
    await win.loadURL(`data:text/html,<h3>无法连接 ${DEV_URL}</h3><p>请先运行 pnpm dev</p>`);
  }
}

// —— clientPlugins 命名空间 IPC（最小实现：无本地插件管理器时返回空/失败） ——
ipcMain.handle("clientPlugins:listWorkflowPlugins", () => []);
ipcMain.handle("clientPlugins:getWorkflowNodes", () => []);
ipcMain.handle("clientPlugins:installFromStore", () => {
  throw new Error("client plugin install not implemented in this shell");
});
ipcMain.handle("clientPlugins:uninstall", () => ({ success: false }));

app.whenReady().then(async () => {
  await createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
