# 数据模型（系统级）

## 持久层

SQLite（`flow-spaces.db`，better-sqlite3 同步 API）+ 文件系统混合：

| 数据 | 存储 | 位置/表 |
|---|---|---|
| 工作流定义 | 文件 JSON | `flow-spaces-data/workflows/<id>/`（execution_history/、versions/ 不入库） |
| 工作区/用户/Profile | SQLite | workspaces、users、user-profile |
| 知识库索引 | SQLite + 向量 | knowledge-bases、knowledge chunks |
| Mini App | 文件 + SQLite | `flow-spaces-data/mini-apps/<id>/`（manifest+src 入库，data/configs 不入库）+ 数据库表 |
| 运行插件 | 文件 | `flow-spaces-data/plugins/<name>/`（14 个运行时插件） |
| 对话/消息 | SQLite | chats、messages（含 token 统计） |
| LLM 目录 | 文件 | `flow-spaces-data/llm/catalog.json` |

## 核心实体（类型定义见 packages/shared/src/types/）

- `Workflow` / `WorkflowNode` / `WorkflowEdge`：画布图结构，节点类型枚举 40+（LLM/工具/条件/循环/子流程…），契约细分 8 文件（workflow/*.ts）。
- `ChatMessage`：统一消息形状（assistant 展示块 blocks[]、工具调用、thinking）。
- `AgentRuntime`：20 个 runtime id（claude-code、codex-cli、grok-cli、gemini、langchain…），经 server adapters 适配。
- `WS 事件`：`events.ts` + `workflow-ws.ts` 定义全部 /ws 通道消息形状。
- `MiniApp`：id、manifest、入口 src、权限与依赖声明。

## 关键关系

- Workflow 节点引用 Agent/Model/Tool/MCP 配置 → 执行时由 server workflow 引擎编排。
- Chat 绑定 Channel（终端/语音/工作流共享同一消息模型）。
