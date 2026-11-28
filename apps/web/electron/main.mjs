// Electron 主进程。
// - 开发模式（未打包）：加载 Vite dev server（端口与 vite.config.ts 的 5173 对齐）。
// - 生产模式（app.isPackaged）：以 ELECTRON_RUN_AS_NODE 子进程启动内嵌 server
//   （resources/server/dist/app.js，原生依赖由打包脚本按 Electron ABI 准备），
//   前端由 server 静态服务（resources/server/web）。
//   数据写入 userData/data（FLOW_SPACES_DATA_DIR），与开发环境的 ~/.flow-spaces-data 隔离。
import { app, BrowserWindow, WebContentsView, ipcMain, nativeImage, shell } from "electron";
import { attachWindowLoader } from "./window-loader.mjs";
import { createAppInfoApi } from "./app-info.mjs";
import { spawn } from "node:child_process";
import net from "node:net";
import { createMacMiniAppShortcut, miniAppLaunchId, miniAppLaunchUrl, miniAppShortcut, saveMiniAppShortcutIcon } from "./mini-app-shortcuts.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 统一 app 名称（userData/日志目录名）：package.json 的 scoped name 会生成
// ~/Library/Application Support/@flow-spaces/web 这样的目录，必须尽早重设。
app.setName("flow-spaces");
// Windows 任务栏分组/图标缓存锚点：不设置时任务栏会跟随 electron.exe 的
// 缓存（开发模式下常显示默认 atom 图标）。与 electron-builder.yml 的 appId 一致。
app.setAppUserModelId("com.flowspaces.desktop");
const DEV_URL = process.env.ELECTRON_DEV_URL || "http://127.0.0.1:5173";

const IS_PACKAGED = app.isPackaged;
// 覆盖用：FLOW_SPACES_PORT 固定端口（调试）；缺省动态探测空闲端口
const FIXED_PORT = process.env.FLOW_SPACES_PORT ? parseInt(process.env.FLOW_SPACES_PORT, 10) : null;

/** 探测一个空闲 TCP 端口（listen 0 由内核分配）。 */
function pickFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

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
let appOrigin = DEV_ORIGIN; // 生产模式下启动后更新

const appInfoApi = createAppInfoApi(app, async () => (await import('./updater.cjs')).default);
for (const [channel, handler] of [['appInfo:get', appInfoApi.getInfo], ['appInfo:checkUpdate', appInfoApi.checkUpdate]]) {
  ipcMain.handle(channel, (event) => {
    if (new URL(event.sender.getURL()).origin !== appOrigin) throw new Error('Untrusted app origin');
    return handler();
  });
}

// 主/子窗口统一默认外观：尺寸 + 开发模式任务栏图标。
// Windows 下窗口图标必须用 .ico（PNG 会被静默忽略）；其余平台用 .png。
// （打包后 win 用 exe 内嵌 ico、mac 用 Dock 图标，无需显式 icon）
const DEV_WINDOW_ICON = IS_PACKAGED
  ? undefined
  : path.join(__dirname, "..", "build", process.platform === "win32" ? "icon.ico" : "icon.png");

const DEFAULT_WINDOW_OPTIONS = {
  width: 1440,
  height: 900,
  ...(DEV_WINDOW_ICON ? { icon: DEV_WINDOW_ICON } : {}),
  // 无边框窗口：标题栏由渲染进程 ElectronTitlebar 绘制（macOS 风格红绿灯 + 拖拽区），
  // 拖拽经 CSS -webkit-app-region: drag 实现，无需 IPC。
  // 注意：不要设置 titleBarStyle —— macOS 下 frame:false 时任何非 normal 的
  // titleBarStyle（如 "hidden"）都会让系统原生红绿灯重新显示
  // （native_window_mac.mm: 非 kNormal 即 InternalSetWindowButtonVisibility(true)），
  // 与渲染层自绘红绿灯重叠。不设则红绿灯隐藏（kNormal 分支）。
  frame: false,
};

