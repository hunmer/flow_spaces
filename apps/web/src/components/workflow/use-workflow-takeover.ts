import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchWithAuth } from '@/lib/auth';
import { getWS } from '@/lib/ws';

/**
 * Agent 接管状态（与后端协议对齐）：
 * - WS 'workflow:takeover' data = { workflowId, active, message, updatedAt }
 * - WS 'workflow:saved'   data = { workflowId, updatedAt }
 * - REST GET  /api/workflows/:workflowId/takeover → { workflowId, active, message, updatedAt }
 * - REST POST /api/workflows/:workflowId/takeover body { enabled, message? }
 */
export interface WorkflowTakeoverStatus {
  active: boolean;
  message?: string;
  updatedAt: number;
}

interface UseWorkflowTakeoverOptions {
  /**
   * 接管结束（active 变为 false）或收到 workflow:saved 时触发，
   * 调用方应在此回调里把画布刷新为服务端最新保存的数据。
   */
  onSaved?: () => void;
}

export interface UseWorkflowTakeoverResult {
  /** 服务端视角是否处于接管中（与“忽略”无关） */
  active: boolean;
  /** 是否显示全屏占位：接管中且当前这轮未被用户本地忽略 */
  visible: boolean;
  /** 服务端下发的接管说明文案（可为空） */
  message: string | null;
  /** 取消接管的 POST 请求进行中 */
  canceling: boolean;
  /** 取消接管：POST { enabled: false }；成功后接管结束并触发 onSaved 刷新画布 */
  cancelTakeover: () => Promise<boolean>;
  /** 本地忽略当前这轮接管（仅前端记录）；新的接管事件（updatedAt 变化）会重新弹出 */
  dismiss: () => void;
}

/** 'workflow:takeover' 事件负载（与 packages/server 协议对齐） */
interface TakeoverEvent {
  workflowId: string;
  active?: boolean;
  message?: string;
  updatedAt?: number;
}

/** 'workflow:saved' 事件负载 */
interface SavedEvent {
  workflowId?: string;
  updatedAt?: number;
}

/**
 * 订阅某个 workflow 的 Agent 接管状态：
 * 挂载/workflowId 变化时 GET 初始状态（失败静默视为未接管，等待 WS 事件纠正），
 * 之后通过 WS 事件实时更新；提供取消接管（POST）与本地忽略两个动作。
 */
export function useWorkflowTakeover(
  workflowId: string | null,
  workspaceId: string | undefined,
  options: UseWorkflowTakeoverOptions = {},
): UseWorkflowTakeoverResult {
  const [status, setStatus] = useState<WorkflowTakeoverStatus | null>(null);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [canceling, setCanceling] = useState(false);

  // 记录最近一次已知的 active，用于识别“接管结束”沿（false→ 不触发；true→false 触发刷新）
  const wasActiveRef = useRef(false);
  // onSaved 可能每次渲染都是新函数，用 ref 承载最新实现，避免 WS 订阅反复重建
  const onSavedRef = useRef(options.onSaved);
  useEffect(() => {
    onSavedRef.current = options.onSaved;
  }, [options.onSaved]);

  /** 统一状态更新入口：GET 响应与 WS 事件共用，接管结束时触发一次 onSaved */
  const applyStatus = useCallback((next: WorkflowTakeoverStatus) => {
    setStatus(next);
    if (!next.active && wasActiveRef.current) {
      // 接管刚结束：画布刷新为最新保存数据
      onSavedRef.current?.();
    }
    wasActiveRef.current = next.active;
  }, []);

  // ---- 初始状态：GET /api/workflows/:id/takeover（失败静默，视为未接管） ----
  useEffect(() => {
    if (!workflowId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithAuth(`/api/workflows/${workflowId}/takeover`);
        if (!res.ok) return; // 404/5xx：后端未实现或暂无记录
        const data = (await res.json()) as Partial<TakeoverEvent>;
        if (cancelled) return;
        applyStatus({
          active: !!data.active,
          message: data.message,
          updatedAt: data.updatedAt ?? Date.now(),
        });
      } catch {
        // 网络异常：静默，等待 WS 事件纠正
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workflowId, applyStatus]);

  // ---- WS 实时订阅（workspace 未解析前不订阅，与 use-workflow-editor-execution 同模式） ----
  const getWorkflowWS = useCallback(
    () => (workspaceId ? getWS(workspaceId) : null),
    [workspaceId],
  );

  useEffect(() => {
    const ws = getWorkflowWS();
    if (!ws || !workflowId) return;

    const offTakeover = ws.on('workflow:takeover', (data) => {
      const event = data as Partial<TakeoverEvent> | undefined;
      if (!event || event.workflowId !== workflowId) return;
      applyStatus({
        active: !!event.active,
        message: event.message,
        updatedAt: event.updatedAt ?? Date.now(),
      });
    });
    const offSaved = ws.on('workflow:saved', (data) => {
      const event = data as Partial<SavedEvent> | undefined;
      if (!event || event.workflowId !== workflowId) return;
      // Agent（或他人）保存了画布：刷新为最新保存数据
      onSavedRef.current?.();
    });
    return () => {
      offTakeover();
      offSaved();
    };
  }, [getWorkflowWS, workflowId, applyStatus]);

  // ---- 动作：取消接管（POST enabled:false） ----
  const cancelTakeover = useCallback(async (): Promise<boolean> => {
    if (!workflowId || canceling) return false;
    setCanceling(true);
    try {
      const res = await fetchWithAuth(`/api/workflows/${workflowId}/takeover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      });
      if (!res.ok) return false;
      const data = (await res.json().catch(() => null)) as Partial<TakeoverEvent> | null;
      applyStatus({
        active: false,
        message: data?.message,
        updatedAt: data?.updatedAt ?? Date.now(),
      });
      return true;
    } catch {
      return false;
    } finally {
      setCanceling(false);
    }
  }, [workflowId, canceling, applyStatus]);

  // ---- 动作：本地忽略当前这轮（新事件 updatedAt 变化会重新弹出） ----
  const dismiss = useCallback(() => {
    setDismissedAt((prev) => prev ?? status?.updatedAt ?? Date.now());
  }, [status]);

  const visible = !!status?.active && dismissedAt !== status.updatedAt;

  // ---- DEV 联调后门：后端未就绪时可在浏览器控制台手测 UI ----
  // window.dispatchEvent(new CustomEvent('fs:mock-takeover', { detail: { active: true, message: 'Agent 正在修改画布', updatedAt: Date.now() } }))
  // window.dispatchEvent(new CustomEvent('fs:mock-takeover', { detail: { active: false, updatedAt: Date.now() } }))
  // window.dispatchEvent(new CustomEvent('fs:mock-saved', { detail: {} }))
  useEffect(() => {
    if (!import.meta.env.DEV || !workflowId) return;
    const onMockTakeover = (e: Event) => {
      const detail = (e as CustomEvent<Partial<TakeoverEvent>>).detail;
      applyStatus({
        active: !!detail?.active,
        message: detail?.message,
        updatedAt: detail?.updatedAt ?? Date.now(),
      });
    };
    const onMockSaved = () => {
      onSavedRef.current?.();
    };
    window.addEventListener('fs:mock-takeover', onMockTakeover);
    window.addEventListener('fs:mock-saved', onMockSaved);
    return () => {
      window.removeEventListener('fs:mock-takeover', onMockTakeover);
      window.removeEventListener('fs:mock-saved', onMockSaved);
    };
  }, [workflowId, applyStatus]);

  return {
    active: !!status?.active,
    visible,
    message: status?.message ?? null,
    canceling,
    cancelTakeover,
    dismiss,
  };
}
