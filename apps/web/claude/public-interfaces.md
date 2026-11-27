# apps/web 对外接口（页面路由）

SPA 无服务端路由；以下为 react-router 客户端路由（`src/app/router.tsx`）：

| 路由 | 组件 | 布局 | 说明 |
|---|---|---|---|
| `/` | `Navigate → /home` | — | 默认落地重定向 |
| `/home` | `MarketingHome` | SidebarRail | boardui 仪表盘首页 |
| `/workflows` | `WorkflowsPage` | SidebarRail | 工作流列表 |
| `/workflows/:id` | `WorkflowEditorPageClient` | 全屏 | 工作流编辑器 |
| `/workflows/share` | `WorkflowSharePage` | 全屏 | 分享执行页（完整业务页） |
| `/mini-apps` | `MiniAppPage` | SidebarRail | Mini App 列表 |
| `/mini-apps/:id` | `MiniAppEditorPageClient` | 全屏 | Mini App 编辑器 |
| `/mini-apps-preview`、`/mini-apps-preview/:id` | `MiniAppPreviewRoute` → `MiniAppPreviewPageClient` | 全屏 | 运行预览（query `?id=` 与 path 参数双形态；无 id 渲染友好空态） |
| `/login` | `LoginPage` | 全屏 | 密码登录单页（同心圆环背景） |
| `*` | `NotFoundPage` | SidebarRail | 404 |

## 对后端的消费面

- REST：全部经 `@flow-spaces/sdk`（24 模块，见 packages/sdk）；路由级数据访问在 `src/app/api/`。
- WS：`/ws` 代理 → server（聊天/终端/语音/工作流执行通道，`lib/ws.ts`）。
- 静态：`/public`（上传/头像）、`/static`。

## 导出给其他包的内容

无 — `@flow-spaces/web` 是应用叶子节点，不对外导出接口。
