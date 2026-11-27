# 文件索引（根目录）

```
flow_spaces/
├── AGENTS.md               # 工程师规则（中文、最小改动、rg 优先）
├── CLAUDE.md               # AI 上下文索引（本目录 claude/ 的入口）
├── README.md               # 项目简介（部分路径仍指向旧机器/旧文件，以本索引为准）
├── procm-commands.json     # procm 命令：dev/dev:server/build/build:packages/preview/typecheck
├── pnpm-workspace.yaml     # packages/* + apps/*，allowBuilds
├── tsconfig.base.json      # ES2022 strict bundler
├── claude/                 # 根级详情文档（本目录，11 文件）
├── scripts/
│   ├── gen-feature-map.py  # 功能图谱生成（重建 docs/feature_map.json；产物已入库）
│   ├── check-locale-parity.mjs
├── docs/
│   ├── feature_map.json    # 功能依赖图谱数据（33 节点/2728 文件；已入库）
│   ├── feature_map.html    # 功能图谱可视化（vis-network；已入库）
│   ├── init-project-report-2026-11-27.md  # 本轮 init-project 执行报告
│   ├── agent-tools-mcp.md  # agent-tools MCP 服务说明
│   ├── workflow/           # 工作流开发指南 9 篇（plugin-guide、builtin 节点注册等）
│   └── boardui-migration/  # BoardUI 组件库迁移冒烟截图
├── apps/web/               # React 19 SPA（→ 其 CLAUDE.md）
└── packages/               # server/sdk/shared/templates（→ 各 CLAUDE.md；logs/ 运行时生成不入库）
```

## 外部关联仓库（商店内容源，不在本仓内）

| 仓库 | 内容 |
|---|---|
| github.com/hunmer/flow-spaces-plugins | 插件模板（索引前缀 `plugins/`） |
| github.com/hunmer/flow-spaces-workflows | 工作流模板（前缀 `workflows/`） |
| github.com/hunmer/flow-spaces-mini-apps | Mini App 商店源（前缀 `mini-app/`，仓库根 app.json 清单） |
| github.com/hunmer/game-asset-canvas | 独立 mini-app 产品示例（GitHub URL 安装） |

注：`MIGRATION-NOTES.md`、`docs/smoke/` 已不随仓分发（原 README/docs 中的相关失效链接已于 2026-11-27 清理）；`docs/feature_map.json/html` 2026-11-27 重建（含 Monaco→CodeMirror 迁移后状态，已入库）。
