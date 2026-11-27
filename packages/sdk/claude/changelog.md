## 2026-11-27 — 死代码清理：24 → 17 模块（0 消费全砍）

- 删 7 个 0 消费模块：account / agent-store / avatar / font / inspector / notification / tools（用户裁定 sdk 仅服务本仓，未消费不保留；server 端 account/notification 路由因 web 直调 fetch 仍活）
- 删 46 个 0 消费方法（agent 6 / agent-commands 6 / auth 3 / channel 2 / chat 5 / editor 2 / knowledge-base 4 / llm 5 / mini-apps 7 / workflow 5 / workspace 1）；workspace.cloneSse 死→server POST /api/workspaces/clone + adapters/git.ts + simple-git 依赖连带删除
- demo 清理：删 issue/task/agent-store/agent-cfg/content/settings/version 7 个死页（调不存在的 sdk.issue/task/version 或已删模块），editor 页裁 worktree 区块，home.js 探活改 /api/health；README 树与覆盖矩阵同步（17 模块）
- tsc / build:packages / dist 重建全过；修复脚本教训：python 删方法块以"下一个 4 空格方法声明或空行"为界，多行方法体需防孤立 `},` 残留

# Changelog

> 本文件只记录 SDK 模块 AI 上下文的更新历史，最近 5 条倒序排列。

## 2026-11-15 — 全量核对：模块数 39 → 24

- `src/modules/` 实际 24 个文件（此前文档记 38/39 均过时）；issue/task/git/kanban/database/worktree/hooks/command/subscription/speech/code-favorites/prompts/npm-settings/output-styles/robot-accounts/data/version/team 等旧模块已随产品收敛移除
- 新增模块入册：account、external-import、knowledge-base、sqlite、mini-apps
- 重写 `claude/module-responsibilities.md`（24 模块职责）、`claude/overview.md`（模块列表）；修 `file-map.md`（35+→24）、`entrypoints.md`（39→24）、`CLAUDE.md`
- 纳入根 `docs/feature_map.*`（packages.sdk 节点）

## 2026-07-13 — 模块数核对修正

- 核对 `src/modules/` 实际文件数与 `index.ts` 注册数：均为 39（此前文档误记为 40）
- 修正 `claude/overview.md` 模块列表：移除不存在的 `task`/`modelCatalog`，补全 `externalImport`/`workflowSettings`，列全 39 个
- 更新 `CLAUDE.md`（模块数 40→39、扫描状态）

## 2026-07-10 — 新增 team 模块

- 新增 `src/modules/team.ts`，导出 `createTeamApi`，在 `src/index.ts` 注册为 `sdk.team`
- team 模块覆盖：团队 CRUD / 成员管理（邀请/角色/移除）/ 消息（发送/更新/删除/评论）/ 收件箱（查询/状态/删除）/ 运行时（查询/回送消息）
- 模块总数 39 → 40
- 更新 `CLAUDE.md`（模块数/覆盖域补 team/扫描状态）、`claude/overview.md`（模块列表补 team）

## 2026-07-06 — 模块清单盘点

- `src/modules/` 共 39 个 API 模块（200+ 方法）
- 近期增强：`issue`（11 方法：CRUD + start/resume/continue/interrupt + 评论）、`agent`（11 方法，含 `sessionDetail`）、`chat`（17 方法）、`workflow`（18 方法）
- 新增域：external-import / model-catalog / robot-accounts / agent-commands / agent-store 等
- 更新 `CLAUDE.md`（模块数 35+→39、约定补全模块覆盖域）

## 2026-06-27 — 初始化 SDK 模块上下文

- 首次生成 `CLAUDE.md` + `claude/*.md`（4 个详情文件）
- 扫描范围：package.json、src/index.ts、src/modules/ 列表
