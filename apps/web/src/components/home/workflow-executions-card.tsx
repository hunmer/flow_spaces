"use client";

/**
 * 首页「工作流执行记录」面板（从 marketing-home.tsx 的需求拆出）。
 *
 * 数据来源：sdk.workflow.listAllExecutionLogs(limit)（GET /api/workflows/execution-logs/all，
 * 已结束并落盘的执行日志；正在运行的会话由 WorkflowsTable 的 active 轮询展示）。
 * 文案：locales/{en,zh}/home.json 的 workflowExecutions 命名空间。
 */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslations } from "next-intl";
import { RiFlowChart, RiRefreshLine } from "@remixicon/react";

import { sdk } from "@/lib/sdk";
import type { ExecutionLog } from "@flow-spaces/shared";

/** 首次加载条数（手动刷新时也按此拉取）。 */
const LIST_LIMIT = 20;

function formatDuration(ms?: number) {
  if (!ms || ms < 0) return null;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

const STATUS_STYLES: Record<string, string> = {
  running: "bg-accent-100 text-accent-700",
  completed: "bg-background-secondary-default text-text-secondary",
  paused: "bg-background-secondary-default text-text-secondary",
  error: "bg-background-secondary-default text-text-error-primary",
};

export function WorkflowExecutionsCard() {
  const t = useTranslations("home.workflowExecutions");
  const [logs, setLogs] = useState<(ExecutionLog & { workflowName?: string })[] | null>(null);

  const refresh = useCallback(() => {
    sdk.workflow
      .listAllExecutionLogs(LIST_LIMIT)
      .then(setLogs)
      .catch(() => setLogs((prev) => prev ?? []));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const finished = logs ?? [];
  const runningCount = finished.filter((l) => l.status === "running").length;
  const completedCount = finished.filter((l) => l.status === "completed").length;
  const failedCount = finished.filter((l) => l.status === "error").length;
  const doneCount = completedCount + failedCount;

  const stats = [
    { label: t("stats.totalRuns"), value: String(finished.length) },
    { label: t("stats.running"), value: String(runningCount) },
    {
      label: t("stats.successRate"),
      value: doneCount > 0 ? `${Math.round((completedCount / doneCount) * 100)}%` : "—",
    },
    { label: t("stats.failed"), value: String(failedCount) },
  ];

  return (
    <section className="flex w-full flex-col rounded-3xl border border-border-button-default bg-background-primary-default">
      <header className="flex items-center justify-between gap-3 border-b border-separator-border px-5 py-4">
        <h2 className="text-headline-medium text-text-primary">{t("title")}</h2>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-body-regular text-text-secondary outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        >
          <RiRefreshLine className="size-4" aria-hidden="true" />
          {t("refresh")}
        </button>
      </header>

      {/* 统计行 */}
      <div className="grid grid-cols-2 gap-2 border-b border-separator-border px-5 py-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-0.5">
            <span className="text-caption-1-semibold text-text-tertiary">{s.label}</span>
            <span className="text-title-3-semibold text-text-primary">{s.value}</span>
          </div>
        ))}
      </div>

      {/* 记录表 */}
      {logs === null ? (
        <div className="px-5 py-8 text-center text-body-regular text-text-tertiary">…</div>
      ) : finished.length === 0 ? (
        <div className="px-5 py-8 text-center text-body-regular text-text-tertiary">
          {t("empty")}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-body-regular">
            <thead>
              <tr className="border-b border-border-table text-caption-1-semibold text-text-tertiary">
                <th className="px-5 py-2 text-start font-semibold">{t("table.workflow")}</th>
                <th className="px-3 py-2 text-start font-semibold">{t("table.status")}</th>
                <th className="px-3 py-2 text-start font-semibold">{t("table.started")}</th>
                <th className="px-3 py-2 text-start font-semibold">{t("table.duration")}</th>
                <th className="px-5 py-2 text-end font-semibold">{t("table.steps")}</th>
              </tr>
            </thead>
            <tbody>
              {finished.map((log) => (
                <tr key={`${log.workflowId}/${log.id}`} className="border-b border-border-table last:border-b-0">
                  <td className="max-w-64 px-5 py-2.5">
                    <Link
                      to={`/workflows/${log.workflowId}?logId=${log.id}`}
                      className="inline-flex min-w-0 items-center gap-2 hover:text-text-primary hover:underline"
                    >
                      <RiFlowChart className="size-4 shrink-0 text-foreground-icon-secondary" aria-hidden="true" />
                      <span className="truncate text-text-primary">
                        {log.workflowName || log.workflowId}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-caption-1-semibold ${STATUS_STYLES[log.status] ?? STATUS_STYLES.completed}`}
                    >
                      {t(`status.${log.status}` as never)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-text-secondary">
                    {log.startedAt
                      ? new Date(log.startedAt).toLocaleString()
                      : t("timePlaceholder")}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-text-tertiary">
                    {formatDuration(
                      typeof log.finishedAt === "number" && typeof log.startedAt === "number"
                        ? log.finishedAt - log.startedAt
                        : undefined,
                    ) ?? t("timePlaceholder")}
                  </td>
                  <td className="px-5 py-2.5 text-end text-text-tertiary">
                    {Array.isArray(log.steps) ? log.steps.length : 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
