// workflow 接管状态：内存 Map + WS 事件广播。
// 用途：Agent 通过 MCP（set_workflow_takeover）或前端通过 REST（POST /api/workflows/:id/takeover）
// 设置接管状态，网页端监听 workflow:takeover 事件展示「正在被 Agent 接管中」遮罩。
// 内存态：进程重启丢失可接受（无记录即视为未接管）。
import { broadcastToAll, broadcastToWorkspace } from '../ws/connection-manager.js';

export interface WorkflowTakeoverState {
  workflowId: string;
  active: boolean;
  message: string;
  /** 最近一次状态变化的 epoch ms。 */
  updatedAt: number;
}

const states = new Map<string, WorkflowTakeoverState>();

/** 查询接管状态；无记录时返回 active:false 的默认态。 */
export function getWorkflowTakeover(workflowId: string): WorkflowTakeoverState {
  const state = states.get(workflowId);
  if (state) return { ...state };
  return { workflowId, active: false, message: '', updatedAt: 0 };
}

/**
 * 设置接管状态并广播 workflow:takeover（每次变化都广播，data 与 REST 返回结构一致）。
 * @param message 接管提示文案；取消接管未传时沿用上次文案，避免前端收到空提示。
 */
export function setWorkflowTakeover(
  workflowId: string,
  enabled: boolean,
  message?: string,
  workspaceId?: string,
): WorkflowTakeoverState {
  const previous = states.get(workflowId);
  const next: WorkflowTakeoverState = {
    workflowId,
    active: enabled,
    message: message ?? previous?.message ?? '',
    updatedAt: Date.now(),
  };
  states.set(workflowId, next);
  broadcastEvent(workspaceId, 'workflow:takeover', {
    workflowId: next.workflowId,
    active: next.active,
    message: next.message,
    updatedAt: next.updatedAt,
  });
  return { ...next };
}

/** saveworkflow 保存成功后广播 workflow:saved（data={ workflowId, updatedAt }）。 */
export function broadcastWorkflowSaved(
  workspaceId: string | undefined,
  workflowId: string,
  updatedAt: number,
): void {
  broadcastEvent(workspaceId, 'workflow:saved', { workflowId, updatedAt });
}

// 有 workspaceId 时广播到该 workspace 的全部 WS 连接（connection-manager.broadcastToWorkspace）；
// REST 路径没有 workspaceId 上下文，退化为全连接广播，事件 data 携带 workflowId 供前端过滤。
function broadcastEvent(workspaceId: string | undefined, event: string, data: Record<string, unknown>): void {
  if (workspaceId) {
    broadcastToWorkspace(workspaceId, event, data);
    return;
  }
  broadcastToAll(event, data);
}
