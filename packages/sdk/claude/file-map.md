# SDK 模块 — 文件索引

```
packages/sdk/
├── CLAUDE.md
├── claude/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # createSDK 工厂 + 全部导出
│   ├── client.ts             # HttpClient 实现
│   ├── types.ts              # SDKConfig, RequestOptions, ApiError
│   └── modules/              # 17 个 API 模块
│       ├── workspace.ts, agent.ts, channel.ts, chat.ts ...
│       ├── workflow.ts, mini-apps.ts, sqlite.ts, editor.ts ...
│       └── auth.ts, llm.ts, mcps.ts, skills.ts, search.ts ...
├── demo/                     # 10 个 HTML 演示页（2026-11-27 清理死页后）
└── scripts/
    └── fix-esm-extensions.mjs
```
