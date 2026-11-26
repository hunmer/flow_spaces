# apps/web 变更记录

> 本文件记录索引生成/更新，不是产品 Changelog。仅保留最近 5 条。

## 2026-11-15 — 初始化 web 模块上下文

- 首次生成 `apps/web/CLAUDE.md` + `claude/*.md`（11 个详情文件）。
- 扫描范围：package.json、vite.config.ts、tsconfig*、AGENTS.md（BoardUI 规则）、src/ 全子树清点（components 22 子域 522 文件、stores 25、lib 43、locales 73、hooks 9、shims 5、app 9）、electron/、public/ 结构、router.tsx 路由表、main.tsx Provider 树。
- 关键结论：SPA 自 flow-spaces(Next.js) 迁移；next/* 走 shims alias；vendor 拆 chunk 含 mermaid 闭包防 TDZ；BoardUI 源码级组件库随仓库持有。
- 文件级映射并入根 `docs/feature_map.json/html`（web.* 17 个功能节点）。
