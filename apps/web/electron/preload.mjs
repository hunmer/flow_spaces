// preload：向渲染进程注入 window.electronAPI。
// clientPlugins 命名空间与 src/lib/workflow-plugin-api.ts 的 ElectronPluginApi 类型对齐；
// 浏览器环境（无 Electron）下这些方法不可用时，插件逻辑自动回退到服务端 SDK。
import { contextBridge, ipcRenderer } from "electron";

const clientPlugins = {
  listWorkflowPlugins: () => ipcRenderer.invoke("clientPlugins:listWorkflowPlugins"),
  getWorkflowNodes: (pluginId) => ipcRenderer.invoke("clientPlugins:getWorkflowNodes", pluginId),
  installFromStore: (pluginId, sourceUrl, md5, files) =>
    ipcRenderer.invoke("clientPlugins:installFromStore", pluginId, sourceUrl, md5, files),
  uninstall: (pluginId) => ipcRenderer.invoke("clientPlugins:uninstall", pluginId),
};

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,
  clientPlugins,
});
