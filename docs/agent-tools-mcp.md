# Agent Tools MCP 端点

Flow Spaces server 将内置 agent 工具（`packages/server/src/services/builtin-tools/`）通过 **MCP Streamable HTTP** 协议对外暴露，外部 agent（Claude Code、Cursor、DSH 等 MCP client）可直接调用。

## 端点

| URL | 说明 |
|---|---|
| `POST http://<host>:3100/mcp` | 使用默认（第一个）工作区（默认端口 3100，可用 `PORT` 环境变量覆盖） |
| `POST http://<host>:3100/mcp/<workspaceId>` | 使用指定工作区 |

查询参数（可选）：

- `?tools=A,B,C` — 逗号分隔的工具名白名单，只暴露指定工具
- `?token=<accessToken>` — 查询参数形式的 Bearer token（与 header 等价）

## 鉴权

与 `/api` 完全一致：`Authorization: Bearer <accessToken>`。

- token 来源：env `FLOW_SPACES_TOKEN` 优先，否则 `flow-spaces-data/auth.json` 的 `secret`
- **免鉴权模式**（未设密码/token）：放行所有请求，与 `/api` 行为一致

## 暴露的工具集合（35 个）

MCP 端点**固定只暴露 Workflow（执行 + 节点编辑）与 Mini-app 两类工具**；终端/快捷命令、知识库、频道会话、工作区文件等其余内置工具不对外（`?tools=` 只能在这 35 个之内做过滤）：

- **Workflow 执行（10）**：`list_workflows`、`search_workflow`、`execute_workflow_sync`、`execute_workflow_async`、`get_workflow_result`、`get_workflow_latest_result`、`get_bound_workflow_plugin_tool`、`execute_bound_workflow_plugin_tool`、`list_available_agent_capabilities`、`list_agent_capabilities`
- **Workflow 节点编辑（24）**：草稿入口 `load_workflow`（把已存在工作流载入编辑草稿）、`create_workflow`（新建空工作流并载入）；编辑器工具 `create_node`、`update_node`、`set_node_io_fields`、`delete_node`、`create_edge`、`delete_edge`、`insert_node`、`auto_layout`、`create_workflow_version`、`restore_workflow_version`、`update_workflow_info`、`set_workflow_takeover`、`saveworkflow`（落盘+校验）、`dry_run`、`batch_update`；查询工具 `get_workflow`、`get_current_workflow`、`search_nodes`、`list_node_types`、`search_node_usage`、`check_workflow_chain`、`get_node_property_type_definition`
- **Mini-app（1）**：`execute_miniapp_tool`

**外部 agent 编辑工作流的典型流程**：`list_workflows` → `load_workflow(workflow_id)`（或 `create_workflow`）→ `list_node_types` 查可用节点类型 → `create_node`/`update_node`/`create_edge`/`batch_update` 编辑 → `saveworkflow` 落盘（触发后端校验）。编辑草稿按工作区常驻服务进程内存，跨多次 MCP 请求存活。

**终端/快捷命令（4 个，`ReadTerminalOutput`/`ListQuickCommands`/`RunQuickCommand`/`StopQuickCommand`）与知识库工具（11 个，`ListDatabases`/`CreateDatabaseNode`/`WriteDatabaseNode` 等）已彻底删除 agent tool 包装，不再作为任何 agent 的工具暴露**（MCP 端点与 workflow/agent 节点均不可用）：它们只保留内部代码实现（HTTP API / 服务层）。节点旧配置中残留的这些工具名会在保存时被自动过滤丢弃。

工具的 `inputSchema`（JSON Schema）、`description`、`annotations`（readOnly/destructive/openWorld hint）从 `AgentFunctionTool` 原样映射。

## 外部 agent 接入配置示例

```json
{
  "mcpServers": {
    "flow-spaces": {
      "type": "http",
      "url": "http://127.0.0.1:3100/mcp",
      "headers": {
        "Authorization": "Bearer <accessToken>"
      }
    }
  }
}
```

## 实现说明

- `services/agent-tools-mcp.ts`：把 `AgentFunctionTool[]` 映射为 MCP `Server`（tools/list + tools/call）
- `routes/mcp-server.ts`：Streamable HTTP **stateless** 传输（每请求独立 server+transport），用完即关
- `app.ts` 挂载 `app.use('/mcp', ...)`（在 `/api` auth 之外，自带鉴权）
- 依赖：`@modelcontextprotocol/sdk`（底层 `Server` API 原生接受 JSON Schema，无需 Zod 转换）
