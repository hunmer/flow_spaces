# apps/web (`@flow-spaces/web`)

Vite + React 19 SPA 前端（自 flow-spaces Next.js 迁移）。三大界面域：工作流可视化编辑器（xyflow）、Mini App 平台（列表/编辑/Babel 沙箱预览）、聊天与首页壳。UI 基于 BoardUI 源码级组件库 + Tailwind v4 语义 token。

## 约定

- 写 UI 前先查 `components/base|application/`；BoardUI 规则全文见 `AGENTS.md`（boardui:rules 区块）：颜色/排版只用语义 token 与组合工具类。
- 后端调用一律走 `lib/sdk.ts` 的 SDK 实例；WS 走 `lib/ws.ts`。
- 新路由改 `src/app/router.tsx`；文案进 `src/locales/{en,zh}/`，提交前跑根 `scripts/check-locale-parity.mjs`。
- 勿新增 `next/*` 导入（alias 到 shims，仅为兼容存量）；勿改 `vite.config.ts` mermaid 闭包逻辑。
- dev 5173 代理到 server 3110；`pnpm typecheck` 两套 tsconfig 都要过。

## 文件索引

| 文件 | 用途 | 何时阅读 |
|---|---|---|
| [架构总览](claude/overview.md) | 运行形态、设计取舍、边界 | 首次接触 |
| [开发约定](claude/conventions.md) | 命令、BoardUI 规则摘要、禁止事项 | 写任何代码前 |
| [模块职责](claude/module-responsibilities.md) | src/ 与 components/ 子域划分 | 定位功能 |
| [入口与启动](claude/entrypoints.md) | 入口链、构建流程、初始化 | 启动/排查 |
| [对外接口](claude/public-interfaces.md) | 页面路由表、后端消费面 | 加页面/接口 |
| [依赖与配置](claude/dependencies-and-config.md) | 依赖、vite/tsconfig/boardui 配置、环境变量 | 升级/配置问题 |
| [数据模型](claude/data-model.md) | stores、数据流、本地持久化 | 改状态/数据流 |
| [测试与质量](claude/testing-and-quality.md) | typecheck、现有测试、风险 | 提交前 |
| [文件索引](claude/file-map.md) | 目录结构速查 | 找文件 |
| [FAQ](claude/faq.md) | 白屏/Monaco/i18n/高度链等 | 排错 |
| [变更记录](claude/changelog.md) | 索引更新历史 | 了解变更 |

## 扫描状态

- **更新时间**: 2026-11-27（init-project 增量更新：商店拆仓）
- **2026-11-27 增量**: 商店消费改外部仓库——`lib/agent-store.ts`（`resolveStoreUrl`/`REPO_ROUTES`/`parseGithubRepoUrl`，默认 gh-proxy raw，镜像存 localStorage `flow-spaces:store-api-base`，旧同源 `/agents-store` base 自动清除）成为 plugins/workflows/mini-app 三类商店索引的统一入口（消费点 6 处：mini-apps-page / workflows-page / workflow-plugins-dialog / agent-dialog-data / mcps-dialog / use-skills-data）；本地 `/agents-store` 仅剩 agents/mcps/skills 等无前缀内容。
- **已扫描**: src/ 全子树结构、vite/tsconfig/AGENTS/boardui 配置、electron、路由表、入口链
- **未深挖**: `components/ui/`（96 文件）与 `components/reui/` 逐件 API；`locales/` 逐命名空间内容
- **下一步建议**: 需要时补扫 `components/workflow/display-node-views/`（自定义节点视图清单）
