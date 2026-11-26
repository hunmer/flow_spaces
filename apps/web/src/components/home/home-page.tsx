/**
 * /home 默认页 — 工作流统计仪表盘。
 *
 * 数据来自 GET /api/workflows/metrics/summary（真实执行日志聚合）：
 * 每日运行次数/成功率、内存/CPU 采样、Top 工作流与 Top 插件。
 * 层级保持：router → HomePage(滚动壳) → MetricsDashboard(卡片)。
 */
import { MetricsDashboard } from "@/components/metrics-dashboard/MetricsDashboard";

export function HomePage() {
  return (
    <main className="h-full overflow-y-auto p-6">
      <MetricsDashboard />
    </main>
  );
}

export default HomePage;
