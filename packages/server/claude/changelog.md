# Changelog

> 本文件只记录 Server 模块 AI 上下文的更新历史，最近 5 条倒序排列。

## 2026-11-27 — 死代码清理

- 删除 6 个 0 引用文件：`agents/agent-context.ts`（被 `persistent-agent-context.ts` 取代）、`services/command-process-manager.ts`、`services/command.ts`、`storage/command-store.ts`（三文件死链）、`services/database-vector.ts`、`storage/database-store.ts`（向量检索死链）。对应 `shared` 契约（command 域、DatabaseVector* 类型）同日删除。
- `AgentSpacesUI` → `FlowSpacesUI` 全链重命名：`agent-prompt.ts` 八处文案、`mini-apps.ts` 模板、`mini-app-tools.ts` 工具名（`list_agent_spaces_ui_components` → `list_flow_spaces_ui_components`）与描述；`window.AgentSpacesUI` 保留兼容别名供存量 mini-app。
- 审计报告：`docs/dead-code-audit/`；`pnpm typecheck` + `build:packages` 通过。
## 2026-11-27 — init-project 增量更新：商店拆仓

- **商店内容迁出**: `packages/templates` 的 plugins/workflows/mini-app 目录与 `pack-mini-apps.mjs` 迁至独立 GitHub 仓库（hunmer/flow-spaces-plugins / flow-spaces-workflows / flow-spaces-mini-apps）；本地 `/agents-store` 静态路由（app.ts `resolveRuntimeDir('../templates')`）只分发 templates 剩余 6 类内容，plugins/workflows/mini-app 请求改由 web 端 `apps/web/src/lib/agent-store.ts` `resolveStoreUrl` 前缀路由直达外部仓库 raw（gh-proxy 默认代理）。
- **mini-app 商店安装机制**: `services/mini-apps.ts` `installFromStore({id, baseUrl, files: StoreFileEntry[]})` 按远端 `app.json` 的文件级 md5 清单增量安装（fetchStoreBuffer/md5Of/md5OfFile）；`storage/mini-app-store.ts` `MANIFEST_SKIP_DIRS`（node_modules/.git/.cache/.turbo/.parcel-cache/vendor）防巨仓库清单爆炸，vendor 内容仅经 `/src/file/*` 按需加载（game-asset-canvas ~90k 文件教训）；支持从任意 GitHub 仓库 URL（含 owner/repo 简写）安装。
- **数据目录口径确认**: `storage/json-store.ts` `getDataDir()` = FLOW_SPACES_DATA_DIR || AGENT_SPACES_DATA_DIR（旧名回退）|| `~/.flow-spaces-data`；本仓 `packages/server/.env`：PORT=3110、FLOW_SPACES_DATA_DIR=./flow-spaces-data（cwd=packages/server），免鉴权模式。`flow-spaces-data/` 入库种子 25 文件，plugins/workflows/mini-apps 整目录不入库（`.gitignore` 顶部注释记录拆仓去向）。
- **周边确认**: `packages/logs/`（`__logDir`=src 上两级）为运行时生成不入库；`resolveRuntimeDir(name)`（app.ts:103）优先 src 同级回落上级，用于 templates/web/logs 三个运行时目录定位。
- 更新 `CLAUDE.md`（扫描状态 +2026-11-27 行）、`claude/public-interfaces.md`（/agents-store 行补注）。

## 2026-11-15 — init-project 复核

- 全量清点（git ls-files）：routes 25 文件 / 36 app.use 挂载、services 74、storage 19、adapters 14 + agents 4、ws 11、dev 19、test 38；数字与文档对齐，`CLAUDE.md` 扫描状态更新。
- 文件级功能映射纳入根 `docs/feature_map.json/html`（server.* 节点，`scripts/gen-feature-map.py` 生成，全仓 4072 文件 100% 覆盖）。

## 2026-11-10 — Team 多 Agent 协作功能移除