// window.open 接管：同源（dev server / 应用自身）用新 Electron 窗口打开；
// 外部链接交给系统浏览器。子窗口递归应用同一规则。
function applyWindowOpenHandler(w) {
  attachWindowLoader(w, WebContentsView);
  w.webContents.on("preload-error", (_event, preloadPath, error) => {
    console.error(`[electron] preload failed: ${preloadPath}`, error);
  });
  w.webContents.setWindowOpenHandler(({ url }) => {
    try {
      if (new URL(url).origin === appOrigin) {
        // 手动创建子窗口：overrideBrowserWindowConfiguration 无法可靠覆盖
        // webPreferences.preload（preload 不注入 → electronAPI 缺失 → 标题栏不渲染），
        // 因此 deny 后自建 BrowserWindow，确保 frameless + preload 全部生效。
        const child = new BrowserWindow({
          ...DEFAULT_WINDOW_OPTIONS,
          webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),
            contextIsolation: true,
            nodeIntegration: false,
          },
        });
        applyWindowOpenHandler(child);
        child.loadURL(url).catch((e) => console.error("[electron] 子窗口加载失败:", e));
        return { "action": "deny" };
      }
    } catch { /* 非法 URL，走外部浏览器 */ }
    shell.openExternal(url);
    return { "action": "deny" };
  });
  // 新窗口里的 window.open 也应用同一规则
  w.webContents.on("did-create-window", (child) => applyWindowOpenHandler(child));
  // F12 切换 DevTools（无边框窗口无系统菜单可用）
  w.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && input.key === "F12") {
      w.webContents.toggleDevTools();
      event.preventDefault();
    }
  });
  // 最大化状态变化同步给渲染进程（红绿灯图标切换）
  w.on("maximize", () => w.webContents.send("windowControls:maximizeChanged", true));
  w.on("unmaximize", () => w.webContents.send("windowControls:maximizeChanged", false));
}

// ---------------- 生产模式：内嵌 server 子进程 ----------------
let serverChild = null;

function log(tag, chunk) {
  const text = chunk.toString().trimEnd();
  if (text) console.log(`[server] ${text}`); // 进程 stdout / 控制台可见
}

function startEmbeddedServer() {
  const resourcesDir = process.resourcesPath; // <app>/Contents/Resources
  const serverRoot = path.join(resourcesDir, "server");
  const serverEntry = path.join(serverRoot, "dist", "app.js");
  return pickFreePort().then((port) =>
    new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [serverEntry], {
        cwd: serverRoot,
        env: {
          ...process.env,
          // 用 Electron 二进制自带 Node 跑 server；Node-API 模块跨 ABI 兼容
          ELECTRON_RUN_AS_NODE: "1",
          ELECTRON_NO_ATTACH_CONSOLE: "1",
          PORT: String(FIXED_PORT ?? port),
          HOST: "127.0.0.1", // 桌面应用只监听本机回环
          FLOW_SPACES_DATA_DIR: path.join(app.getPath("userData"), "data"),
          // 不继承 procm 接管（独立桌面实例）
          PROCM_ROOM_ID: "",
          PROCM_WS_URL: "",
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      serverChild = child;
      child.stdout.on("data", (c) => log("out", c));
      child.stderr.on("data", (c) => log("err", c));
      child.on("exit", (code, signal) => {
        console.log(`[server] exited code=${code} signal=${signal}`);
        serverChild = null;
      });
      resolve(FIXED_PORT ?? port);
    })
  );
}

/** 终止 server 及其派生进程树（win 上 child.kill 只杀主进程）。 */
function killEmbeddedServer() {
  if (!serverChild || serverChild.killed) return;
  const pid = serverChild.pid;
  try {
    if (process.platform === "win32" && pid) {
      spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    } else {
      serverChild.kill("SIGTERM");
    }
  } catch (e) {
    console.warn("[server] kill failed:", e?.message);
  }
  serverChild = null;
}

