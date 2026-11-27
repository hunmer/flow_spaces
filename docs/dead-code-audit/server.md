# packages/server/src 死代码审计报告

- 审计时间：2026-11-27
- 审计范围：`packages/server/src` 全部 164 个文件（160 个 `*.ts` + 4 个被 glob 模式排除的文件，见 C 节）
- 方法：入口链分析（`packages/server/src/app.ts`，bin 入口即 `dist/app.js` ← `src/app.ts`，无 index.ts）→ 全量 import 引用图（rg 抓取 429 条 import 行）→ 逐候选文件名/导出符号全仓反查（含 apps/web、packages/sdk、packages/server/test、package.json scripts、动态 `import()`/`require()`）

## A. 高置信可删

全仓搜索（`**/*.{ts,tsx,js,json,mjs}`，4105 文件）对以下文件名与关键导出符号均 0 命中（仅 `docs/feature_map.json` 索引残留与 `packages/server/claude/*.md` 文档提及，不构成代码消费）。

| # | 文件路径 | 搜索关键字 | 0 命中证据 | 功能域猜测 |
|---|---|---|---|---|
| A1 | `packages/server/src/agents/agent-context.ts` | `agent-context`、`AgentContext` | 全仓 0 代码引用；自身仅 13 行，定义 `AgentContext` 接口，无消费者 | 迁移残留：旧 agent 会话上下文共享接口，功能已由 `services/persistent-agent-context.ts` 取代 |
| A2 | `packages/server/src/services/command-process-manager.ts` | `command-process-manager`、`runCommand` | 全仓 0 引用；192 行，pty 命令进程管理（runCommand/restart 等） | 迁移残留：命令面板进程管理器，入口已摘除 |
| A3 | `packages/server/src/services/command.ts` | `services/command.js`、`commandService` | 唯一引用方是 A2（`command-process-manager.ts:6`）；无路由/其他 service 引用 | 连带死链：命令 CRUD service（listCommands/createCommand 等） |
| A4 | `packages/server/src/storage/command-store.ts` | `command-store` | 唯一引用方是 A3（`services/command.ts:3`） | 连带死链：命令 JSON 持久层 |
| A5 | `packages/server/src/services/database-vector.ts` | `database-vector`、`indexDatabaseVectors`、`DatabaseVectorError` | 全仓 0 引用（自身 console 日志除外）；122 行向量索引/检索 | 迁移残留：数据库文档向量嵌入检索（Notion 风格 database 功能已弃） |
| A6 | `packages/server/src/storage/database-store.ts` | `database-store`、`databaseStore` | 唯一引用方是 A5（`services/database-vector.ts:2`） | 连带死链：数据库集合/文档 JSON 持久层 |

> 删除建议顺序：A1 直接删；A2→A3→A4、A5→A6 按链整组删。连带可再评估 `@flow-spaces/shared` 中仅被上述文件使用的类型（`CommandProcess`、`DatabaseVectorIndexResult`、`DatabaseVectorSearchResult` 等，属 shared 包范围，未计入本表）。

## B. 疑似（命名残留 / 字符串引用 / 死分支）

| # | 位置 | 现象 | 说明 |
|---|---|---|---|
| B1 | `packages/server/src/services/builtin-tools/mini-app-tools.ts:862` | 工具名 `list_agent_spaces_ui_components` | 旧项目 agent_spaces 命名残留（功能活跃，仅改名建议） |
| B2 | `packages/server/src/ws/agent-prompt.ts:248,258` | 提示词中 `AgentSpacesUI`、`list_agent_spaces_ui_components` | 同上，命名残留 |
| B3 | `docs/feature_map.json`（多处） | 仍索引 A1–A6 六个死文件 | 文档索引未随代码更新，删除后需重建 |
| B4 | glob 扫描 skip 4 个文件（`skipReasons={"pattern":4}`） | 未能纳入本轮内容扫描 | 均为 `*.test.ts`/d.ts 类路径模式排除文件，非源码消费方，风险低 |

## C. 排除的误报与统计

| 项 | 结果 |
|---|---|
| 扫描文件数 | 164（src 下 160 个 `*.ts`；4 个模式排除文件见 B4） |
| 路由挂载核对 | `routes/` 全部 27 个路由文件均在 `app.ts` 挂载（`/mcp`、`/api/agent-sse`、`/api/auth`、`/api/account`、`/api/workspaces(/:id/...)`、`/api/workflows`×2、`/api/mini-apps`、`/api/sqlite`、`/api/plugins`、`/api/agents`、`/api`、`/api/model-catalog`、`/api/folder`、`/api/skills`、`/api/mcps`、`/api/agent-commands`、`/api/external-import`、`/api/chat`×2、`createWorkflowHookRouter`）→ **未挂载路由：0** |
| 孤儿 service / storage | A 档 6 个文件（2 个独立孤儿 + 4 个连带死链） |
| B 档数量 | 4 条（3 条命名/索引残留 + 1 条扫描盲区备注） |
| 排除：测试文件 | `src/**/*.test.ts`、`packages/server/test/`（含 `persistent-agent-context.test.ts`） |
| 排除：脚本独立运行 | `src/dev/plugin-test-runner.ts`（`package.json` script `dev:plugin: tsx src/dev/plugin-test-runner.ts`）及其依赖 `src/dev/plugin-test-harness.ts`、`src/dev/plugin-tests/*.ts` |
| 排除：运行时数据 | `flow-spaces-data/`、`public/`、`packages/server/logs/` |
| 排除：类型消费 | `import type` 引用（如 `execution-types.ts`、`agent-runtime-types.ts` 被大量 type-only import）均计为消费 |
| 排除：动态引用 | 已核查全部 `import()`/`require()`（18 处），指向的都是活文件（`workflow.js`、`agent.js`、`mini-app-agent.js`、`agent-runtime.js` 等）；`plugin-test-harness.ts:44` 的 `require(filePath)` 属测试加载器 |
| 消费确认（抽样） | `procm-logger.ts`←app.ts；`middleware/auth.ts`←app.ts/agent-sse；`adapters/git.ts`←routes/workspace.ts；`storage/usage.ts`←services/agent.ts；`services/agent-capability-catalog.ts`←workflow-exec-tools/tools-read；`ws/html-utils.ts`←agent-prompt/handler |

### 附：入口与挂载链摘要

- 入口：`packages/server/package.json` → `bin: dist/app.js` / `dev: tsx watch src/app.ts`，唯一运行入口 `src/app.ts`（无 src/index.ts）。
- WS 链：`app.ts` → `ws/handler.ts`（handleConnection）→ chat-handler / agent-runner / terminal-handler / execution-channels / mini-app-channels 全部注册。
