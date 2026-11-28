import { fileURLToPath } from "node:url";

const loaderFile = fileURLToPath(new URL("./window-loader.html", import.meta.url));

// 独立于应用页面，在等待服务、下载脚本时也能显示。透明原生视图支持叠在页面上渐隐。
export function attachWindowLoader(win, WebContentsView) {
  const contents = win.webContents;
  let current;
  const resize = () => {
    if (!current || win.isDestroyed()) return;
    const [width, height] = win.getContentSize();
    current.view.setBounds({ x: 0, y: 0, width, height });
  };
  const dispose = (entry) => {
    if (!entry || entry.disposed) return;
    entry.disposed = true;
    if (current === entry) current = undefined;
    if (!win.isDestroyed()) win.contentView.removeChildView(entry.view);
    // WebContentsView 的 webContents 不会随父窗口自动销毁。
    if (!entry.view.webContents.isDestroyed()) entry.view.webContents.close();
  };
  const show = () => {
    if (current && !current.hiding) {
      resize();
      return;
    }
    dispose(current);
    const view = new WebContentsView({
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
    });
    view.setBackgroundColor("#00000000");
    const entry = { view };
    current = entry;
    win.contentView.addChildView(view);
    resize();
    entry.ready = view.webContents.loadFile(loaderFile).catch((error) => {
      if (entry.disposed) return;
      console.warn("[electron] loader failed:", error);
      dispose(entry);
    });
  };
  const hide = async () => {
    const entry = current;
    if (!entry || entry.hiding) return;
    entry.hiding = true;
    await entry.ready;
    if (current !== entry || entry.view.webContents.isDestroyed()) return;
    try {
      await entry.view.webContents.executeJavaScript(`
        document.documentElement.animate(
          [{ opacity: 1 }, { opacity: 0 }],
          { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 280, fill: 'forwards', easing: 'ease-out' }
        ).finished.then(() => undefined)
      `);
    } catch { /* 窗口关闭或下一次导航时，动画可能中断。 */ }
    if (current === entry) dispose(entry);
  };
  const navigation = (_event, _url, isInPlace, isMainFrame) => {
    if (isMainFrame && !isInPlace) show();
  };
  const failed = (_event, code, _description, _url, isMainFrame) => {
    if (isMainFrame && code !== -3) void hide(); // ERR_ABORTED 通常是重定向/新导航。
  };
  win.on("resize", resize);
  contents.on("did-start-navigation", navigation);
  contents.on("did-finish-load", hide);
  contents.on("did-fail-load", failed);
  win.once("closed", () => {
    win.removeListener("resize", resize);
    contents.removeListener("did-start-navigation", navigation);
    contents.removeListener("did-finish-load", hide);
    contents.removeListener("did-fail-load", failed);
    dispose(current);
  });
  show();
}
