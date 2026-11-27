# apps/web 开发约定

## 命令

- `pnpm dev`（根）：Vite dev server，端口 5173，代理 `/api` `/ws` `/public` `/static` → server 3110。
- `pnpm typecheck`：`tsc --noEmit -p tsconfig.web.json && tsc --noEmit -p tsconfig.node.json`（web 与 node 两套配置都要过）。
- `pnpm build`（根）：先 `build:packages`（shared→sdk）再 vite build。
- `pnpm --filter @flow-spaces/web electron:dev`：Electron 桌面壳。

## BoardUI 规则（强约束，摘要）

完整规则见 `apps/web/AGENTS.md`（boardui:rules 区块），要点：

- 写任何 UI 前先查 `components/base/`、`components/application/` 是否已有组件；缺组件用 BoardUI MCP `install_components` 或 `npx boardui@latest add <name>` 安装，禁止手写仿品。
- 颜色只用语义 token（`text-text-primary`、`bg-background-primary-default`、`border-border-button-default`、`accent-*`、`chart-1..5`）；禁止裸色板类与 hex/oklch 字面量；暗色模式靠 `.dark` 翻转 token，不写 `dark:` 覆盖。
- 字号排版只用组合工具类（`text-title-1-medium`、`text-body-medium`…），禁止 `text-sm font-medium` 重组；缺样式先查 `styles/typography.css`。
- 类名合并用 `@/utils/cx`（tailwind-merge 感知 BoardUI 排版类）；图标来自 `@remixicon/react`，传组件引用不传元素。
- 表单基于 `react-aria-components`，扩展 BoardUI 表单组件而非裸 `<input>`。
- 内部纵向滚动区顶部要做渐进 blur 软化（复用 `foundations/scroll-fade`，勿重造）。

## 代码约定

- 路径别名 `@` → `src/`；`next/*`、`next-intl` 被 alias 到 `src/shims/`——新代码不要新增 next 依赖导入。
- 后端调用一律走 `src/lib/sdk.ts` 的 SDK 实例；WebSocket 走 `src/lib/ws.ts`。
- 服务端地址解析在 `src/lib/server.ts`（`NEXT_PUBLIC_SERVER_URL` → window.location.hostname 兜底）。
- 状态用 zustand（`src/stores/`，按域拆分）；工作流编辑器状态集中在 `stores/workflow-editor/`。
- i18n 文案在 `src/locales/{en,zh}/*.json`（约 30 个命名空间），经 next-intl shim 使用；改文案后跑根 `scripts/check-locale-parity.mjs` 校验双语齐全。
- 新增页面路由改 `src/app/router.tsx` + 对应 `src/app/<route>/` 客户端壳；列表/首页套 `SidebarRail`，编辑器/预览/登录为全屏路由。
- dev 模式自动启用 react-dev-inspector（点组件跳 IDE 源码），生产构建不受影响。

## 禁止事项

- 不绕过 SDK 直接 fetch 后端；不在组件里写裸色/裸字号类。
- 不改动 vite.config 的 mermaid 闭包逻辑除非理解 TDZ 风险（注释在文件头）。
