"use client";

/**
 * 仪表盘首页（O5 改造版）。
 *
 * 布局：不再自带 DashboardSidebar，主体内容嵌在全局 SidebarRail 布局内
 * （router.tsx 中 /home 已恢复为 SidebarRail 子路由）。
 *
 * 数据来源说明（O5 要求注明）：
 * - 真实数据：KPI 卡（工作流总数 / Mini App 总数 / 节点总数 / 近 7 天更新数，
 *   来自 useWorkflowStore + sdk.miniApp.list()）、调用量双图卡
 *   （useInvocationStats ← sdk.workflow.listAllExecutionLogs 聚合出
 *   24 小时 / 本周每天 / 本年每月的调用次数）与底部工作流表格
 *   （useWorkflowStore.workflows）。
 */

import { useEffect, useMemo, useState } from "react";
import {
  RiFlowChart,
  RiGroupLine,
  RiLayoutGridLine,
  RiShareBoxLine,
} from "@remixicon/react";

import { StatCards, type Stat } from "@/components/application/dashboard/stat-cards";
import { UsageTrendChartCard } from "@/components/application/dashboard/usage-trend-chart-card";
import { UsagePeriodChartCard } from "@/components/application/dashboard/usage-period-chart-card";
import { Badge } from "@/components/base/badges/badge";
import { WorkflowExecutionsCard } from "@/components/home/workflow-executions-card";
import { useWorkflowStore } from "@/stores/workflow";
import { useInvocationStats } from "@/hooks/use-invocation-stats";
import { sdk } from "@/lib/sdk";
import type { MiniAppProject } from "@flow-spaces/sdk";

// BoardUI 令牌与排版（不引 globals.css，避免重复引入 tailwind）
import "@/styles/boardui/theme.css";
import "@/styles/boardui/typography.css";

const DAY_MS = 24 * 60 * 60 * 1000;

/** 真实数据：工作流 / Mini App 统计 + 调用量序列 + 工作流表格行。 */
function useHomeDashboard() {
  const workflows = useWorkflowStore((s) => s.workflows);
  const loadWorkflows = useWorkflowStore((s) => s.loadWorkflows);
  const [miniApps, setMiniApps] = useState<MiniAppProject[] | null>(null);
  const usage = useInvocationStats();

  useEffect(() => {
    loadWorkflows();
    let alive = true;
    sdk.miniApp
      .list()
      .then((list) => alive && setMiniApps(list))
      .catch(() => alive && setMiniApps([]));
    return () => {
      alive = false;
    };
  }, [loadWorkflows]);

  const stats = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * DAY_MS;
    const recentUpdated = workflows.filter((w) => now - w.updatedAt < 7 * DAY_MS).length;
    const recentCreated = workflows.filter((w) => w.createdAt > weekAgo).length;
    const nodeCount = workflows.reduce((sum, w) => sum + w.nodes.length, 0);
    return {
      workflowCount: workflows.length,
      miniAppCount: miniApps?.length ?? 0,
      nodeCount,
      recentUpdated,
      recentCreated,
    };
  }, [workflows, miniApps]);

  return { workflows, miniApps, stats, usage };
}

export function MarketingHome() {
  // 真实数据：KPI 统计 + 调用量序列 + 工作流表格行（单次加载，父子共享）
  const { workflows, stats, usage } = useHomeDashboard();

  const deltaColor: Stat["deltaColor"] = stats.recentCreated > 0 ? "lime" : "neutral";
  const kpiStats: Stat[] = [
    {
      icon: RiFlowChart,
      label: "Workflows",
      value: String(stats.workflowCount),
      delta: `+${stats.recentCreated}`,
      deltaColor,
      caption: "New this week",
    },
    {
      icon: RiLayoutGridLine,
      label: "Mini apps",
      value: String(stats.miniAppCount),
      delta: "—",
      deltaColor: "neutral" as const,
      caption: "Installed projects",
    },
    {
      icon: RiShareBoxLine,
      label: "Workflow nodes",
      value: String(stats.nodeCount),
      delta: "—",
      deltaColor: "neutral" as const,
      caption: "Total nodes in all workflows",
    },
    {
      icon: RiGroupLine,
      label: "Updated (7d)",
      value: String(stats.recentUpdated),
      delta: "—",
      deltaColor: "neutral" as const,
      caption: "Workflows touched this week",
    },
  ];

  return (
    <main className="relative flex h-full min-w-0 justify-center overflow-x-hidden overflow-y-auto bg-background-full">
      <div className="flex w-full max-w-[1300px] flex-col gap-4 px-4 py-4 sm:px-6">
        {/* 顶栏：标题 + 徽标（用户菜单在全局 SidebarRail 内） */}
        <header className="flex w-full flex-wrap items-center justify-between gap-3 px-1 pt-3">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="text-title-2-medium whitespace-nowrap text-text-primary">
              Dashboard
            </h1>
            <Badge color="primary">Live</Badge>
          </div>
        </header>

        {/* KPI 卡行 —— 真实数据（useWorkflowStore + sdk.miniApp.list） */}
        <StatCards variant="footer" stats={kpiStats} />

        {/* 双图卡 —— 真实数据（useInvocationStats ← 执行日志聚合：24 小时趋势 + 周/月切换） */}
        <div className="grid w-full gap-4 xl:grid-cols-2">
          <UsageTrendChartCard data={usage?.hourly ?? []} />
          <UsagePeriodChartCard weekly={usage?.weekly ?? []} monthly={usage?.monthly ?? []} />
        </div>

        {/* 工作流执行记录 —— 真实数据（sdk.workflow.listAllExecutions，已结束并落盘的执行） */}
        <WorkflowExecutionsCard />

        <div className="h-2" />
      </div>
    </main>
  );
}
