# Flow Spaces

Workflow 可视化编辑器 + Mini-Apps 平台。自 flow-spaces（Next.js 16 monorepo）迁移而来，现为 pnpm workspace 独立项目（迁移笔记已不随仓分发）。

## 技术栈

Vite 7 + React 19 + TypeScript (strict) + Tailwind CSS v4；pnpm workspace：`apps/web`（@flow-spaces/web）+ `packages/{server,sdk,shared,templates}`（自 flow-spaces 原样复制）。

## 快速开始

```bash
cd flow_spaces
pnpm install
pnpm build          # 可选：shared→sdk→web 全量构建

pnpm dev:server     # 终端1：server http://0.0.0.0:3110（数据目录 ~/.flow-spaces-data）
pnpm dev            # 终端2：web   http://localhost:5173（/api /ws /public 代理到 3110）
```

主要路由：`/workflows`（列表/编辑器）、`/workflows/share`（分享执行页）、`/mini-apps`、`/mini-apps-preview`、`/login`。

## 更多

- AI 上下文索引（模块导航/约定/FAQ）：[CLAUDE.md](CLAUDE.md)
- 商店内容仓库（插件/工作流/Mini App 模板，2026-11 自 `packages/templates` 拆出）：
  - 插件模板：[hunmer/flow-spaces-plugins](https://github.com/hunmer/flow-spaces-plugins)
  - 工作流模板：[hunmer/flow-spaces-workflows](https://github.com/hunmer/flow-spaces-workflows)
  - Mini App 商店源：[hunmer/flow-spaces-mini-apps](https://github.com/hunmer/flow-spaces-mini-apps)
  - 独立 Mini App 示例：[hunmer/game-asset-canvas](https://github.com/hunmer/game-asset-canvas)
