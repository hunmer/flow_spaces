# 文件索引（根目录）

```
flow_spaces/
├── AGENTS.md               # 工程师规则（中文、最小改动、CodeGraph 优先）
├── CLAUDE.md               # AI 上下文索引（本目录 claude/ 的入口）
├── MIGRATION-NOTES.md      # flow-spaces→flow_spaces 迁移对照（41KB）
├── README.md
├── i18n-workset.txt        # i18n 翻译工作集清单
├── procm-commands.json     # procm 命令：dev/dev:server/build/build:packages/preview/typecheck
├── pnpm-workspace.yaml     # packages/* + apps/*，allowBuilds
├── tsconfig.base.json      # ES2022 strict bundler
├── claude/                 # 根级详情文档（本目录，11 文件）
├── scripts/
│   ├── gen-feature-map.py  # 功能图谱生成（docs/feature_map.*）
│   ├── check-locale-parity.mjs
│   ├── audit-i18n-hardcode.mjs
│   ├── copy-closure.mjs / verify-copy.mjs   # 迁移期 closure 复制校验
├── docs/
│   ├── feature_map.json / feature_map.html  # 38 节点/4072 文件/100% 覆盖
│   ├── agent-tools-mcp.md  # agent-tools MCP 服务说明
│   ├── workflow/           # 工作流开发指南 9 篇（plugin-guide 等）
│   ├── boardui-migration/  # BoardUI 组件库迁移记录
│   └── smoke/              # 路由冒烟截图
├── apps/web/               # React 19 SPA（→ 其 CLAUDE.md）
└── packages/               # server/sdk/shared/templates/logs（→ 各 CLAUDE.md）
```

文件级全量映射见 `docs/feature_map.html`（可搜索、带行数与 role）。
