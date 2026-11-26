"use client";

import { mergeProps, useRender } from "@/components/ui/use-render";
import type React from "react";
import { cx } from "@/utils/cx";

/**
 * cossui → BoardUI：**token 重样式**。
 * 保持 Base UI useRender 结构（消费方会传 render），样式切到
 * BoardUI 排版 token（与 base/input/label.tsx 一致：text-body-medium）。
 */
export function Label({
  className,
  render,
  ...props
}: useRender.ComponentProps<"label">): React.ReactElement {
  const defaultProps = {
    className: cx(
      "inline-flex items-center gap-0.5 text-body-medium text-text-primary",
      className,
    ),
    "data-slot": "label",
  };

  return useRender({
    defaultTagName: "label",
    props: mergeProps<"label">(defaultProps, props),
    render,
  });
}