async function createWindow(miniAppId) {
  const win = new BrowserWindow({
    ...DEFAULT_WINDOW_OPTIONS,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  applyWindowOpenHandler(win);

  let loadTarget;
  if (IS_PACKAGED) {
    const port = await startEmbeddedServer();
    loadTarget = `http://127.0.0.1:${port}`;
    appOrigin = `http://127.0.0.1:${port}`;
    const up = await waitForServer(loadTarget, 30000);
    if (!up) {
      await win.loadURL(
        `data:text/html,<h3>Server failed to start</h3><p>${loadTarget}</p><p>Check application logs.</p>`,
      );
      return win;
    }
  } else {
    console.log(`[electron] 等待前端服务 ${DEV_URL}`);
    const up = await waitForServer(DEV_URL);
    if (!up) {
      console.error(`[electron] 前端服务连接超时: ${DEV_URL}`);
      await win.loadURL(`data:text/html,<h3>无法连接 ${DEV_URL}</h3><p>请先运行 pnpm dev</p>`);
      return win;
    }
    loadTarget = DEV_URL;
  }
  await win.loadURL(miniAppId ? miniAppLaunchUrl(appOrigin, miniAppId) : loadTarget);
  console.log(`[electron] 页面已加载 ${loadTarget}`);
  return win;
}

// 快捷方式保存 ID，启动时解析当前动态 server 端口。
async function openMiniApp(id) {
  const url = miniAppLaunchUrl(appOrigin, id);
  const existing = BrowserWindow.getAllWindows().find((win) => win.webContents.getURL() === url);
  if (existing) {
    if (existing.isMinimized()) existing.restore();
    existing.focus();
    return;
  }
  const win = new BrowserWindow({
    ...DEFAULT_WINDOW_OPTIONS,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  applyWindowOpenHandler(win);
  await win.loadURL(url);
}

ipcMain.handle("miniApps:createDesktopShortcut", (event, project) => {
  if ((process.platform !== "win32" && process.platform !== "darwin") ||
      new URL(event.sender.getURL()).origin !== appOrigin) {
    throw new Error("Desktop shortcuts are unavailable");
  }
  const shortcut = {
    id: project?.id,
    name: project?.name,
    executable: process.execPath,
    appPath: path.join(__dirname, "main.mjs"),
    packaged: IS_PACKAGED,
  };
  const desktop = app.getPath("desktop");
  if (process.platform === "darwin") {
    createMacMiniAppShortcut(desktop, shortcut, project?.iconBuffer);
    return;
  }
  const { filename, options } = miniAppShortcut(shortcut);
  const icon = saveMiniAppShortcutIcon(path.join(app.getPath("userData"), "mini-app-icons"), project.id, project.iconBuffer);
  if (!shell.writeShortcutLink(path.join(desktop, filename), "create", {
    ...options,
    cwd: path.dirname(process.execPath),
    icon,
    iconIndex: 0,
  })) throw new Error("Failed to create desktop shortcut");
});

// —— clientPlugins 命名空间 IPC（最小实现：无本地插件管理器时返回空/失败） ——
ipcMain.handle("clientPlugins:listWorkflowPlugins", () => []);
ipcMain.handle("clientPlugins:getWorkflowNodes", () => []);
ipcMain.handle("clientPlugins:installFromStore", () => {
  throw new Error("client plugin install not implemented in this shell");
});
ipcMain.handle("clientPlugins:uninstall", () => ({ success: false }));

// —— 自定义标题栏（无边框窗口）IPC：窗口控制 + 最大化状态同步 ——
ipcMain.on("windowControls:minimize", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});
ipcMain.on("windowControls:toggleMaximize", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});
ipcMain.on("windowControls:close", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});
ipcMain.handle("windowControls:isMaximized", (event) =>
  BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false,
);
// 动态窗口图标（mini-app 预览子窗口显示自己的头像）：渲染进程传图片字节
ipcMain.on("windowControls:setIcon", (event, buffer) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    const image = nativeImage.createFromBuffer(Buffer.from(buffer));
    if (win && !image.isEmpty()) win.setIcon(image);
  } catch (e) {
    console.warn("[electron] setIcon failed:", e?.message);
  }
});

// 单实例锁：避免双开时两个内嵌 server 同写一个数据目录
if (!app.requestSingleInstanceLock()) {
  console.log("[electron] 已有实例运行，正在激活已有窗口");
  app.quit();
} else {
  let startup;
  app.on("second-instance", (_event, argv) => {
    const id = miniAppLaunchId(argv);
    if (id) {
      startup.then(() => openMiniApp(id)).catch((error) => console.error("[electron] Mini App 打开失败:", error));
      return;
    }
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  startup = app.whenReady().then(async () => {
    await createWindow(miniAppLaunchId(process.argv));
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  }).catch((error) => {
    console.error("[electron] 启动失败:", error);
    app.exit(1);
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("will-quit", () => {
    killEmbeddedServer();
  });
}
