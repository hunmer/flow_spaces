# Changelog

> 本文件只记录 Shared 模块 AI 上下文的更新历史，最近 5 条倒序排列。

## 2026-11-27 — 死代码清理

- 删除 `src/types/command.ts`（QuickCommand/CommandProcess/CommandProcessEvent 全仓 0 引用），`src/index.ts` 桶导出移除对应行。
- git 面板废弃轮：删除 `src/types/git.ts`（GitFileStatus/GitStatusResult/GitLogEntry，git 变更面板 UI 已废弃）与 `src/types/worktree.ts`（Worktree 域 0 引用）；`events.ts` 删 `worktree.*` 4 事件段；类型域 27 → 25。
- `events.ts` 删除 `command.*` 事件类型段；`database.ts` 删除 DatabaseVectorStats/IndexResult/SearchResult（向量检索死链下游）。
- dist 已通过 `pnpm build:packages` 重建刷新。
## 2026-11-15 — 复核类型清单并刷新索引

- 复核 `src/types/`：现状 27 个域文件（team.ts 已移除，TeammateIdle hook 协议保留于 hooks 域）。
- 重写 `claude/overview.md`（补构建形态与边界）、`claude/conventions.md`、`claude/module-responsibilities.md`；其余详情文件沿用 2026-07-10 版本。
- `CLAUDE.md` 索引补全 11 个详情文件链接；纳入根 docs/feature_map.json（shared.types 节点）。

## 2026-07-10 — 新增 team.ts 类型

- 新增 `src/types/team.ts`：Team 协作域完整类型定义
  - 实体：Team / TeamMembership / TeamMessage / TeamInboxItem / TeamRuntime / TeamComment
  - 枚举：TeamStatus(active/archived/dissolved) / TeamVisibility / TeamRole(owner/admin/member/observer) / TeamMembershipStatus / TeamMessageType(direct/broadcast) / TeamPriority / TeamInboxStatus / TeamExecutionStatus / TeamRuntimeStatus / TeamCommentVisibility
- 类型文件总数 27 → 30
- 更新 `CLAUDE.md`（约定补 team.ts/扫描状态）、`claude/overview.md`（清单补 team.ts）

## 2026-07-06 — 类型清单盘点

- `src/types/` 共 27 个类型文件，Workflow 域已细分为 8 个文件（workflow / workflow-execution / workflow-composite / workflow-plugin / workflow-shortcut / workflow-ws / workflow-node-factory / workflow-errors）
- 关键域类型：agent / channel / issue / llm / notification / knowledge-base / hooks / worktree / subscription / speech / tool
- 上次迭代新增：`AgentUsageSessionMessage` / `AgentUsageSessionDetail`、`WorkflowExecuteRequest.source`
- 更新 `CLAUDE.md`（约定/扫描状态）

## 2026-06-27 — 初始化 Shared 模块上下文

- 首次生成 `CLAUDE.md` + `claude/*.md`（3 个详情文件）
- 扫描范围：package.json、src/index.ts、src/types/ 列表
