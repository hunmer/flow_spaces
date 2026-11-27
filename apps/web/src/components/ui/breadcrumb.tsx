import * as React from "react";
import { cx } from "@/utils/cx";

// Mini App 运行时兼容层：存量 Mini App 经 @flow-spaces/ui / window.FlowSpacesUI
// 消费 shadcn/ui Breadcrumb 的旧 API 表面（lib/ui-exports.ts 再导出）。
// 业务代码请改用 @/components/base/breadcrumb；此文件仅为 Mini App 平台契约保留。
/**
 * BoardUI 视觉的 Breadcrumb 复合 API：语义化 nav/ol/li 结构，
 * 无 radix 依赖（旧版导航菜单联动组件不在本仓依赖内）。
 * BreadcrumbSeparator 无子元素时默认渲染 "/"。
 */

function Breadcrumb({
  ...props
}: React.ComponentProps<"nav">): React.JSX.Element {
  return (
    <nav aria-label="breadcrumb" data-slot="breadcrumb" {...props} />
  );
}

function BreadcrumbList({
  className,
  ...props
}: React.ComponentProps<"ol">): React.JSX.Element {
  return (
    <ol
      className={cx(
        "flex flex-wrap items-center gap-1.5 text-body-regular break-words text-text-secondary",
        className,
      )}
      data-slot="breadcrumb-list"
      {...props}
    />
  );
}

function BreadcrumbItem({
  className,
  ...props
}: React.ComponentProps<"li">): React.JSX.Element {
  return (
    <li
      className={cx("inline-flex items-center gap-1.5", className)}
      data-slot="breadcrumb-item"
      {...props}
    />
  );
}

function BreadcrumbLink({
  className,
  href,
  ...props
}: React.ComponentProps<"a">): React.JSX.Element {
  return (
    <a
      className={cx(
        "transition-colors",
        href != null && "cursor-pointer hover:text-text-primary hover:underline",
        className,
      )}
      data-slot="breadcrumb-link"
      href={href}
      {...props}
    />
  );
}

function BreadcrumbPage({
  className,
  ...props
}: React.ComponentProps<"span">): React.JSX.Element {
  return (
    <span
      aria-current="page"
      className={cx("font-medium text-text-primary", className)}
      data-slot="breadcrumb-page"
      {...props}
    />
  );
}

function BreadcrumbSeparator({
  className,
  children,
  ...props
}: React.ComponentProps<"li">): React.JSX.Element {
  return (
    <li
      role="presentation"
      aria-hidden="true"
      className={cx("[&>svg]:size-3.5", className)}
      data-slot="breadcrumb-separator"
      {...props}
    >
      {children ?? "/"}
    </li>
  );
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
};
