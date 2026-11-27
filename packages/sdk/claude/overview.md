# SDK 模块 — 概述

## 架构

`createSDK(config)` → `SDK` 对象，包含 17 个 API 模块（2026-11-27 死代码清理后）。

每个模块通过 `createXxxApi(http: HttpClient)` 工厂函数创建，接收统一的 HTTP 客户端。

## API 模块列表（17 个）

agent, agent-commands, auth, channel, chat, editor, external-import, knowledge-base, llm, mcps, mini-apps, search, skills, sqlite, workflow, workflow-plugin, workspace

（2026-11-27 删 account/agent-store/avatar/font/inspector/notification/tools 7 个 0 消费模块及 46 个 0 消费方法；sdk 仅服务本仓前端，未消费不保留）

## 使用方式

```typescript
import { createSDK } from '@flow-spaces/sdk';
const sdk = createSDK({
  baseUrl: 'http://localhost:3110',
  getToken: () => localStorage.getItem('token'),
  onUnauthorized: () => { window.location.href = '/login'; },
});
const workspaces = await sdk.workspace.list();
```
