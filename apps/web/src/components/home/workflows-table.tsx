"use client";

/**
 * 首页工作流列表（从 marketing-home.tsx 拆出）。
 *
 * 数据来源：
 * - 表格行：useWorkflowStore.workflows（由父组件传入，父级 KPI 也复用）。
 * - 运行中状态：sdk.workflow.listActiveExecutions() 轮询（4s）内存态活跃会话，
 *   展示"正在运行/暂停中"的工作流，而非只有已结束的执行记录
 *   （执行日志要等执行结束才落盘，正在跑的只能走 active-executions）。
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RiFlowChart } from "@remixicon/react";

import { cx } from "@/utils/cx";
import { sdk } from "@/lib/sdk";
import type { ActiveWorkflowExecution, WorkflowTemplate } from "@flow-spaces/shared";

/** 轮询活跃执行的间隔（ms）。 */
const ACTIVE_POLL_INTERVAL_MS = 4000;

function formatTime(epochMs?: number) {
  if (!epochMs) return "—";
  return new Date(epochMs).toLocaleString();
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/** 运行中/暂停中的状态胶囊。 */
function ExecutionStatusPill({ status }: { status: ActiveWorkflowExecution["status"] }) {
  if (status === "paused") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-background-secondary-default px-2 py-0.5 text-caption-1-semibold text-text-secondary">
        <span className="size-1.5 rounded-full bg-foreground-icon-quaternary" aria-hidden="true" />
        Paused
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-100 px-2 py-0.5 text-caption-1-semibold text-accent-700">
      <span className="size-1.5 animate-pulse rounded-full bg-accent-600" aria-hidden="true" />
      Running
    </span>
  );
}

/** 正在运行的执行列表（含不在表格 Top N 内的工作流）。 */
function RunningNowList({ active, now }: { active: ActiveWorkflowExecution[]; now: number }) {
  if (active.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 border-t border-border-table px-5 py-3">
      <p className="text-caption-1-semibold text-text-secondary">
        Running now · {active.length}
      </p>
      <ul className="flex flex-col gap-2">
        {active.map((execution) => (
          <li
            key={execution.executionId}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-regular"
          >
            <ExecutionStatusPill status={execution.status} />
            <Link
              to={`/workflows/${execution.workflowId}?logId=${execution.executionId}`}
              className="inline-flex min-w-0 items-center gap-2 hover:text-text-primary hover:underline"
            >
              <RiFlowChart className="size-4 shrink-0 text-foreground-icon-secondary" aria-hidden="true" />
              <span className="truncate text-text-primary">{execution.workflowName}</span>
            </Link>
            {execution.currentNodeLabel && (
              <span className="truncate text-text-tertiary">at {execution.currentNodeLabel}</span>
            )}
            <span className="ms-auto whitespace-nowrap text-text-tertiary">
              {formatDuration(now - execution.startedAt)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface WorkflowsTableProps {
  workflows: WorkflowTemplate[];
}

/** 真实数据：工作流表格（替代原 mock DataTableExample）+ 当前正在运行的执行。 */
export function WorkflowsTable({ workflows }: WorkflowsTableProps) {
  const [active, setActive] = useState<ActiveWorkflowExecution[] | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // 轮询活跃执行：立即拉一次 + 定时刷新；仅有活跃执行时才每秒跳动计时。
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      sdk.workflow
        .listActiveExecutions()
        .then((list) => alive && setActive(list))
        .catch(() => alive && setActive([]));
    };
    refresh();
    const poll = setInterval(refresh, ACTIVE_POLL_INTERVAL_MS);
    return () => {
      alive = false;
      clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    if (!active || active.length === 0) return;
    const ticker = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(ticker);
  }, [active]);

  // workflowId → 活跃状态（running 优先于 paused；同一工作流可能并发多次执行）
  const activeStatusByWorkflow = useMemo(() => {
    const map = new Map<string, ActiveWorkflowExecution["status"]>();
    for (const execution of active ?? []) {
      if (execution.status === 'running' || !map.has(execution.workflowId)) {
        map.set(execution.workflowId, execution.status);
      }
    }
    return map;
  }, [active]);

  const rows = useMemo(() => {
    const sorted = [...workflows].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    // 正在运行/暂停的置顶，其余按更新时间倒序，保证活跃工作流不被 Top N 截掉。
    return sorted.sort((a, b) => {
      const sa = activeStatusByWorkflow.has(a.id) ? 1 : 0;
      const sb = activeStatusByWorkflow.has(b.id) ? 1 : 0;
      return sb - sa;
    });
  }, [workflows, activeStatusByWorkflow]);

  return (
    <section className="w-full overflow-hidden rounded-3xl border border-border-button-default bg-background-full">
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="text-title-3-semibold text-text-primary">Workflows</h2>
        <Link
          to="/workflows"
          className="text-body-medium text-text-secondary underline-offset-3 hover:text-text-primary hover:underline"
        >
          View all
        </Link>
      </div>
      <RunningNowList active={active ?? []} now={now} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-start">
          <thead>
            <tr className="border-t border-border-table text-caption-1-semibold text-text-secondary">
              <th className="px-5 py-2.5 text-start">Name</th>
              <th className="px-5 py-2.5 text-start">Status</th>
              <th className="px-5 py-2.5 text-start">Nodes</th>
              <th className="px-5 py-2.5 text-start">Edges</th>
              <th className="px-5 py-2.5 text-start">Plugins</th>
              <th className="px-5 py-2.5 text-start">Last run</th>
              <th className="px-5 py-2.5 text-start">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-body-regular text-text-secondary">
                  No workflows yet — create one from the Workflows page.
                </td>
              </tr>
            )}
            {rows.slice(0, 10).map((w) => {
              const status = activeStatusByWorkflow.get(w.id);
              return (
                <tr
                  key={w.id}
                  className={cx(
                    "border-t border-border-table text-body-regular text-text-primary transition-colors hover:bg-background-secondary-hover",
                    status && "bg-accent-50",
                  )}
                >
                  <td className="px-5 py-2.5">
                    <Link
                      to={`/workflows/${w.id}`}
                      className="inline-flex items-center gap-2 hover:text-text-primary hover:underline"
                    >
                      <RiFlowChart className="size-4 text-foreground-icon-secondary" aria-hidden="true" />
                      {w.name}
                    </Link>
                  </td>
                  <td className="px-5 py-2.5">
                    {status ? <ExecutionStatusPill status={status} /> : <span className="text-text-tertiary">—</span>}
                  </td>
                  <td className="px-5 py-2.5 text-text-secondary">{w.nodes.length}</td>
                  <td className="px-5 py-2.5 text-text-secondary">{w.edges.length}</td>
                  <td className="px-5 py-2.5 text-text-secondary">{w.enabledPlugins?.length ?? 0}</td>
                  <td className="px-5 py-2.5 text-text-secondary">{formatTime(w.lastRunAt)}</td>
                  <td className="px-5 py-2.5 text-text-secondary">{formatTime(w.updatedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
