"use client";

/**
 * 首页「调用量」统计 hook：拉取已落盘的工作流执行日志，
 * 聚合成三个维度的调用次数序列：
 * - hourly  滚动 24 小时，每小时一个点；
 * - weekly  本周（周一起）每天一个点；
 * - monthly 本年每月一个点。
 *
 * 数据来源：sdk.workflow.listAllExecutionLogs(limit)
 * （GET /api/workflows/execution-logs/all，按 startedAt 聚合）。
 * 桶结构固定（24 / 7 / 12 个点，计数可为 0）；加载完成前返回 null。
 */

import { useEffect, useState } from "react";

import { sdk } from "@/lib/sdk";

/** 尽量拉全量历史：按天/月聚合需要完整记录，多拉无害。 */
const LIST_LIMIT = 2000;

export type UsagePoint = {
  /** X 轴短标签（如 "14:00" / "Wed" / "Mar"）。 */
  label: string;
  /** 该时段的调用次数。 */
  value: number;
};

export type InvocationStats = {
  /** 滚动 24 小时，每小时一个点。 */
  hourly: UsagePoint[];
  /** 本周（周一起）每天一个点。 */
  weekly: UsagePoint[];
  /** 本年每月一个点。 */
  monthly: UsagePoint[];
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatHourLabel(hourStart: number) {
  const d = new Date(hourStart);
  return `${String(d.getHours()).padStart(2, "0")}:00`;
}

/** 把执行日志按 startedAt 分桶到固定的三个序列。 */
function aggregate(logs: { startedAt: number }[], now = Date.now()): InvocationStats {
  // 滚动 24 小时桶：从当前整点往回数 23 个小时。
  const currentHour = Math.floor(now / HOUR_MS) * HOUR_MS;
  const hourStarts: number[] = [];
  for (let i = 23; i >= 0; i--) hourStarts.push(currentHour - i * HOUR_MS);
  const hourly = hourStarts.map((start) => ({ label: formatHourLabel(start), value: 0 }));
  const hourIndex = new Map<number, number>();
  hourStarts.forEach((start, i) => hourIndex.set(start, i));

  // 本周桶：周一 00:00 起 7 天。
  const nowDate = new Date(now);
  const dow = (nowDate.getDay() + 6) % 7; // 周一 = 0
  const weekStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() - dow).getTime();
  const weekly = DAY_NAMES.map((label) => ({ label, value: 0 }));

  // 本年桶：1-12 月。
  const monthly = MONTH_NAMES.map((label) => ({ label, value: 0 }));

  for (const log of logs) {
    if (typeof log?.startedAt !== "number") continue;
    const t = log.startedAt;

    const hi = hourIndex.get(Math.floor(t / HOUR_MS) * HOUR_MS);
    if (hi !== undefined) hourly[hi].value += 1;

    const dayOffset = Math.floor((t - weekStart) / DAY_MS);
    if (dayOffset >= 0 && dayOffset < 7) weekly[dayOffset].value += 1;

    const logDate = new Date(t);
    if (logDate.getFullYear() === nowDate.getFullYear()) monthly[logDate.getMonth()].value += 1;
  }

  return { hourly, weekly, monthly };
}

export function useInvocationStats() {
  const [stats, setStats] = useState<InvocationStats | null>(null);

  useEffect(() => {
    let alive = true;
    sdk.workflow
      .listAllExecutionLogs(LIST_LIMIT)
      .then((logs) => alive && setStats(aggregate(logs)))
      .catch(() => alive && setStats(aggregate([])));
    return () => {
      alive = false;
    };
  }, []);

  return stats;
}
