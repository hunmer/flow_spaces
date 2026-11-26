# apps/web 入口与启动

## 开发启动

```
pnpm dev            # = pnpm --filter @flow-spaces/web dev → vite（5173）
pnpm dev:server     # 另终端：server（3110），或用 procm: procm-command dev/dev:server
pnpm dev:all        # build:packages 后同时起 server 与 web
```

前置：workspace 依赖 `@flow-spaces/shared`、`@flow-spaces/sdk` 需已构建（`pnpm build:packages`），否则 SDK 类型/运行时缺失。

## 入口链

1. `index.html` — SPA 壳（`#root`、静态 class：`h-[var(--app-content-height)] overflow-hidden` 等）。
2. `src/main.tsx` — 挂载 Provider 树：
   - `ThemeProvider`（自持实现，非 next-themes）
   - `LocaleProvider`（next-intl shim，en/zh）
   - `ViewportInsets`（运行时维护 `--app-content-height`，visualViewport/键盘 inset）
   - `DevInspector`、`CommandPalette`、`CustomCursor`、`Toaster`（sonner）
   - `BrowserRouter` + `AppRoutes`
3. `src/app/router.tsx` — 路由表（见 public-interfaces.md）。

## 构建流程

- `vite build`：React 插件 + tailwindcss v4 + dev-inspector（仅 dev）；rollup manualChunks 按库拆 vendor（mermaid 闭包 BFS 逻辑见 `vite.config.ts` 头部注释，勿随意改动分组顺序）。
- postinstall：把 `node_modules/monaco-editor/min/vs` 复制到 `public/monaco/vs`（Monaco 由 public 静态路径加载，不走 bundle）。
- `electron:dev`：起 vite 后 `electron electron/main.mjs`。

## 运行时初始化要点

- 免鉴权模式：localStorage 预置标记 + `/api/auth/check` 兜底（原 Next AuthGuard 未迁移）。
- WS 连接与重连：`src/lib/ws.ts`；终端会话：`lib/terminal-registry.ts`。
- Monaco 按需：`lib/monaco-loader.ts` 从 `/monaco/vs` 加载。
