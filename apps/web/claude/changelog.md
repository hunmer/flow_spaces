# apps/web 变更记录

> 本文件记录索引生成/更新，不是产品 Changelog。仅保留最近 5 条。

## 2026-11-27 — init-project 增量更新：商店拆仓

- 商店消费迁移至外部仓库：新增/确认 `src/lib/agent-store.ts`（`resolveStoreUrl` + `REPO_ROUTES` 前缀路由：plugins→flow-spaces-plugins、workflows→flow-spaces-workflows、mini-app→flow-spaces-mini-apps，均走 gh-proxy raw main 分支；`DEFAULT_BASE` 指向 flow_spaces master `packages/templates/`；镜像覆写 localStorage `flow-spaces:store-api-base`；`LEGACY_LOCAL_BASE_SUFFIX='/agents-store'` 旧同源 base 自动清除；`parseGithubRepoUrl` 支持 owner/repo 简写）。
- 商店消费点 6 处确认：`components/mini-apps/mini-apps-page.tsx`（mini-app/index.json + installFromStore + parseGithubRepoUrl）、`components/workflows/workflows-page.tsx`（workflows/index.json）、`components/workflow/workflow-plugins-dialog.tsx`（plugins/index(_locale).json）、`components/sidebar/agent-dialog-data.ts`（agents/index.json）、`components/sidebar/mcps-dialog.tsx`（mcps/index.json）、`components/sidebar/skills-dialog/use-skills-data.ts`（skills/index.json）。
- lib/ 43 → 30 文件（相对上次扫描口径；agent-store.ts 在列）。
- 更新 `CLAUDE.md`（扫描状态）、`claude/data-model.md`（mini-app 数据流改商店安装口径）、`claude/file-map.md`（lib/ 补 agent-store.ts）、`claude/module-responsibilities.md`（workflows 子域补商店模板说明）。

## 2026-11-15 — 初始化 web 模块上下文

- 首次生成 `apps/web/CLAUDE.md` + `claude/*.md`（11 个详情文件）。
- 扫描范围：package.json、vite.config.ts、tsconfig*、AGENTS.md（BoardUI 规则）、src/ 全子树清点（components 22 子域 522 文件、stores 25、lib 43、locales 73、hooks 9、shims 5、app 9）、electron/、public/ 结构、router.tsx 路由表、main.tsx Provider 树。
- 关键结论：SPA 自 flow-spaces(Next.js) 迁移；next/* 走 shims alias；vendor 拆 chunk 含 mermaid 闭包防 TDZ；BoardUI 源码级组件库随仓库持有。
- 文件级映射并入根 `docs/feature_map.json/html`（web.* 17 个功能节点）。
