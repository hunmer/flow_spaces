# T6 /workflows/share 真浏览器 WS 验证（2026-11-08 01:02，Chromium + CDP 帧级捕获）

## 场景 1：无 workflow_id（无 share token）
- 渲染：业务空态提示「缺少 workflow_id 参数」，无崩溃（t6-share-no-id.png）
- WS：**不发起任何连接**（与代码一致：page.tsx:164 `if (!workflowId) return`）
- console：零 error/warn

## 场景 2：带未发布 workflow_id
- POST /api/workflows 造实测数据（1 start 节点）→ share 页渲染「该工作流暂未开放 / 作者尚未发布此工作流，暂时无法访问。」（published:false 业务拦截，正确）
- WS：`ws://127.0.0.1:3110/ws?workspaceId=workflows` [open]，连接即收 4 帧初始快照：
  miniApp.taskSnapshot / miniApp.configSnapshot / **connected**{workspaceId:"workflows"} / terminal.sessions
- console：零 error/warn

## 场景 3：发布后（published:true）+ 点「执行」
- 页面完整渲染：工作流名/「1 节点」/描述/执行参数区/执行按钮（t6-share-published.png）
- 点执行后 UI 实时更新：「Step 1/1 Completed, node-1 / JSON 输出 暂无输出」（t6-share-executed.png）
- WS 全双向链路（CDP 帧级，wsid=5 共 17 帧）：
  - ↑ `workflow:execute`（含 snapshot）
  - ↓ `workflow:started` → `execution:log`(running) → `execution:context` → `node:start` → `execution:log` → `execution:context` → `node:complete`(output:{}) → `execution:log` → `workflow:execute:result` → `execution:log`(completed) → `execution:context` → **`workflow:completed`**
- console：零 error/warn（三个场景均无）

## 结论
share 页三态（无 id / 未发布 / 已发布+执行）行为全部正确；WS 直连 3110（SERVER_PORT 重写生效）握手、初始快照、执行事件推送、完成通知全链路可用。与 T4 基线对比 console 无新增错误。
