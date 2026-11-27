## 2026-11-27 — 文件图标集精简 + 功能图谱重建

- `apps/web/public/icons/` 870→20（vscode 文件图标集全量精简为 20 种基础类型图标，`file-icon.tsx` 映射同步）。
- feature_map 重建：33 功能节点 / 1626 文件 / 100% 覆盖（ghost 0 / vendored 0 / unmapped 0）；tracked 2730→1628。

## 2026-11-27 — A 套 workspace 瘦身 + SDK 裁剪（0 消费全砍）

- **A 套 workspace 瘦身**（agent-spaces 遗留概念）：`routes/workspace.ts` 169→10 行（仅 GET list，POST /clone 随消费方消亡连带删 `adapters/git.ts`+simple-git）；`workspace-store` 删 3 孤儿函数；`types/workspace.ts` Workspace 删 8 死字段+5 死类型；web 删 chat-input-info-bar miniAppTools 段、editor-panel workspace 绑定；sdk workspace 模块 73→20 行
- **chat workspaces 数据清理**：flow-spaces-data/workspaces/ 删 A/B 套存量目录（注册表清空、game-asset-canvas/tts 删），tracked 25→19；B 套自愈链验证通过（浏览器绑定自动重建）
- **SDK 裁剪**（用户裁定"本仓未消费全部砍"）：删 7 个 0 消费模块（account/agent-store/avatar/font/inspector/notification/tools）+46 个 0 消费方法（24→17 模块）；demo 删 7 死页（issue/task/agent-store/agent-cfg/content/settings/version，多为调不存在 API 的幻觉页）+editor 页裁 worktree 区块+home 探活改 /api/health
- 验证：sdk/server/web tsc 全绿、build:packages 重建、dist 死模块产物清理；A 套冒烟（独立 3199 端口）六死端点 404
- 文档同步：sdk/server/根 CLAUDE.md+claude 全套（route-index 全重写 25 路由、sdk 覆盖矩阵 17 模块、changelog 三处）

# 根目录变更记录

> 仅保留最近 5 条。

## 遗留事项（自 docs/init-project-report-2026-11-27.md §七 搬入，报告本体已删）

1. 模块级 CodeGraph 索引（`codegraph init`）可补代码级符号导航。
2. README.md 历史性叙述（Next.js 迁移背景）如需对外版可再整理。
3. `packages/server/.env` 当前入库且免鉴权——仅限本地开发环境，勿写入生产密钥。

## 2026-11-27 — 死代码清理执行（A 档全量 + B 档裁决）

- 删除 A 档 12 文件（审计报告 `docs/dead-code-audit/`，Lead 复验 0 引用）：server 6（`agents/agent-context.ts`、`command-process-manager.ts`→`command.ts`→`command-store.ts` 死链、`database-vector.ts`→`database-store.ts` 死链）；web 5（`shims/next/dynamic.tsx`、`shims/styled-jsx.d.ts`、`app/api/chat/route.ts` 371 行 Next.js 残留、`components/home/workflows-table.tsx`、`components/base/command-palette/`）；`scripts/copy-report.txt`。
- 下游孤儿清理：`shared/types/command.ts` 删除（shared 27→26 域）、`events.ts` 删 `command.*` 事件段、`database.ts` 删 `DatabaseVectorStats/IndexResult/SearchResult` 向量类型。
- **AgentSpacesUI → FlowSpacesUI 全链重命名**：window 主名 FlowSpacesUI，`window.AgentSpacesUI` 保留兼容别名（存量 mini-app 兜底），`new Function` 形参双注入；server 工具名 `list_agent_spaces_ui_components`→`list_flow_spaces_ui_components`（`agent-prompt.ts`/`mini-app-tools.ts`/`mini-apps.ts` 文案与模板同步）。
- locales 清理：en/zh 各删 6 个 0 消费 namespace（issue/flexLayout/database/agentCommands/skillsPackages/outputStyles），en/zh 各剩 29 json。
- 附带修复：`ui/morphing-spinner.tsx` 的 `<style jsx>` styled-jsx 残留语法改 `<style>`（typecheck 揪出）；docs/workflow 插件路径改指 flow-spaces-plugins 仓库。
- 裁决保留：workflow-ws 契约段、5 个未接线脚本、sdk demo 页、sdk 7 模块/shared 4 域（发布包对外 API）。
- 验证与图谱：`pnpm typecheck` ✓、`build:packages` ✓；feature_map 重建 33 节点 / 2728 文件 / 100% / ghost 0；tracked 2750 → 2730。

## 2026-11-27 — git 面板废弃 + workspace 角色厘清

