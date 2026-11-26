/**
 * SPA 补充页面（非业务组件，属 Vite 适配层）：
 *   NotFoundPage             —— Next 无显式 404 页，SPA 需要一个通配渲染。
 *   MiniAppPreviewEmptyState —— /mini-apps-preview 无 id 时的空态兜底
 *                               （业务组件会以空串调 sdk.miniApp.get('') 渲染
 *                                原始 404 报错，这里在路由层提前拦截）。
 * 原登录页（app/login/page.tsx）已原样复制接入 router，占位 LoginPage 已移除。
 */
import { Link } from "react-router-dom";
import { useTranslations } from "next-intl";

export function NotFoundPage() {
  const t = useTranslations("common");
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-lg font-semibold">404</h1>
      <p className="text-sm text-muted-foreground">{t("pageNotFound")}</p>
      <Link
        to="/workflows"
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
      >
        {t("backToWorkflows")}
      </Link>
    </div>
  );
}

export function MiniAppPreviewEmptyState() {
  const t = useTranslations("common");
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-lg font-semibold">{t("miniAppPreviewTitle")}</h1>
      <p className="text-sm text-muted-foreground">
        {t("miniAppMissingIdPrefix")}
        <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">{t("miniAppMissingIdCode")}</code>
        {t("miniAppMissingIdSuffix")}
      </p>
      <Link
        to="/mini-apps"
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
      >
        {t("backToMiniApps")}
      </Link>
    </div>
  );
}
