import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import * as React from "react";
import { cx } from "@/utils/cx";
import { buttonVariants } from "@/components/ui/button";

// Mini App 运行时兼容层：存量 Mini App 经 @flow-spaces/ui / window.FlowSpacesUI
// 消费 shadcn/ui Pagination 的旧 API 表面（lib/ui-exports.ts 再导出）。
// 业务代码请改用 @/components/base/pagination；此文件仅为 Mini App 平台契约保留。
/**
 * BoardUI 视觉的 Pagination 复合 API：nav > ul > li 语义结构，
 * PaginationLink/Previous/Next 复用本仓 buttonVariants 样式串
 * （激活页 = secondary 表面，与 base/pagination 的设计说明一致）。
 * PaginationPrevious/Next 为图标按钮（无文案，语言中立）。
 */

function Pagination({
  className,
  ...props
}: React.ComponentProps<"nav">): React.JSX.Element {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      className={cx("mx-auto flex w-full justify-center", className)}
      data-slot="pagination"
      {...props}
    />
  );
}

function PaginationContent({
  className,
  ...props
}: React.ComponentProps<"ul">): React.JSX.Element {
  return (
    <ul
      className={cx("flex flex-row items-center gap-1", className)}
      data-slot="pagination-content"
      {...props}
    />
  );
}

function PaginationItem({
  className,
  ...props
}: React.ComponentProps<"li">): React.JSX.Element {
  return (
    <li
      className={cx("", className)}
      data-slot="pagination-item"
      {...props}
    />
  );
}

function PaginationLink({
  className,
  isActive = false,
  size = "icon-sm",
  ...props
}: React.ComponentProps<"a"> & {
  /** 旧 shadcn API：当前页（secondary 表面）。 */
  isActive?: boolean;
  size?: "default" | "sm" | "icon-sm";
}): React.JSX.Element {
  return (
    <a
      aria-current={isActive ? "page" : undefined}
      className={cx(
        buttonVariants({ variant: isActive ? "secondary" : "ghost", size }),
        className,
      )}
      data-slot="pagination-link"
      data-active={isActive}
      {...props}
    />
  );
}

function PaginationPrevious({
  className,
  ...props
}: React.ComponentProps<"a">): React.JSX.Element {
  return (
    <PaginationLink
      aria-label="Go to previous page"
      size="icon-sm"
      className={cx("gap-1", className)}
      data-slot="pagination-previous"
      {...props}
    >
      <ChevronLeftIcon />
    </PaginationLink>
  );
}

function PaginationNext({
  className,
  ...props
}: React.ComponentProps<"a">): React.JSX.Element {
  return (
    <PaginationLink
      aria-label="Go to next page"
      size="icon-sm"
      className={cx("gap-1", className)}
      data-slot="pagination-next"
      {...props}
    >
      <ChevronRightIcon />
    </PaginationLink>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
};
