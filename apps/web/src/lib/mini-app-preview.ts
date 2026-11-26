/**
 * Mini App 预览页地址。
 * 默认走当前站点 origin；需要独立预览服务时用 VITE_MINI_APP_PREVIEW_BASE 覆盖
 * （例如 VITE_MINI_APP_PREVIEW_BASE=http://localhost:5175）。
 */
export function getMiniAppPreviewBase(): string {
  const base = import.meta.env.VITE_MINI_APP_PREVIEW_BASE as string | undefined;
  return (base && base.replace(/\/+$/, '')) || window.location.origin;
}

export function miniAppPreviewUrl(id: string): string {
  return `${getMiniAppPreviewBase()}/mini-apps-preview?id=${encodeURIComponent(id)}`;
}
