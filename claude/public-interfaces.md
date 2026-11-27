# 对外接口（系统级）

## 用户可见面

- Web SPA（见 [apps/web 路由表](../apps/web/claude/public-interfaces.md)）：/home、/workflows(/:id|/share)、/mini-apps(/:id)、/mini-apps-preview(/:id)、/login。
- Electron 桌面壳（apps/web/electron）。

## 服务端口

| 端口 | 服务 |
|---|---|
| 5173 | web dev（vite，代理 /api /ws /public /static） |
| 3110 | flow-spaces server（REST + WS + 静态；`.env` 覆盖，无 env 时默认 3100） |
| 3101 | templates 本地预览（http-server，可选） |

## HTTP/WS 契约

- REST：`/api/*`（server 25 个路由模块、42+ 端点域；唯一无认证端点 `/api/inspector/track`）。详表见 [server/claude/public-interfaces.md](../packages/server/claude/public-interfaces.md)。
- WebSocket：`/ws`（聊天/终端/语音/工作流执行/mini-app 通道），消息形状定义在 `packages/shared/src/types/events.ts`、`workflow-ws.ts`。
- 静态：`/public`（上传/头像）、`/static`、`/agents-store`（**仅分发 `packages/templates` 包内内容**：agents/mcps/skills/output-styles/prompt/skillspackage——拆仓后本地路由已不含 plugins/workflows/mini-app）。

## 商店分发（外部，2026-11 拆仓后）

- 默认 GitHub raw（经 gh-proxy）：`plugins/` → hunmer/flow-spaces-plugins（main）、`workflows/` → hunmer/flow-spaces-workflows（main）、`mini-app/` → hunmer/flow-spaces-mini-apps（main）、其余 → hunmer/flow_spaces master `packages/templates/`。
- Mini App 支持从任意 GitHub 仓库 URL 安装：仓库根 `app.json`（元数据 + 文件级 md5 清单）→ server `installFromStore` 增量安装。
- 自定义镜像：localStorage `flow-spaces:store-api-base`（相对结构与 packages/templates 一致）；旧同源 `/agents-store` base 自动清除。

## 包导出

- `@flow-spaces/sdk`、`@flow-spaces/shared`、`@flow-spaces/server`（npm public）；workspace 内 `workspace:*` 互引。
