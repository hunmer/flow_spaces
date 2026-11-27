# 数据模型（系统级）

## 运行时数据目录（getDataDir）

`packages/server/src/storage/json-store.ts` 的 `getDataDir()`：`FLOW_SPACES_DATA_DIR` / `AGENT_SPACES_DATA_DIR` 环境变量 → 默认 `~/.flow-spaces-data/`。本仓库开发实例经 `packages/server/.env` 指向 `packages/server/flow-spaces-data/`。

flow-spaces-data 各子目录的入库策略（`.gitignore`）：

| 子目录 | 内容 | 入库 |
|---|---|---|
| `agent-templates/`、`llm/`、`user-profile*`、`workspaces/`、`database/`、`knowledge-bases/`、`public/uploads/` | 种子/注册数据 | 是（当前 25 个 tracked 文件） |
| `plugins/`、`workflows/`、`mini-apps/` | 用户安装的插件/工作流/Mini App | **整目录不入库**（已拆分到独立商店仓库，`.gitignore` 顶部注释注明去向） |
| `llm/providers.json` | 供应商凭据 | 否（单独忽略） |

## 持久层

SQLite（better-sqlite3 / node:sqlite 同步 API）+ 文件系统混合：

| 数据 | 存储 | 位置/表 |
|---|---|---|
| 工作流定义 | 文件 JSON | `<dataDir>/workflows/<id>/`（运行时生成；execution_history/、versions/ 不入库） |
| 工作区/用户/Profile | SQLite + JSON | workspaces、users；`<dataDir>/workspaces/`、`user-profile.json` |
| 知识库索引 | SQLite + 向量 | knowledge-bases、knowledge chunks（`<dataDir>/knowledge-bases/knowledge-bases.sqlite`） |
| Mini App | 文件 + SQLite | `<dataDir>/mini-apps/<id>/`（manifest.json + src 文件树 + configs；沙箱数据库 `<id>/data/db/*.sqlite`） |
| 运行插件 | 文件 | `<dataDir>/plugins/<name>/`（从商店仓库安装） |
| 对话/消息 | SQLite | chats、messages（含 token 统计） |
| LLM 目录 | 文件 | `<dataDir>/llm/catalog.json`、`models.json`（种子入库） |

## 商店安装数据流（拆仓后核心机制）

- 索引拉取：web 端 `lib/agent-store.ts` `fetchStoreIndex(path)` → `resolveStoreUrl(path)` 路由（`plugins/`→flow-spaces-plugins、`workflows/`→flow-spaces-workflows、`mini-app/`→flow-spaces-mini-apps、其余→flow_spaces master `packages/templates/`，均经 gh-proxy raw）。
- Mini App 安装（`services/mini-apps.ts` `installFromStore`）：输入 app 源根 raw base + 文件级 md5 清单（仓库根 `app.json`：元数据 + files[]），server 逐文件比对 md5 增量下载/跳过，落盘 `<dataDir>/mini-apps/<id>/`。也支持直接粘贴 GitHub 仓库地址（`parseGithubRepoUrl`，兼容 `owner/repo` 简写）。
- 插件安装：`workflow-plugins-dialog` → `sdk.workflowPlugin.installFromStore(pluginId, resolveStoreUrl('plugins/…'))` → server 落盘 `<dataDir>/plugins/<name>/`。
- Mini App 文件清单优化：`mini-app-store.ts` `MANIFEST_SKIP_DIRS` 排除 node_modules/.git/vendor 等目录——vendor 巨库（如 game-asset-canvas 的 LPC spritesheet ~90k 文件）会让 manifest 全树 statSync 阻塞 Express 十几秒；vendor 产物只经 `/src/file/*` 按需加载。

## 核心实体（类型定义见 packages/shared/src/types/）

- `Workflow` / `WorkflowNode` / `WorkflowEdge`：画布图结构，节点类型枚举 40+（LLM/工具/条件/循环/子流程…），契约细分 8 文件（workflow/*.ts）。
- `ChatMessage`：统一消息形状（assistant 展示块 blocks[]、工具调用、thinking）。
- `AgentRuntime`：20 个 runtime id（claude-code、codex-cli、grok-cli、gemini、langchain…），经 server adapters 适配。
- `WS 事件`：`events.ts` + `workflow-ws.ts` 定义全部 /ws 通道消息形状。
- `MiniApp`：id、manifest、入口 src、权限与依赖声明；商店源为独立仓库 `app.json` 清单。

## 关键关系

- Workflow 节点引用 Agent/Model/Tool/MCP 配置 → 执行时由 server workflow 引擎编排。
- Chat 绑定 Channel（终端/语音/工作流共享同一消息模型）。
