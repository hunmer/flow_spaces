# packages/templates 概述

## 定位

`@flow-spaces/agents`（v0.1.0，private）是 Agent Store 的**本地内容源**：agents、mcps、skills、output-styles、prompt、skillspackage 六类内容与索引。构建产物由 server `/agents-store` 静态路由或 GitHub raw（hunmer/flow_spaces master `packages/templates/`）对外分发，web 端商店对话框消费。

## 拆仓背景（2026-11）

原 `plugins/`（42 个插件模板）、`mini-app/`（10 个内置 Mini App zip）、`workflows/`（内置工作流模板）与 `pack-mini-apps.mjs` 已全部迁出：

| 迁出内容 | 独立仓库 |
|---|---|
| 插件模板 | github.com/hunmer/flow-spaces-plugins |
| 工作流模板 | github.com/hunmer/flow-spaces-workflows |
| Mini App 商店源 | github.com/hunmer/flow-spaces-mini-apps（清单式 app.json，不再打 zip） |

web 端 `apps/web/src/lib/agent-store.ts` 按索引 path 前缀（`plugins/` `workflows/` `mini-app/`）路由到对应仓库 raw（gh-proxy 默认代理）；本包内容走无前缀路径。旧的同源 `/agents-store` store base 读取时自动清除。

## 组成

- `agents/`：14 个类目目录（academic、design、engineering、finance、game-development、marketing、paid-media、product、project-management、sales、spatial-computing、specialized、support、testing）+ `index.json`，共 186 文件。
- `mcps/`：10 个 MCP server 配置 JSON（brave-search、everything、fetch、filesystem、git、github、memory、puppeteer、sqlite 等）+ `index.json`。
- `skills/`：9 个技能目录（caveman、find-skill-skillhub、grill-me、handoff、improve-codebase-architecture、planning-with-files、superpowers、tdd、to-prd）+ `index.json`，共 86 文件。
- `output-styles/`：8 个输出风格 md（carmack、codex-rigor、dhh、evan-you、jobs、linus、uncle-bob 模式）+ `index.json`。
- `prompt/`：3 个 prompt 模板（andrej-karpathy-skills、claude-token-efficient-coding）+ `index.json`。
- `skillspackage/`：3 个内容创作技能包 zip（lyrics-songwriting、screenwriting、story-outlining）+ 索引，共 17 文件。

## 构建/服务流程

1. `pnpm build`（= `node generate-index.mjs`）生成各子目录 `index.json`。
2. `pnpm serve`：`http-server . -p 3101 --cors -c-1` 本地预览。
3. 生产由 server 端静态路由（`/agents-store`，`app.ts` `resolveRuntimeDir('../templates')`）分发；或 GitHub raw 直接分发（默认 base：`https://gh-proxy.org/https://github.com/hunmer/flow_spaces/raw/refs/heads/master/packages/templates/`）。

## 取舍

- 模板是"内容"而非"代码工程"：索引与内容同目录，`generate-index.mjs` 单脚本扫目录产 `index.json`。
- 商店内容三分类（plugins/workflows/mini-app）迁出后，本包只保留与 Agent 配置直接相关的六类内容，本地 server 与远端 GitHub 双通道分发同一份内容。
