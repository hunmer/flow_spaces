# 根目录变更记录

> 仅保留最近 5 条。

## 2026-11-27 — init-project 增量更新：商店拆仓

- 全仓清点（git ls-files 4072 → **2947**）：内置 plugins/workflows/mini-apps 迁出至独立 GitHub 商店仓库（hunmer/flow-spaces-plugins、flow-spaces-workflows、flow-spaces-mini-apps、game-asset-canvas），`packages/templates` 缩容为 agents/mcps/skills/output-styles/prompt/skillspackage（393 → 316 文件），`pack-mini-apps.mjs` 移除。
- 新机制入档：`apps/web/src/lib/agent-store.ts` `REPO_ROUTES`/`resolveStoreUrl` 商店路由（gh-proxy raw + localStorage 镜像 + 旧 `/agents-store` base 自动清除）；mini-app 安装改为 `app.json` 文件级 md5 清单增量安装（server `services/mini-apps.ts` `installFromStore`，支持 GitHub URL）。
- 数据目录口径修正：`getDataDir()`（FLOW_SPACES_DATA_DIR → `~/.flow-spaces-data`，本仓 `.env` 指向 `packages/server/flow-spaces-data/`）；plugins/workflows/mini-apps 整目录不入库（`.gitignore` 顶部注明去向），入库种子缩至 25 文件。
- 失效引用清理：MIGRATION-NOTES.md、docs/feature_map.*、docs/smoke/ 已不随仓分发；`packages/logs/` 改为运行时生成；CodeGraph 索引未建。
- 同步更新：根 CLAUDE.md + claude/ 11 文件、packages/templates 全套、server/web 模块定点（扫描状态与商店相关行）。

## 2026-11-15 — init-project：AI 上下文全套重建

- 生成 `docs/feature_map.json/html`（38 功能节点、4072 文件、覆盖率 100%），脚本 `scripts/gen-feature-map.py` 入库。
- 根 + 5 模块 CLAUDE.md 索引与 claude/ 详情全套生成/更新（apps/web、packages/server、sdk、shared、templates）。
- 修正过时描述：sdk 模块数 38→24；shared 类型域 30→27（team.ts 已移除）；templates 坏链修复。
