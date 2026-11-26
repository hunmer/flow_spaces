# Workflow 文档

从 agent_spaces 仓库 `packages/web/docs` 迁移的工作流相关文档（本项目自 agent_spaces 拆分而来，见根目录 `MIGRATION-NOTES.md`）。

> 说明：原目录中没有独立的 miniapp 文档（i18n / chat 文档中的 "mini" 仅为模型名与命名空间列表项），miniapp 相关说明见 `packages/server/flow-spaces-data/mini-apps/*/src/CLAUDE.md` 与根目录迁移笔记。`chat-capabilities.md`、`client-plugin-runtime.md`、`i18n-guide.md` 与工作流无关，未迁移。

## 文档索引

| 文档 | 主题 |
|---|---|
| [builtin-workflow-node-registration.md](builtin-workflow-node-registration.md) | 内置工作流节点注册指南 |
| [compound-workflow-nodes.md](compound-workflow-nodes.md) | 组合节点（父子关系）与循环节点模型 |
| [interactive-nodes.md](interactive-nodes.md) | 需要用户前端确认的交互式节点 |
| [loop-loop-body-implementation.md](loop-loop-body-implementation.md) | `loop` / `loop_body` 关键实现约束 |
| [workflow-node-state-breakpoint.md](workflow-node-state-breakpoint.md) | 节点状态与断点能力（数据模型 + 运行时解释） |
| [workflow-output-field-types.md](workflow-output-field-types.md) | 节点输出字段类型（`OutputField.type`） |
| [plugin-guide.md](plugin-guide.md) | workflow 插件开发指南 |
| [plugin-local-testing.md](plugin-local-testing.md) | 插件本地测试环境（`dev:plugin` runner） |

## 迁移时的路径映射（旧 → 新）

本项目由 Next.js monorepo (`packages/web`) 迁到 Vite SPA (`apps/web`)，文档内路径已按下表更新：

| 旧路径（agent_spaces） | 新路径（flow_spaces） |
|---|---|
| `packages/web/src/...` | `apps/web/src/...` |
| `src/composables/workflow/useFlowCanvas.ts` | `apps/web/src/hooks/use-workflow-editor.ts` |
| `src/composables/workflow/useConnectionDrop.ts` / `useEdgeInsert.ts` | `apps/web/src/components/workflow/use-workflow-edge-operations.ts` |
| `src/lib/workflow/engine.ts`（前端单节点调试执行器） | `apps/web/src/components/workflow/use-workflow-editor-execution.ts` |
| `src/lib/workflow/nodes/*.ts` | `apps/web/src/lib/workflow-nodes/definitions/*.ts` |
| `src/lib/workflow/types.ts` / `src/types/workflow*.ts` | `@flow-spaces/shared` 包中的 workflow 类型 |
| `src/lib/backend-api/interaction.ts` | `apps/web/src/lib/workflow-nodes/definitions/interaction.ts` |
| `src/types/workflow-node-factory.ts` | `apps/web/src/lib/workflow-nodes/registry.ts` |
| `backend/workflow/execution-manager.ts` | `packages/server/src/services/execution-manager.ts` |
| `backend/data/plugins/<id>`（用户安装插件） | 数据目录 `plugins/<id>`（默认 `~/.flow-spaces-data/plugins`，`FLOW_SPACES_DATA_DIR` 可覆盖；本地开发数据在 `packages/server/flow-spaces-data/plugins`） |
| `resources/plugins/<id>`（开发内置插件） | `packages/templates/plugins/<id>` |
| `src/dev/plugin-tests/...`（插件测试） | `packages/server/src/dev/plugin-tests/...` |
| `@flow-spaces/server` | `@flow-spaces/server` |

Vue 时代的旧组件名（`CustomNodeWrapper.vue`、`NodeProperties.vue`、`NodeSidebar.vue`、`VariablePicker.vue`、`NodeSelectDialog.vue`）已映射为现有 React 组件（`workflow-node.tsx`、`workflow-properties-panel.tsx`、`workflow-node-sidebar.tsx`、`workflow-node-select-dialog.tsx`）。

Electron client 插件相关章节保留：当前 Web 端通过可选的 `window.electronAPI` 仍兼容该运行目标，但本项目以 Web 为主。
