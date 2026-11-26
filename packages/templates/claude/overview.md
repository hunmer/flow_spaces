# packages/templates 概述

## 定位

`@flow-spaces/agents`（v0.1.0，private）是模板/资源分发包：插件模板、内置 Mini App 打包产物、Workflow 模板与索引。构建产物由 Server 以 `/agents-store` 静态路由对外提供服务（Agent Store 的内容源）。

## 组成

- `plugins/`：42 个插件模板目录（openai、comfyui、feishu、notion、ffmpeg、jianying-draft、obsidian、mcp-bridge、libtv、nano-banana 等；部分带独立 package.json）。
- `mini-app/`：10 个内置 Mini App 的 zip 打包产物（ai_image_video、kanban、copywriting、cover-generator、database-demo、notion-database 等）+ `icons/`、`index.json`、`intro/`。
- `workflows/`：内置工作流模板（code-writing.json 等）+ 索引。
- 根：`generate-index.mjs`（生成各 index.json）、`pack-mini-apps.mjs`（打包 mini-app zips）。

## 构建/服务流程

1. `pnpm build`（= pack-mini-apps + generate-index）生成 zips 与索引。
2. `pnpm serve`：`http-server . -p 3101 --cors -c-1` 本地预览。
3. 生产由 server 端静态路由（`/agents-store`）分发；web 端 Agent Store 页消费。

## 取舍

- 模板是"内容"而非"代码工程"：插件模板结构与运行时插件（flow-spaces-data/plugins）同构，安装即复制。
