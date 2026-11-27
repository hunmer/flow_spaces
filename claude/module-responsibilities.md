# 模块职责

| 模块 | 包名 | 职责 | 规模（tracked 文件） | 索引 |
|---|---|---|---|---|
| `apps/web` | `@flow-spaces/web` | React 19 SPA：工作流编辑器、Mini App 平台、聊天、BoardUI 组件库、商店消费端 | 2011 | [CLAUDE.md](../apps/web/CLAUDE.md) |
| `packages/server` | `@flow-spaces/server` | Express 5 后端：REST+WS、SQLite、AI 运行时适配、workflow 引擎、商店清单安装、运行时数据目录 | 440（src 164 + flow-spaces-data 25 + public/test/文档） | [CLAUDE.md](../packages/server/CLAUDE.md) |
| `packages/sdk` | `@flow-spaces/sdk` | 前端统一 API SDK：24 模块封装全部后端 HTTP + `demo/` 41 个静态演示页 | 83（src 27 + demo 41） | [CLAUDE.md](../packages/sdk/CLAUDE.md) |
| `packages/shared` | `@flow-spaces/shared` | 前后端共享 TS 类型（27 域，纯类型） | 44 | [CLAUDE.md](../packages/shared/CLAUDE.md) |
| `packages/templates` | `@flow-spaces/agents` | Agent Store 内容源：agents（14 类）/mcps/skills/output-styles/prompt/skillspackage 索引与内容 | 316 | [CLAUDE.md](../packages/templates/CLAUDE.md) |
| `packages/logs/` | — | server 运行日志（`app.ts` `__logDir` 指向，运行时生成，不入库） | 0 | 无索引 |

**已迁出**（2026-11 商店拆仓）：插件模板 → hunmer/flow-spaces-plugins；工作流模板 → hunmer/flow-spaces-workflows；Mini App 商店源 → hunmer/flow-spaces-mini-apps（示例产品仓库 hunmer/game-asset-canvas）。原 `packages/templates/{plugins,mini-app,workflows}/` 与 `pack-mini-apps.mjs` 均已删除。

## 根级支撑

- `scripts/`：i18n 审计与校验、closure 复制/验证、`gen-feature-map.py`（功能图谱生成，产物已不随仓分发）。
- `docs/`：workflow 开发指南（9 篇，`plugin-guide.md` 等）、agent-tools MCP 说明、boardui-migration/ 迁移截图。
- `procm-commands.json`：procm 进程管理入口。

## 商店消费端（web，`lib/agent-store.ts` 统一入口）

| 消费点 | 索引 | 安装 |
|---|---|---|
| `components/mini-apps/mini-apps-page.tsx` | `mini-app/index.json` | `sdk.miniApp.installFromStore`（商店清单或 GitHub 仓库 URL） |
| `components/workflows/workflows-page.tsx` | `workflows/index.json` | 模板下载（`resolveStoreUrl`） |
| `components/workflow/workflow-plugins-dialog.tsx` | `plugins/index(_locale).json` | `sdk.workflowPlugin.installFromStore`（运行时插件目录） |
| `components/sidebar/agent-dialog-data.ts` | `agents/index.json` | — |
| `components/sidebar/mcps-dialog.tsx` | `mcps/index.json` | — |
| `components/sidebar/skills-dialog/use-skills-data.ts` | `skills/index.json` | — |
