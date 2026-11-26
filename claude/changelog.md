# 根目录变更记录

> 仅保留最近 5 条。

## 2026-11-15 — init-project：AI 上下文全套重建

- 生成 `docs/feature_map.json/html`（38 功能节点、4072 文件、覆盖率 100%），脚本 `scripts/gen-feature-map.py` 入库。
- 根 + 5 模块 CLAUDE.md 索引与 claude/ 详情全套生成/更新（apps/web、packages/server、sdk、shared、templates）。
- 修正过时描述：sdk 模块数 38→24；shared 类型域 30→27（team.ts 已移除）；templates 坏链修复。
