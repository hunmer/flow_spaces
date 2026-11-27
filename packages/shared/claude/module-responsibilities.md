# packages/shared 模块职责（类型域清单）

`src/types/` 26 个域文件：

| 域文件 | 覆盖 |
|---|---|
| agent / channel / tool | Agent 定义、通知渠道、工具 |
| chat 相关（events） | 事件与 WS 消息形状 |
| database / sqlite / hooks / search | 数据库浏览、SQLite、hooks、搜索 |
| file / git / worktree | 文件、Git、worktree |
| issue / knowledge-base | Issue 系统、知识库 |
| llm / notification / speech / subscription | 模型目录、通知、语音、订阅 |
| workflow.ts | 工作流文档（节点/边/画布元数据）主契约 |
| workflow-composite / workflow-errors / workflow-execution / workflow-node-factory / workflow-plugin / workflow-shortcut / workflow-ws | 复合节点、错误、执行态、节点工厂、插件、快捷键、WS 通道 |
| workspace | 工作区/目录树 |
| index.ts | types 目录桶导出 |

`src/index.ts` 为包入口桶（重导出 types/*）。
