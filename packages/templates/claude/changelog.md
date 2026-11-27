# packages/templates 变更记录

> 仅保留最近 5 条。

## 2026-11-27 — 商店拆仓：内容缩容

- `plugins/`（42 插件模板）→ hunmer/flow-spaces-plugins；`workflows/` → hunmer/flow-spaces-workflows；`mini-app/`（10 个 zip）与 `pack-mini-apps.mjs` → hunmer/flow-spaces-mini-apps（改为 app.json 清单式分发）。
- 包内仅剩 6 类：agents/（14 类目 186 文件）、mcps/（10）、skills/（9 目录 86 文件）、output-styles/（8）、prompt/（3）、skillspackage/（3 zip 17 文件）；tracked 文件 393 → **316**。
- package.json scripts 缩为 generate-index / build / serve；`generate-index.mjs` 继续作为索引唯一来源。
- web 端消费改为 `apps/web/src/lib/agent-store.ts` `resolveStoreUrl` 前缀路由（本地 `/agents-store` 仅分发本包内容）。

## 2026-11-15 — init-project 全量扫描建档

- 建立 CLAUDE.md + claude/overview.md、file-map.md、changelog.md；确认 42 插件模板 + 10 mini-app + 393 文件的当时结构（该结构现已成为历史）。
