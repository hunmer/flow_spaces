"use client";

import type React from "react";
import { Radio as BoardRadio } from "@/components/base/radio/radio";
import type { RadioProps as BoardRadioProps } from "@/components/base/radio/radio";
import { RadioGroup as BoardRadioGroup } from "@/components/base/radio/radio";
import type { RadioGroupProps as BoardRadioGroupProps } from "@/components/base/radio/radio";

/**
 * cossui → BoardUI 迁移适配层。
 *
 * 对外保持 Base UI RadioGroup 的 API（value / defaultValue /
 * onValueChange(value)），内部映射到 BoardUI RadioGroup + Radio
 * （react-aria-components）：
 *
 *   value/defaultValue → value/defaultValue（均为 string）
 *   onValueChange(value) → onChange(value)
 */

export interface RadioGroupProps
  extends Omit<BoardRadioGroupProps, "onChange" | "defaultValue" | "className"> {
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export function RadioGroup({
  defaultValue,
  onValueChange,
  ...props
}: RadioGroupProps): React.ReactElement {
  return (
    <BoardRadioGroup
      defaultValue={defaultValue}
      onChange={(value) => onValueChange?.(value)}
      {...props}
    />
  );
}

export interface RadioProps
  extends Omit<BoardRadioProps, "className"> {
  className?: string;
}

export function Radio({ className, ...props }: RadioProps): React.ReactElement {
  return <BoardRadio className={className} {...props} />;
}

export { Radio as RadioGroupItem };
