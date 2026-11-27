# packages/templates 文件索引

```
packages/templates/
├── package.json          # @flow-spaces/agents：scripts generate-index / build / serve
├── generate-index.mjs    # 扫描子目录生成各 index.json（勿手改索引）
├── agents/               # 186 文件：14 类目 + index.json
│   ├── academic/ design/ engineering/ finance/ game-development/
│   ├── marketing/ paid-media/ product/ project-management/
│   ├── sales/ spatial-computing/ specialized/ support/ testing/
│   └── index.json
├── mcps/                 # 10 个 MCP server 配置 json + index.json
│   ├── brave-search.json everything.json fetch.json filesystem.json
│   ├── git.json github.json memory.json puppeteer.json sqlite.json …
│   └── index.json
├── skills/               # 86 文件：9 技能目录 + index.json
│   ├── caveman/ find-skill-skillhub/ grill-me/ handoff/
│   ├── improve-codebase-architecture/ planning-with-files/
│   ├── superpowers/ tdd/ to-prd/
│   └── index.json
├── output-styles/        # 8 个风格 md（carmack codex-rigor dhh evan-you jobs linus uncle-bob …）+ index.json
├── prompt/               # 3 个 prompt md（andrej-karpathy-skills、claude-token-efficient-coding）+ index.json
└── skillspackage/        # 17 文件：3 个技能包 zip（lyrics-songwriting screenwriting story-outlining）+ 索引
```

- 类目内容多为第三方收集的 agent/prompt 定义（md/json），修改后需重跑 `node generate-index.mjs`。
- 已迁出（勿找回）：`plugins/` → flow-spaces-plugins；`workflows/` → flow-spaces-workflows；`mini-app/` 与 `pack-mini-apps.mjs` → flow-spaces-mini-apps。
