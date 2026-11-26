"use client";

import type * as React from "react";
import { InputBase } from "@/components/base/input/input";
import { cx } from "@/utils/cx";

/**
 * cossui → BoardUI：**BoardUI 后端**（InputBase：AriaGroup 外壳 + AriaInput）。
 *
 * 公共 API 保持原生 <input> 语义不变：onChange 仍收到原生事件
 * （e.target.value）、value/name/type=file/data-test 与 aria 属性直接透传，ref
 * 仍指向 <input> 元素。AriaInput 不在 TextField 上下文中时按原生
 * input 透传 props，不做 react-aria 的 onChange(value) 转换，因此
 * 零改动兼容所有既有消费方。
 *
 * 分支：
 *  - 默认走 InputBase（BoardUI 外壳 + 语义 token，尺寸 sm→small，
 *    其余→medium）；消费方 className 进 fieldClassName（tailwind-merge
 *    后写覆盖，input-group 的"去外壳"类仍然生效）。
 *  - nativeInput / unstyled（或需要原生 size 属性的数字 size）走
 *    原生 <input> 分支，保留原 span 结构与类。
 */
export type InputProps = Omit<
  React.ComponentPropsWithoutRef<"input">,
  "size"
> &
  React.RefAttributes<HTMLInputElement> & {
    size?: "sm" | "default" | "lg" | number;
    unstyled?: boolean;
    nativeInput?: boolean;
  };

const NATIVE_INPUT_CLASS = cx(
  "h-9 w-full min-w-0 rounded-[inherit] px-[calc(--spacing(3)-1px)] text-text-primary text-body-regular outline-none [transition:background-color_5000000s_ease-in-out_0s] placeholder:text-text-tertiary focus:placeholder:text-text-primary disabled:cursor-not-allowed disabled:text-input-disabled-text disabled:placeholder:text-input-disabled-text sm:h-9 autofill:[-webkit-text-fill-color:var(--foreground)]",
  "h-8 px-[calc(--spacing(2.5)-1px)] sm:h-8",
);

export function Input({
  className,
  size = "default",
  unstyled = false,
  nativeInput = false,
  style,
  ...props
}: InputProps): React.ReactElement {
  // 原生分支：裸 input（无 BoardUI 外壳），保留原 cossui DOM 结构。
  if (nativeInput || unstyled || typeof size === "number") {
    return (
      <span
        className={
          cx(!unstyled && "relative inline-flex w-full rounded-2lg bg-background-tertiary-default ring-2 ring-inset ring-transparent transition-[background-color,box-shadow,color] duration-150 ease hover:ring-border-button-hover has-focus-visible:ring-border-button-active has-disabled:bg-input-disabled-background has-disabled:text-input-disabled-foreground has-aria-invalid:bg-background-tertiary-error has-aria-invalid:ring-0", className) ||
          undefined
        }
        data-size={size}
        data-slot="input-control"
      >
        <input
          className={cx(
            NATIVE_INPUT_CLASS,
            props.type === "search" &&
              "[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none",
            props.type === "file" &&
              "text-text-tertiary file:me-3 file:bg-transparent file:font-medium file:text-text-primary file:text-sm",
            className,
          )}
          data-slot="input"
          size={typeof size === "number" ? size : undefined}
          style={typeof style === "function" ? undefined : style}
          {...props}
        />
      </span>
    );
  }

  // BoardUI 分支：AriaGroup 外壳 + AriaInput（原生 props 透传）。
  return (
    <InputBase
      {...(props as unknown as React.ComponentProps<typeof InputBase>)}
      size={size === "sm" ? "small" : "medium"}
      fieldClassName={cx("w-full", className)}
      className={cx(
        "w-full",
        props.type === "search" &&
          "[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none",
        props.type === "file" &&
          "text-text-tertiary file:me-3 file:bg-transparent file:font-medium file:text-text-primary file:text-sm",
      )}
    />
  );
}
