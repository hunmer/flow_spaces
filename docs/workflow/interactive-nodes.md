# Interactive Nodes（交互式节点）

需要用户在前端确认后工作流才能继续的节点类型。

## 工作原理

```
backend execution-manager
  → dispatchNode() 发现节点需要用户交互
  → interactionManager.request(interactionType)
  → WS 发送 interaction_required 到前端
  → 工作流暂停等待

frontend
  → apps/web/src/stores/workflow-editor/interaction.ts 收到 interaction_required
    （该 slice 直接监听 WS 消息 `workflow:interaction`）
  → store.pendingInteraction 被设置
  → workflow-node.tsx 渲染该节点的 customView（React 组件）
  → 组件读取 store.pendingInteraction 判断当前节点是否处于交互等待态
  → customView 显示交互 UI（表格/表单/确认按钮等）
  → 用户操作后调用 resolveInteraction(data)
  → WS 发送 interaction_response 回后端
  → 工作流继续执行
```

## 现有交互式节点

| 节点类型 | interactionType | 说明 |
|---------|----------------|------|
| `table_display` (selectionMode !== 'none') | `table_confirm` | 表格行选择，支持单选/多选 |

## 新增交互式节点

以 `table_display` 为例，完整步骤：

### 1. 定义 InteractionType

`packages/shared/src/types/workflow-ws.ts` — 添加类型和 schema：

```typescript
export type InteractionType =
  | ...
  | 'your_new_type'  // 加这里
  | 'custom'

export interface YourNewInteractionSchema {
  // 交互请求携带的数据
}
```

### 2. 注册内置节点

`apps/web/src/lib/workflow-nodes/definitions/`（交互类节点在 `definitions/interaction.ts`）— 添加节点定义。

### 3. 后端执行逻辑

`packages/server/src/services/execution-manager.ts` — 在 `dispatchNode` 的 switch 中加 case，通过 `interactionManager.request()` 发起交互：

```typescript
case 'your_node_type':
  return this.executeYourNode(session, node, resolvedData)

private async executeYourNode(session, node, resolvedData): Promise<any> {
  // 不需要交互时直接返回
  if (skipCondition) return { result }

  // 需要交互时
  const schema: YourNewInteractionSchema = { ... }
  const result = await this.deps.interactionManager.request({
    clientId: session.ownerClientId,
    executionId: session.id,
    workflowId: session.workflow.id,
    nodeId: node.id,
    interactionType: 'your_new_type',
    schema,
  })
  return result
}
```

### 4. 创建 customView 组件

在 `apps/web/src/components/workflow/` 下创建 React 组件（TSX），组件由 `workflow-node.tsx` 以固定 props 挂载：

| Prop | 类型 | 说明 |
|------|------|------|
| `nodeId` | `string` | 节点 id |
| `data` | `Record<string, unknown>` | 节点数据（执行后有运行结果覆盖） |
| `isRunning` | `boolean` | 是否执行中 |
| `isPreview` | `boolean` | 是否预览态 |

组件内部从 workflow-editor store 读取 `pendingInteraction` 判断是否处于交互等待态，并决定交互态和非交互态的渲染差异。非交互态只展示数据，交互态显示操作控件（如 checkbox、提交按钮）。

### 5. 注册 customView

`apps/web/src/lib/workflow-nodes/definitions/display.ts` — 或对应节点分类文件中注册。

### 6. 交互等待态与提交

组件内（而非节点 wrapper）处理交互态：从 store 取 `pendingInteraction`，当 `pending.nodeId === nodeId` 且 `interactionType` 匹配时进入交互态；用户确认后调用 store 的 `resolveInteraction(result)`（内部经 WS 发送 `interaction_response` 并清空 pendingInteraction）：

```typescript
const pending = useWorkflowEditorStore((s) => s.pendingInteraction)
const resolveInteraction = useWorkflowEditorStore((s) => s.resolveInteraction)
const isPending = pending?.nodeId === nodeId && pending?.interactionType === 'your_new_type'
// isPending 时渲染操作控件，提交时调用 resolveInteraction(result)
```

## 插件节点

插件注册的节点也可以使用交互机制。后端执行插件 handler 时（`services/plugin.ts` 与 `execution-manager.ts` 的插件节点链路），如果需要用户交互，按相同模式调用 `interactionManager.request()`。

前端侧为插件节点类型提供 customView（`workflow-node.tsx` 对插件 customView 走 `PluginWorkflowCustomView` 渲染），或提供通用的插件交互视图。
