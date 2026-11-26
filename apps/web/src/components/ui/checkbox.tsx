"use client";

import type React from "react";
import { Checkbox as BoardCheckbox } from "@/components/base/checkbox/checkbox";
import type { CheckboxProps as BoardCheckboxProps } from "@/components/base/checkbox/checkbox";

/**
 * cossui → BoardUI 迁移适配层。
 *
 * 对外保持 Base UI Checkbox 的 API（checked / defaultChecked /
 * onCheckedChange(checked, event) / indeterminate），内部映射到
 * BoardUI Checkbox（react-aria-components）：
 *
 *   checked        → isSelected
 *   defaultChecked → defaultSelected
 *   indeterminate  → isIndeterminate
 *   onCheckedChange(checked, event) → onChange(isSelected)
 */

export interface CheckboxProps
  extends Omit<BoardCheckboxProps, "isSelected" | "defaultSelected" | "isIndeterminate" | "onChange" | "className"> {
  checked?: boolean;
  defaultChecked?: boolean;
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean, event?: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}

export function Checkbox({
  checked,
  defaultChecked,
  indeterminate,
  onCheckedChange,
  ...props
}: CheckboxProps): React.ReactElement {
  return (
    <BoardCheckbox
      isSelected={checked}
      defaultSelected={defaultChecked}
      isIndeterminate={indeterminate || undefined}
      onChange={(isSelected) => onCheckedChange?.(isSelected)}
      {...props}
    />
  );
}