- git 变更面板（VSCode 式 Source Control UI 已不存在）死代码清理：删除 `apps/web/src/components/git/commit-diff-viewer.tsx`、`stores/editor.ts` 的 commitDiff 通路（COMMIT_DIFF_PREFIX/isCommitDiffPath/openCommitDiff/closeCommitDiff）、`common-code-editor.tsx` 的 isCommitDiff 渲染分支、locales en/zh `git.json`；shared 删除 `types/git.ts` 与 `types/worktree.ts`（Worktree 域全仓 0 引用）、`events.ts` 删 `worktree.*` 事件段；sdk 删 `demo/git.html`/`demo/js/git.js` 与 index.ts 注释幻觉 API。git 面板删除后 shared 26 → 25 域、web locales 各 28 json。
- git 活链保留：workspace clone 导入（`adapters/git.ts` gitClone）、DiffViewer 组件复用（agent 工具步骤 diff / Prompt 优化对比）、商店模板（mcps/git.json、skills/using-git-worktrees）。
- workspace 两套同名物厘清（回答「workspaces 还是旧 agent-spaces 概念吗」）：A 套 = agent-spaces 遗留 Workspace（routes/workspace.ts 8 端点，现役功能仅 3——workflow WS 执行通道（use-resolved-workspace-id）、聊天内文件编辑器（editor-panel）、git clone 导入；注册表仅 1 条且 boundDirs 指向已失效旧 Mac 路径）；B 套 = ChatWorkspace（/api/chat/workspaces，浏览器绑定自动创建，session/channel 挂其下，是 AI 聊天运行必需）。同名不同物是混淆根源。
- 附注：用户同步进行 icons 精简（public/icons 870 → 20 种，file-icon.tsx 映射表同步）；图谱待该轮入库后统一重跑 gen-feature-map 刷新（当前 docs/feature_map.* 为 2748 口径）。

## 2026-11-27 — init-project 增量更新：商店拆仓

- 全仓清点（git ls-files 4072 → **2750**）：内置 plugins/workflows/mini-apps 迁出至独立 GitHub 商店仓库（hunmer/flow-spaces-plugins、flow-spaces-workflows、flow-spaces-mini-apps、game-asset-canvas），`packages/templates` 缩容为 agents/mcps/skills/output-styles/prompt/skillspackage（393 → 316 文件），`pack-mini-apps.mjs` 移除。
- 编辑器 Monaco → CodeMirror 6 迁移（同日 16:32 提交 6825f83/8ca398b）：`components/editor/code-editor.tsx` 改为 CodeMirror 6（@uiw/react-codemirror + @codemirror/* 24 包，兼容旧 Monaco props），monaco-loader/models/actions 等与 `public/monaco-themes/` 全部移除，apps/web 2011 → 1827 文件。
- 新机制入档：`apps/web/src/lib/agent-store.ts` `REPO_ROUTES`/`resolveStoreUrl` 商店路由（gh-proxy raw + localStorage 镜像 + 旧 `/agents-store` base 自动清除）；mini-app 安装改为 `app.json` 文件级 md5 清单增量安装（server `services/mini-apps.ts` `installFromStore`，支持 GitHub URL）。
- 数据目录口径修正：`getDataDir()`（FLOW_SPACES_DATA_DIR → `~/.flow-spaces-data`，本仓 `.env` 指向 `packages/server/flow-spaces-data/`）；plugins/workflows/mini-apps 整目录不入库（`.gitignore` 顶部注明去向），入库种子缩至 25 文件。
- 失效引用清理：MIGRATION-NOTES.md、docs/smoke/ 等失效链接清理（README、docs/workflow、plugin-guide 参考路径改指 flow-spaces-plugins 仓库）；`packages/logs/` 改为运行时生成；CodeGraph 索引未建。
- 重新生成功能依赖图谱 `docs/feature_map.json/html`：33 功能节点（6 大类）/ 2748 文件（files 2679 + tests 69）/ 覆盖率 100% / vendored 0 / unmapped 0 / ghost 0（Monaco 迁移后重建，已入库；`gen-feature-map.py` 规则同步更新为 CodeMirror 口径）。
- 同步更新：根 CLAUDE.md + claude/ 11 文件、packages/templates 全套、server/web 模块定点（扫描状态与商店相关行）。

## 2026-11-15 — init-project：AI 上下文全套重建

- 生成 `docs/feature_map.json/html`（38 功能节点、4072 文件、覆盖率 100%），脚本 `scripts/gen-feature-map.py` 入库。
- 根 + 5 模块 CLAUDE.md 索引与 claude/ 详情全套生成/更新（apps/web、packages/server、sdk、shared、templates）。
- 修正过时描述：sdk 模块数 38→24；shared 类型域 30→27（team.ts 已移除）；templates 坏链修复。
