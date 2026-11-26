"use client";

/**
 * 仪表盘首页（O5 改造版）。
 *
 * 布局：不再自带 DashboardSidebar，主体内容嵌在全局 SidebarRail 布局内
 * （router.tsx 中 /home 已恢复为 SidebarRail 子路由）。
 *
 * 数据来源说明（O5 要求注明）：
 * - 真实数据：KPI 卡（工作流总数 / Mini App 总数 / 节点总数 / 近 7 天更新数，
 *   来自 useWorkflowStore + sdk.miniApp.list()）与底部工作流表格
 *   （useWorkflowStore.workflows）。
 * - mock 数据：RevenueChartCard / OrdersChartCard（应用没有收入/订单/运行
 *   统计的数据源，保留 boardui 块自带 mock，待有执行历史 API 后替换）。
 */

import { useEffect, useMemo, useState } from "react";
import {
  RiCoinsFill,
  RiFlowChart,
  RiGroupLine,
  RiLayoutGridLine,
  RiMoreFill,
  RiSettings4Line,
  RiShareBoxLine,
  RiUserLine,
} from "@remixicon/react";

import { StatCards, type Stat } from "@/components/application/dashboard/stat-cards";
import { RevenueChartCard } from "@/components/application/dashboard/revenue-chart-card";
import { OrdersChartCard } from "@/components/application/dashboard/orders-chart-card";
import { Avatar } from "@/components/base/avatar/avatar";
import { Badge } from "@/components/base/badges/badge";
import { SearchField } from "@/components/base/search-field/search-field";
import {
  Dropdown,
  DropdownDivider,
  DropdownGroup,
  DropdownItem,
  DropdownPopover,
  DropdownTrigger,
} from "@/components/base/dropdown/dropdown";
import { WorkflowExecutionsCard } from "@/components/home/workflow-executions-card";
import { useWorkflowStore } from "@/stores/workflow";
import { sdk } from "@/lib/sdk";
import type { MiniAppProject } from "@flow-spaces/sdk";

// BoardUI 令牌与排版（不引 globals.css，避免重复引入 tailwind）
import "@/styles/boardui/theme.css";
import "@/styles/boardui/typography.css";

const DAY_MS = 24 * 60 * 60 * 1000;

function UserMenu() {
  const [open, setOpen] = useState(false);
  return (
    <Dropdown isOpen={open} onOpenChange={setOpen}>
      <DropdownTrigger>
        <button
          type="button"
          className="flex cursor-pointer items-center gap-2 rounded-full p-1 pr-2 transition-colors hover:bg-background-secondary-hover"
          aria-label="Open user menu"
        >
          <Avatar size="sm" color="blue" initials="A" />
          <span className="hidden text-body-medium text-text-primary sm:inline">Admin</span>
        </button>
      </DropdownTrigger>
      <DropdownPopover aria-label="Account">
        <DropdownGroup label="Account">
          <DropdownItem>
            <RiUserLine className="size-4" aria-hidden="true" /> Profile
          </DropdownItem>
          <DropdownItem>
            <RiSettings4Line className="size-4" aria-hidden="true" /> Settings
          </DropdownItem>
          <DropdownDivider />
          <DropdownItem>
            <RiMoreFill className="size-4" aria-hidden="true" /> Sign out
          </DropdownItem>
        </DropdownGroup>
      </DropdownPopover>
    </Dropdown>
  );
}

/** 真实数据：工作流 / Mini App 统计 + 工作流表格行。 */
function useHomeDashboard() {
  const workflows = useWorkflowStore((s) => s.workflows);
  const loadWorkflows = useWorkflowStore((s) => s.loadWorkflows);
  const [miniApps, setMiniApps] = useState<MiniAppProject[] | null>(null);

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

  return { workflows, miniApps, stats };
}

export function MarketingHome() {
  // 真实数据：KPI 统计 + 工作流表格行（单次加载，父子共享）
  const { workflows, stats } = useHomeDashboard();

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
        {/* 顶栏：标题 + 搜索 + 徽标 + 用户菜单 */}
        <header className="flex w-full flex-wrap items-center justify-between gap-3 px-1 pt-3">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="text-title-2-medium whitespace-nowrap text-text-primary">
              Dashboard
            </h1>
            <Badge color="primary">Live</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <SearchField placeholder="Search anything…" aria-label="Search" />
            <UserMenu />
          </div>
        </header>

        {/* KPI 卡行 —— 真实数据（useWorkflowStore + sdk.miniApp.list） */}
        <StatCards variant="footer" stats={kpiStats} />

        {/* 双图卡 —— mock：无收入/订单/执行统计数据源，保留 boardui 自带 mock */}
        <div className="grid w-full gap-4 xl:grid-cols-2">
          <RevenueChartCard />
          <OrdersChartCard />
        </div>

        {/* 工作流执行记录 —— 真实数据（sdk.workflow.listAllExecutions，已结束并落盘的执行） */}
        <WorkflowExecutionsCard />

        <div className="h-2" />
      </div>
    </main>
  );
}
