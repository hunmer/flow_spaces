// 仅检查版本；不下载、不安装。打包时 updater 被单独 bundle，避免携带 web 的全部依赖。
export function createAppInfoApi(app, loadUpdater) {
  const getInfo = () => ({ name: 'Flow Spaces', version: app.getVersion(), platform: process.platform, runtime: 'electron', packaged: app.isPackaged });
  let updaterPromise;
  let checking;
  return {
    getInfo,
    checkUpdate() {
      if (!app.isPackaged) return Promise.resolve({ ...getInfo(), disabled: true });
      if (checking) return checking;
      updaterPromise ??= loadUpdater().then(({ autoUpdater }) => {
        autoUpdater.autoDownload = false;
        autoUpdater.autoInstallOnAppQuit = false;
        autoUpdater.on('error', (error) => console.error('[updater]', error));
        return autoUpdater;
      }).catch((error) => { updaterPromise = undefined; throw error; });
      checking = updaterPromise.then(async (updater) => {
        const result = await updater.checkForUpdates();
        if (!result) throw new Error('Update check unavailable');
        return { ...getInfo(), latestVersion: result.updateInfo.version, updateAvailable: result.isUpdateAvailable };
      }).finally(() => { checking = undefined; });
      return checking;
    },
  };
}
