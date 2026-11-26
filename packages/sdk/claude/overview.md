# SDK 模块 — 概述

## 架构

`createSDK(config)` → `SDK` 对象，包含 24 个 API 模块。

每个模块通过 `createXxxApi(http: HttpClient)` 工厂函数创建，接收统一的 HTTP 客户端。

## API 模块列表（24 个）

account, agent, agent-commands, agent-store, auth, avatar, channel, chat, editor, external-import, font, inspector, knowledge-base, llm, mcps, mini-apps, notification, search, skills, sqlite, tools, workflow, workflow-plugin, workspace

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
