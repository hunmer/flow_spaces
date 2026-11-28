// preload：向渲染进程注入 window.electronAPI。
// clientPlugins 命名空间与 src/lib/workflow-plugin-api.ts 的 ElectronPluginApi 类型对齐；
// 浏览器环境（无 Electron）下这些方法不可用时，插件逻辑自动回退到服务端 SDK。
// 沙箱 preload 使用 CommonJS，由 Electron 提供受限的 require。
const { contextBridge, ipcRenderer } = require("electron");

const clientPlugins = {
  listWorkflowPlugins: () => ipcRenderer.invoke("clientPlugins:listWorkflowPlugins"),
  getWorkflowNodes: (pluginId) => ipcRenderer.invoke("clientPlugins:getWorkflowNodes", pluginId),
  installFromStore: (pluginId, sourceUrl, md5, files) =>
    ipcRenderer.invoke("clientPlugins:installFromStore", pluginId, sourceUrl, md5, files),
  uninstall: (pluginId) => ipcRenderer.invoke("clientPlugins:uninstall", pluginId),
};

// 自定义标题栏（无边框窗口）窗口控制 API
const windowControls = {
  minimize: () => ipcRenderer.send("windowControls:minimize"),
  toggleMaximize: () => ipcRenderer.send("windowControls:toggleMaximize"),
  close: () => ipcRenderer.send("windowControls:close"),
  isMaximized: () => ipcRenderer.invoke("windowControls:isMaximized"),
  // 订阅最大化状态变化（win.on('maximize'/'unmaximize') 侧推送）
  onMaximizeChange: (callback) => {
    const listener = (_event, maximized) => callback(maximized);
    ipcRenderer.on("windowControls:maximizeChanged", listener);
    return () => ipcRenderer.removeListener("windowControls:maximizeChanged", listener);
  },
};

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,
  clientPlugins,
  windowControls,
});
