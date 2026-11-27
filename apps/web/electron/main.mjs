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

const DEV_ORIGIN = new URL(DEV_URL).origin;

// window.open 接管：同源（dev server / 应用自身）用新 Electron 窗口打开；
// 外部链接交给系统浏览器。子窗口递归应用同一规则。
function applyWindowOpenHandler(w) {
  w.webContents.setWindowOpenHandler(({ url }) => {
    try {
      if (new URL(url).origin === DEV_ORIGIN) {
        return {
          action: "allow",
          overrideBrowserWindowConfiguration: {
            webPreferences: {
              preload: path.join(__dirname, "preload.mjs"),
              contextIsolation: true,
              nodeIntegration: false,
            },
          },
        };
      }
    } catch { /* 非法 URL，走外部浏览器 */ }
    shell.openExternal(url);
    return { action: "deny" };
  });
  // 新窗口里的 window.open 也应用同一规则
  w.webContents.on("did-create-window", (child) => applyWindowOpenHandler(child));
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

  applyWindowOpenHandler(win);

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
