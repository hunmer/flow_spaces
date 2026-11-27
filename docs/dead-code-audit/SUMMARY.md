# 死代码审计总览（2026-11-27）

4 × GLM-5.3-Flash 并行审计（dead-code-audit 团队），Lead 对全部 A 档条目逐一复验。分报告：[web-components.md](web-components.md) / [web-lib.md](web-lib.md) / [server.md](server.md) / [packages.md](packages.md)。

> **执行结果（2026-11-27 17:15，用户指令 "执行A, B的话把 AgentSpacesUI 重命名成 FlowSpacesUI"）**：
> - **A 档 12 项已全部删除**（含 `app/api/` 与 `base/command-palette/` 整目录、`scripts/copy-report.txt`），下游孤儿（`shared/types/command.ts`、`events.ts` command 段、`database.ts` DatabaseVector* 三接口）一并清理。
> - **B 档已裁决执行**：locales 6 namespace×2 删除（barrel 同步清理）；AgentSpacesUI→**FlowSpacesUI** 全链重命名（13 文件，`window.AgentSpacesUI` 保留兼容别名 + `new Function` 形参双注入，存量 mini-app 不受影响）；docs/workflow 过期路径改指 flow-spaces-plugins 仓库。workflow-ws 契约段、5 个脚本、sdk demo、sdk 7 模块/shared 4 域**保留**（发布包对外 API）。
> - **验证**：`pnpm typecheck` ✓、`build:packages` ✓；feature_map 重建 33 节点 / 2728 文件 / 100% 覆盖 / ghost 0；tracked 2750 → 2730。
> - **附带修复**：`ui/morphing-spinner.tsx` `<style jsx>` → `<style>`（styled-jsx shim 删除后 typecheck 报错）。

## A 高置信可删（12 项，Lead 已逐一复验 0 引用）

| # | 文件 | 证据摘要 |
|---|---|---|
| 1 | `packages/server/src/agents/agent-context.ts` | 旧 AgentContext，已被 persistent-agent-context.ts 取代 |
| 2-4 | `packages/server/src/services/command-process-manager.ts` → `services/command.ts` → `storage/command-store.ts` | 三文件死链：进程管理器为迁移残留，后两者仅被死链内部引用 |
| 5-6 | `packages/server/src/services/database-vector.ts` → `storage/database-store.ts` | 数据库向量检索弃用死链 |
| 7 | `apps/web/src/shims/next/dynamic.tsx` | `next/dynamic` 全仓 0 消费 |
| 8 | `apps/web/src/shims/styled-jsx.d.ts` | `styled-jsx` 全仓 0 消费 |
| 9 | `apps/web/src/app/api/chat/route.ts` | 371 行 Next.js route handler 残留；Vite 不编译、无 import/字符串/安装链引用；`/api/chat` 契约已由 Express `routes/chat.ts`+`chat-run.ts` 实现 |
| 10 | `apps/web/src/components/home/workflows-table.tsx` | 旧 Home 表格，已被 MetricsDashboard 取代 |
| 11 | `apps/web/src/components/base/command-palette/command-palette.tsx` | ⚠ 与 `components/command-palette/`（活码，main.tsx:29）同名，勿删错；base 版仅 docs href 字符串引用 |
| 12 | `scripts/copy-report.txt` | 迁移期 closure 复制的生成产物 |

## B 疑似（需人工裁决，不可直接删）

- **locales 6 namespace × en/zh**（issue、flexLayout、database、agentCommands、skillsPackages、outputStyles）：266 处 `useTranslations()` 0 命中，防动态 namespace 调用列疑似。
- **web `ui/{badge,tabs,tooltip,skeleton,calendar,navigation-menu,avatar-group,number-input}`**：仅经 `lib/ui-exports.ts` barrel，被 mini-app 运行时 `AgentSpacesUI` 动态访问。
- **server 旧命名残留**：`mini-app-tools.ts:862`、`agent-prompt.ts:248,258` 的 `list_agent_spaces_ui_components`/`AgentSpacesUI`。
- **`docs/feature_map.json` 死索引**：仍收录将删的 6 个 server 死文件（删除后重建图谱即可清理）。
- **packages**：workflow-ws 失效契约段（Interaction* 仍活）；5 个脚本未接 package.json 仅文档引用；docs/workflow 引用已拆仓的 `packages/templates/plugins/*`；`skills/references` 悬空目录；sdk/demo 19 页仅自引用。
- **`components/command-palette/command-palette.tsx`**：初筛孤儿，终查 main.tsx:29 存活（同名目录反转，已排除）。

## 发布包豁免（仅标记"本仓未消费"，不判死）

- sdk 7 模块：notification / tools / account / agentStore / font / inspector / avatar（npm 发布包，外部可能消费）。
- shared 4 类型域：speech / subscription / worktree / workflow-shortcut。

## 删除后收尾建议

1. 删 A 档 12 项后顺带清理 `packages/shared/src/types/command.ts`（CommandProcess 等）与 `events.ts` 的 `command.*` 事件段、`database.ts` 的 DatabaseVectorIndexResult——将成为新孤儿。
2. 跑 `python scripts/gen-feature-map.py` 重建图谱（清死索引）。
3. `pnpm typecheck` + `pnpm build:packages` + dev 冒烟。

## 统计

扫描范围：apps/web/src、packages/server/src、sdk、shared、templates、scripts、docs；共 4 报告 / A 12 项 / B 约 30 项 / 豁免 11 项；27 个 server 路由全部挂载无遗漏；templates 索引 232 条双向核对健康。
