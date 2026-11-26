"use client";

import type React from "react";
import { Switch as BoardSwitch } from "@/components/base/switch/switch";
import type { SwitchProps as BoardSwitchProps } from "@/components/base/switch/switch";

/**
 * cossui → BoardUI 迁移适配层。
 *
 * 对外保持 Base UI Switch 的 API（checked / defaultChecked /
 * onCheckedChange(checked, event) / size: "sm" | "default"），
 * 内部映射到 BoardUI Switch（react-aria-components）：
 *
 *   checked        → isSelected
 *   defaultChecked → defaultSelected
 *   onCheckedChange(checked) → onChange(isSelected)
 *   size default → md, sm → sm
 */

export interface SwitchProps
  extends Omit<BoardSwitchProps, "isSelected" | "defaultSelected" | "onChange" | "size" | "className"> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean, event?: React.ChangeEvent<HTMLInputElement>) => void;
  size?: "sm" | "default";
  className?: string;
}

export function Switch({
  checked,
  defaultChecked,
  onCheckedChange,
  size = "default",
  ...props
}: SwitchProps): React.ReactElement {
  return (
    <BoardSwitch
      isSelected={checked}
      defaultSelected={defaultChecked}
      size={size === "sm" ? "sm" : "md"}
      onChange={(isSelected) => onCheckedChange?.(isSelected)}
      {...props}
    />
  );
}