- **Team 子系统整体下线**: 删除 `services/team*.ts` 8 文件（team/team-manage/team-membership/team-message/team-inbox/team-runtime/team-internal/team-types）、`routes/team.ts`（`/api/teams` `/api/team-inbox` `/api/team-messages` 3 挂载点）、`builtin-tools/team-tools.ts`（team_manage 等 9 个内置工具）、`agents/agent-designer.ts` 的 generateTeamMemberSelection 与 `/presets/generate-team-members` 端点。
- **接入点清理**: `app.ts` 移除挂载与 `recoverTeamRuntimesOnStartup`；`ws/handler.ts` 移除 `@team:` 提及分发；`ws/agent-runner.ts` / `services/execution-agent-runner.ts` / `routes/chat-run.ts` 移除 team 工具装配；`services/channel.ts` 移除 `teamIds` 读写与 `loadTeam` 依赖；`routes/channel.ts` / `services/tool-detail.ts` 移除 `__team__` 虚拟 workspace 特例。
- **存量数据兼容**: `flow-spaces-data/team/` JSON 保留不删；旧 channel `teamIds` 字段读写安全忽略（不清洗不崩溃）；历史 team 消息（`metadata.teamId`）降级为普通消息渲染。新增回归 `test/legacy-channel-team.test.ts`；`test/tool-detail.test.ts` 改写为精确 messageId 匹配。
- **测试删除**: `test/{channel-team,team-custom-membership,team-membership,team-runtime-session-history,team-runtime-startup,team-task-orchestration}.test.ts`；`agents/agent-designer.test.ts` 移除 team 用例。
- **文档**: 删除 `claude/team-runtime.md`；更新 `CLAUDE.md`、`claude/module-responsibilities.md`、`claude/public-interfaces.md`。

## 2026-07-27 — Gemini CLI 运行时 + TS LSP WS 下线 + mini-app 迭代

- **Gemini CLI 运行时** (`adapters/gemini-cli-runtime.ts`，422 行): 新增 `GeminiCliRuntime`，spawn `gemini-cli` 子进程 + stdout JSON 事件解析、附件上下文、权限模式、resume 会话；`AgentRuntimeKind` 新增 `'gemini-cli'`；测试 `adapters/gemini-cli-runtime.test.ts`。新建 `claude/gemini-cli-runtime.md` 详情文件。
- **RUNTIME_DESCRIPTORS 扩张**: 从 9 个扩至 **20 个 id**（9 独立 runtimeKind + 11 别名复用：openclaw/omp/opencode/qwen/cursor/kimi/kiro/kilocode/antigravity/xiaomimimo/githubcopilot）。更新 `claude/ai-adapters.md`（descriptor 列表 + Gemini CLI 章节）。
- **TypeScript LSP WS 下线**: `/ws/lsp/typescript` 端点从 `app.ts` 移除，`ws/typescript-lsp.ts` 删除；upgrade dispatcher 五路 → 四路。更新 `CLAUDE.md`（历史条目，相关模块已移除）、`claude/public-interfaces.md`（WS 表移除 LSP 行）、`claude/module-responsibilities.md`（ws 表移除 typescript-lsp）。
- **mini-app 子系统迭代**: 新增 `ws/mini-app-channels.ts`（`miniApp.taskStop` 事件，前端凭 taskId 中断 mini-app agent）；`services/mini-app-services.ts` 新增 `startServicesWatcher`（app.ts 启动调用）；`services/builtin-tools/mini-app-tools.ts` 本期改动 6 次（全仓库最高）。更新 `claude/public-interfaces.md`（WS 表 +mini-app-channels）、`claude/module-responsibilities.md`（ws 表 +mini-app-channels/+html-utils）。
- **文档修正**: `claude/public-interfaces.md` 移除 2 个虚构路由（`routes/code-favorites.ts`、`routes/task.ts` 实际不存在）；`claude/module-responsibilities.md` 修正可视化办公模块 mapRoutes 描述（旧 web 包已删除）。
- 更新文件：`CLAUDE.md`（功能描述/约定/文件索引 +gemini-cli-runtime/扫描状态）+ `claude/ai-adapters.md` + `claude/public-interfaces.md` + `claude/module-responsibilities.md` + `claude/changelog.md`；新建 `claude/gemini-cli-runtime.md`
