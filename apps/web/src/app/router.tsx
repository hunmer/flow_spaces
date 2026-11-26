/**
 * Vite/SPA 路由表（复刻 Next.js App Router 中被排除的 7 个 page.tsx 壳）。
 *
 * Next 壳 → SPA 路由的对应关系（见 MIGRATION-NOTES.md）：
 *   app/page.tsx                    → "/" 重定向到 /workflows（新项目无工作台首页）
 *   app/workflows/page.tsx          → <WorkflowsPage />
 *   app/workflows/share/page.tsx    → 该文件是完整业务页（非壳），已原样复制到 app/workflows/share/page.tsx
 *   app/workflows/[id]/page.tsx     → <WorkflowEditorPageClient />
 *   app/mini-apps/page.tsx          → <MiniAppPage />
 *   app/mini-apps/[id]/page.tsx     → <MiniAppEditorPageClient />
 *   app/mini-apps-preview/page.tsx  → <MiniAppPreviewPageClient />（query: ?id=xxx）
 *   app/mini-apps-preview/[id]/page.tsx → 同上（path 参数版本）
 *   app/login/page.tsx              → 密码登录单页（同心圆环背景 + 居中卡片，仅密码渠道）
 */
import { Navigate, Route, Routes, useParams, useSearchParams } from "react-router-dom";
import { WorkflowsPage } from "@/components/workflows/workflows-page";
import { MiniAppPage } from "@/components/mini-apps/mini-apps-page";
import WorkflowEditorPageClient from "@/app/workflows/[id]/workflow-editor-page-client";
import MiniAppEditorPageClient from "@/app/mini-apps/[id]/mini-app-editor-page-client";
import MiniAppPreviewPageClient from "@/app/mini-apps-preview/[id]/preview-page-client";
import WorkflowSharePage from "@/app/workflows/share/page";
import LoginPage from "@/app/login/page";
import { NotFoundPage, MiniAppPreviewEmptyState } from "@/app/placeholders";
import { SidebarRail } from "@/components/sidebar-rail/SidebarRail";
import { HomePage } from "@/components/home/home-page";
import { MarketingHome } from "@/components/home/marketing-home";

/**
 * /mini-apps-preview 的空态兜底：query (?id=) 与 path (:id) 都没有项目 id 时，
 * 业务组件会以空串调用 sdk.miniApp.get('') 并渲染原始 404 报错文案。
 * 这里在进入业务组件前拦截，渲染友好空态（适配层增强，业务文件零改动）。
 */
function MiniAppPreviewRoute() {
  const [searchParams] = useSearchParams();
  const params = useParams();
  const projectId = searchParams.get("id") || params.id || "";
  if (!projectId) return <MiniAppPreviewEmptyState />;
  return <MiniAppPreviewPageClient />;
}

export function AppRoutes() {
  return (
    <Routes>
      {/* 默认落地 /home（uiarc metrics-dashboard 占位首页） */}
      <Route path="/" element={<Navigate to="/home" replace />} />
      {/* 全局侧边栏布局：首页/列表页与 404 进侧边栏壳；
          编辑器/share/preview/login 为全屏页，不套侧边栏 */}
      <Route element={<SidebarRail />}>
      {/* /home：boardui 仪表盘首页主体（O5：嵌全局 SidebarRail 布局，不再自带 shell） */}
      <Route path="/home" element={<MarketingHome />} />
        <Route path="/workflows" element={<WorkflowsPage />} />
        <Route path="/mini-apps" element={<MiniAppPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="/workflows/share" element={<WorkflowSharePage />} />
      <Route path="/workflows/:id" element={<WorkflowEditorPageClient />} />
      <Route path="/mini-apps/:id" element={<MiniAppEditorPageClient />} />
      <Route path="/mini-apps-preview" element={<MiniAppPreviewRoute />} />
      <Route path="/mini-apps-preview/:id" element={<MiniAppPreviewRoute />} />
      {/* 原登录页已接入（server 免鉴权时不影响；直链 401/登出场景可用） */}
      <Route path="/login" element={<LoginPage />} />
    </Routes>
  );
}
