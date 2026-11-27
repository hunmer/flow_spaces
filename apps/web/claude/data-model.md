# apps/web 数据模型（前端侧）

类型契约源头在 `@flow-spaces/shared`（packages/shared/src/types，26 个域文件）。此处只记录 web 特有的状态与数据形态。

## Zustand stores（src/stores/）

| Store | 域 |
|---|---|
| `workspace.ts` | 当前工作区、目录树、选中节点 |
| `chat.ts` | 会话列表、消息流、流式分片 |
| `agent.ts` / `account.ts` / `channel.ts` | Agent 配置、账号、通知渠道 |
| `editor.ts` + `editor-send.ts` | 文件编辑器状态与发送管线 |
| `workflow.ts` + `workflow-editor/` | 工作流定义与编辑器画布状态（选中/视口/暂存/撤销） |
| `terminal.ts` | 终端会话注册（配 lib/terminal-registry） |
| `llm.ts` | 模型目录与选择（配 lib/model-catalog） |
| `inspector-history.ts` | dev inspector 轨迹 |
| `mobile-panel.ts` | 移动端面板开合 |
| `search-commands/` | 命令面板可搜索项 |

## 关键数据流

- **REST**：组件 → `lib/sdk.ts`（`createSDK()` 单例）→ server `/api/*`；错误经 `lib/api-error.ts` 归一。
- **WS**：`lib/ws.ts` 长连接；工作流执行进度/聊天增量/终端输出走消息分片（`shared/types/events.ts`、`workflow-ws.ts`）。
- **工作流文档**：节点/边 schema 在 `shared/types/workflow.ts`；画布序列化 helpers 在 `components/workflow/workflow-canvas-*.ts`；复合节点/执行态见 `workflow-composite.ts`、`workflow-execution.ts`。
- **Mini App 运行态**：manifest（服务端 `flow-spaces-data/mini-apps/*/manifest.json`）+ 用户 JSX/JS 在 Babel standalone 沙箱动态编译渲染（components/mini-apps/react-renderer）。**来源**：商店安装——`lib/agent-store.ts` `resolveStoreUrl` 路由到外部仓库（hunmer/flow-spaces-mini-apps 等）→ `sdk.miniApp.installFromStore`（远端 app.json 文件级 md5 清单，server 增量拉取落盘）；也支持从任意 GitHub 仓库 URL 安装（`parseGithubRepoUrl`）。
- **i18n**：`locales/{en,zh}/*.json` 命名空间，LocaleProvider 固定 locale。

## 本地持久化

- localStorage：主题、免鉴权标记（`lib/auth.ts`）、`use-persistent-state` 各处。
- 无 IndexedDB 前端数据库；知识库/SQLite 浏览均走 server API。
