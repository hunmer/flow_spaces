# Changelog

> 本文件只记录 Server 模块 AI 上下文的更新历史，最近 5 条倒序排列。

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

## 2026-07-18 — 深挖已移除的可视化办公模块 + Grok 协议（新增 2 个详情文件）

- 精读已移除的可视化办公房间实现（房间生命周期 + 5 类 message handler + Dispatcher 命令模式）、状态 schema（Player/Agent/ChatMessage）、广播桥接层（Agent 广播 → 房间状态的核心枢纽：dispatch 路由 7 种广播类型 + 椅子占用机制 + 业务 roomId↔内部 roomId 映射）
- 精读 `adapters/grok-runtime.ts`（345 行）：spawn 子进程 + streaming-json 按行解析、text/thought/end/error 事件 schema、缓冲 flush 策略、自定义模型 config.toml 生成、normalizeGrokEndpoint 按 provider 归一化 backend、env_key 区分（XAI_API_KEY 原生 / FLOW_SPACES_GROK_API_KEY 自定义）
- 新建可视化办公模块详情文件（本期已删除）：双源实体模型（Player=sessionId vs Agent=业务agentId）、dispatch 路由表、椅子占用算法、Agent 广播协议 JSON 示例、相对原版的裁剪清单、前端集成指引
- 新建 `claude/grok-runtime.md`：CLI 参数表、JSON 事件 schema、usage/cost 归一化、结果判定逻辑、config.toml 模板、backend 归一化表、环境变量、日志规范
- 更新 `CLAUDE.md` 文件索引：+grok-runtime.md +办公模块详情文件两行

## 2026-07-18 — 可视化办公模块合并 + Grok 运行时

- **可视化办公模块**（本期已整体移除）：原房间服务合并进主后端单进程，现已连同挂载点、路由与升级分发分支一并删除。
- **可视化办公 API**（本期已全部移除）：房间 CRUD、地图数据、monitor；Agent WS 与 Viewer 连接均已移除；原环境开关同步移除
- **Grok 运行时**（`adapters/grok-runtime.ts`）：`AgentRuntimeKind` 新增 `'grok'`，spawn 子进程 + JSON 事件流，支持 baseURL/resume/maxTurns/tools/permission/thinking；已在 `RUNTIME_DESCRIPTORS` 登记（descriptor 8 → 9）；测试 `src/adapters/grok-runtime.test.ts`
- 更新文件：`CLAUDE.md`（功能描述 + 约定 + 扫描状态）、`claude/ai-adapters.md`（+Grok 章节 + Runtime 管理 descriptor 8→9）、`claude/module-responsibilities.md`（adapters 表 +Grok、+可视化办公子目录）、`claude/public-interfaces.md`（+可视化办公 REST/WS）、`claude/changelog.md`

## 2026-07-13 — 深挖 team-runtime.ts + 增量核对

- 新增 `claude/team-runtime.md`：team-runtime.ts（1379 行）全量精读，覆盖成员调度（preset/chat/custom 三分流）、消息路由（postTeamRuntimeMessage → dispatchTeamReply）、handoff 机制、任务管理（owner/非 owner 责任 + 工具入口）、工具装配、事件广播、会话生命周期、文件级持久化模型
- 修正 Team 服务文件数：9 → 8
- `services/builtin-tools/` 补全：12 文件（含 `agent-tools.ts`，含 workflow-editor/ 子目录）
- services 总数 99 → 100；路由数确认 42
- 更新 `CLAUDE.md`（新增 team-runtime 索引行/约定 Team 文件数/扫描状态补 team-runtime 全文）

## 2026-07-13 — 增量核对（Team 文件数修正 + builtin-tools 补全）

- 修正 Team 服务文件数：9 → 8（team/team-manage/team-membership/team-message/team-inbox/team-runtime/team-internal/team-types）
- `services/builtin-tools/` 补全：12 文件（新增 `agent-tools.ts`，含 workflow-editor/ 子目录）
- services 总数 99 → 100；路由数确认 42
- 更新 `CLAUDE.md`（约定 Team 文件数/扫描状态）、`claude/module-responsibilities.md`（路由数/服务数/builtin-tools 列表/team 文件数）

## 2026-07-10 — Team 多 Agent 协作系统

- 新增 Team 协作子系统：`services/team*.ts`（8 文件：team/team-manage/team-membership/team-message/team-inbox/team-runtime/team-internal/team-types）
- `routes/team.ts` 挂载 3 个 API：`/api/teams`（团队 CRUD/成员/邀请/角色/解散）、`/api/team-inbox`（收件箱查询/删除/状态）、`/api/team-messages`（消息发送/更新/删除/评论/运行时回送）
- `services/builtin-tools/team-tools.ts`：Agent 可调用的团队协作工具集
- `services/chat-run.ts` + `routes/chat-run.ts`：聊天运行模块
- 路由总数 40+ → 42；services 总数 90+ → 99
- 更新 `CLAUDE.md`（功能描述/约定补 Team/扫描状态）、`claude/public-interfaces.md`（team/chat-run 路由）、`claude/module-responsibilities.md`（Team 子域 + chat-run）

