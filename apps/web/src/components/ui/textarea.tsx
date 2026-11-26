"use client";

import type * as React from "react";
import { TextareaBase } from "@/components/base/textarea/textarea";
import { cx } from "@/utils/cx";

/**
 * cossui → BoardUI：**BoardUI 后端**（TextareaBase：AriaGroup 外壳 + AriaTextArea）。
 *
 * 公共 API 保持原生 <textarea> 语义不变：onChange 仍收到原生事件
 * （e.target.value），value/rows/name/data-test 与 aria 属性直接透传，ref 仍指
 * 向 <textarea> 元素。AriaTextArea 不在 TextField 上下文中时按原生
 * textarea 透传 props，不做 react-aria 的 onChange(value) 转换。
 *
 * 消费方 className 进 fieldClassName（tailwind-merge 后写覆盖，
 * input-group 的"去外壳"类仍然生效）；unstyled 走原生分支保留原结构。
 */
export type TextareaProps = Omit<
  React.ComponentPropsWithoutRef<"textarea">,
  "size"
> &
  React.RefAttributes<HTMLTextAreaElement> & {
    size?: "sm" | "default" | "lg" | number;
    unstyled?: boolean;
  };

export function Textarea({
  className,
  size = "default",
  unstyled = false,
  style,
  rows,
  ...props
}: TextareaProps): React.ReactElement {
  if (unstyled || typeof size === "number") {
    return (
      <span
        className={
          cx(
            "relative inline-flex w-full rounded-2lg bg-background-tertiary-default ring-2 ring-inset ring-transparent transition-[background-color,box-shadow,color] duration-150 ease hover:ring-border-button-hover has-focus-visible:ring-border-button-active has-disabled:bg-input-disabled-background has-disabled:text-input-disabled-foreground has-aria-invalid:bg-background-tertiary-error has-aria-invalid:ring-0",
            className,
          ) || undefined
        }
        data-size={size}
        data-slot="textarea-control"
      >
        <textarea
          className={cx(
            "field-sizing-content min-h-18 w-full rounded-[inherit] px-[calc(--spacing(3)-1px)] py-[calc(--spacing(1.5)-1px)] text-text-primary text-body-regular outline-none placeholder:text-text-tertiary disabled:cursor-not-allowed max-sm:min-h-20.5",
            className,
          )}
          data-slot="textarea"
          rows={typeof rows === "number" ? rows : undefined}
          style={typeof style === "function" ? undefined : style}
          {...props}
        />
      </span>
    );
  }

  // BoardUI 分支：AriaGroup 外壳 + AriaTextArea（原生 props 透传）。
  return (
    <TextareaBase
      {...(props as unknown as React.ComponentProps<typeof TextareaBase>)}
      rows={typeof rows === "number" ? rows : 3}
      size={size === "sm" ? "small" : "medium"}
      fieldClassName={cx("w-full", className)}
      className="w-full"
    />
  );
}
