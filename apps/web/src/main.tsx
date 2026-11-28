/**
 * SPA 入口（对齐原仓库 packages/web/src/app/layout.tsx 的 Provider 树）。
 *
 * 原 Next RootLayout → SPA 等价物：
 *   <html>/<body> className        → index.html 静态类（h-[var(--app-content-height)] overflow-hidden …）
 *   ThemeProvider                  → 直接复用（闭包内原文件，非 next-themes）
 *   LocaleProvider                 → 直接复用（内部已切到 next-intl shim）
 *   AuthGuard + AppShell           → 不迁移：闭包无对应组件；免鉴权模式下以
 *                                     localStorage 预置标记 + /api/auth/check 兜底
 *   Toaster richColors bottom-right→ 保留（业务代码大量使用 sonner toast）
 *   ThemeStyleInit/CustomCursor/       → workspace 壳组件，不在闭包内，不迁移
 *   ViewportInsets（T8 补）            → 补复制（components/layout/viewport-insets.tsx），
 *                                     运行时维护 --app-content-height（visualViewport/键盘 inset），
 *                                     编辑器等 h-full 页面的高度链依赖它
 *   DeferredLayoutFeatures             → 同上不迁移
 *   "flexlayout-react/style/light.css" + "tippy.js/dist/tippy.css" + globals.css
 *                                  → 在此 import（对齐原 layout.tsx:11-13）
 *   #root 高度                        → styles/app-root.css（SPA 特有容器层，
 *                                     原 Next 无 #root；h-full 链在此补齐）
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { LocaleProvider } from "@/components/layout/locale-provider";
import { ViewportInsets } from "@/components/layout/viewport-insets";
import { ElectronTitlebar } from "@/components/layout/electron-titlebar";
import { DevInspector } from "@/components/layout/dev-inspector";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { CustomCursor } from "react-cursor-studio";
import { AppRoutes } from "@/app/router";

import "flexlayout-react/style/light.css";
import "tippy.js/dist/tippy.css";
import "@/styles/globals.css";
import "@/styles/app-root.css";

// 免鉴权环境预置登录标记（lib/auth.ts isAuthenticated() 读取；
// 独立 server 数据目录无 auth.json 时接口层同样放行，双保险）
try {
  if (!localStorage.getItem("flow-spaces-auth-verified")) {
    localStorage.setItem("flow-spaces-auth-verified", "1");
  }
} catch {
  /* ignore */
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <LocaleProvider>
        <ViewportInsets />
        {/* Electron 无边框窗口标题栏（非 Electron 环境渲染 null） */}
        <ElectronTitlebar />
        <BrowserRouter>
          <AppRoutes />
          {/* 全局命令面板（⌘K / Ctrl+K，顶栏搜索按钮触发） */}
          <CommandPalette />
          <Toaster richColors position="bottom-right" />
          {/* 自定义光标引擎（react-cursor-studio）：默认关闭，
              在 设置 → 外观 → 鼠标指针 中激活；触屏设备自动跳过 */}
          <CustomCursor />
          {/* dev-only 组件源码定位器（生产渲染 null，见 dev-inspector.tsx） */}
          <DevInspector />
        </BrowserRouter>
      </LocaleProvider>
    </ThemeProvider>
  </StrictMode>,
);