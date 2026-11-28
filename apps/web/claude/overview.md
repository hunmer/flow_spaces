# apps/web 架构总览

## 定位

`@flow-spaces/web` 是 flow-spaces 的 Web 前端：Vite + React 19 SPA，从 flow-spaces（Next.js App Router）迁移而来（迁移笔记已不随仓分发）。承载三大界面域：

1. **工作流编辑器**（`/workflows/:id`）：基于 @xyflow/react 的可视化节点画布，126+ 文件，是本项目最重的业务模块。
2. **Mini App 平台**（`/mini-apps`、`/mini-apps/:id`、`/mini-apps-preview`）：迷你应用的列表、编辑与运行预览；预览态在 Babel standalone 沙箱中渲染用户 JSX。
3. **聊天与首页壳**（`/home`、`SidebarRail` 布局）：仪表盘首页、命令面板、会话流。

## 运行形态

- 开发：`vite`（端口 5173），`/api`、`/ws`、`/public`、`/static` 代理到 flow-spaces server（默认 `http://127.0.0.1:3110`，可用 `SERVER_URL` 覆盖）。
- 构建：`vite build`，rollup `manualChunks` 按库拆 vendor chunk（codemirror/katex/tiptap/xyflow/recharts/babel/elk/icons/aria/media/framer-motion/react/misc）。
- 桌面：`electron/main.mjs` + `preload.mjs`（`pnpm electron:dev`）。
- 部署产物由 server 静态服务（server 仓库 `public/` + `/static` 路由）。

## 关键设计取舍

- **Next 兼容 shim**：原代码 `next/*`、`next-intl` 导入通过 vite alias 重写到 `src/shims/`，业务文件零改动完成 SPA 化。
- **BoardUI 源码级组件**（`components/base|application|foundations`）随仓库持有，配 `boardui.json` alias 与 BoardUI MCP 安装/更新；颜色/字体必须走语义 token（见 `AGENTS.md` 规则）。
- **SDK 单例**：所有后端调用经 `@flow-spaces/sdk`（`src/lib/sdk.ts` 创建），组件不直接 fetch。
- **#root 高度链**：`styles/app-root.css` + `ViewportInsets`（`--app-content-height`）支撑编辑器等 `h-full` 页面，键盘弹出/视口变化时保持布局。

## 边界

- 不含后端逻辑；数据契约在 `@flow-spaces/shared`。
- 服务端渲染相关（原 Next layout 的 AuthGuard 等）未迁移：免鉴权模式 + localStorage 预置 + `/api/auth/check` 兜底。
