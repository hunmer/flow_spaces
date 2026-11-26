"use client";

import type { ReactElement, ReactNode } from "react";
import { Slider as BoardSlider } from "@/components/base/slider/slider";
import { RangeSlider as BoardRangeSlider } from "@/components/base/slider/slider";

/**
 * cossui → BoardUI 迁移适配层。
 *
 * 对外保持原 Slider 的宽松 API：value 可以是单值或数组（数组走
 * BoardUI RangeSlider 双滑块）；onChange / onValueChange 均接受
 * (value: number | number[])。thumbLabel / thumbLabels / showTooltip /
 * formatValue 透传给 BoardUI。
 */

export interface SliderProps {
  value?: number | number[];
  defaultValue?: number | number[];
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  readOnly?: boolean;
  name?: string;
  label?: ReactNode;
  thumbLabel?: string;
  thumbLabels?: [string, string];
  showTooltip?: boolean;
  formatValue?: (value: number, index: number) => ReactNode;
  onChange?: (value: number | number[]) => void;
  onValueChange?: (value: number | number[]) => void;
  className?: string;
}

export function Slider({
  value,
  defaultValue,
  thumbLabels,
  onChange,
  onValueChange,
  ...props
}: SliderProps): ReactElement {
  const handleChange = (v: number | number[]) => {
    onChange?.(v);
    onValueChange?.(v);
  };

  const isRange =
    Array.isArray(value) || Array.isArray(defaultValue) || thumbLabels !== undefined;

  if (isRange) {
    return (
      <BoardRangeSlider
        value={value as number[] | undefined}
        defaultValue={defaultValue as number[] | undefined}
        thumbLabels={thumbLabels}
        onChange={handleChange as (value: number[]) => void}
        {...props}
      />
    );
  }

  return (
    <BoardSlider
      value={value as number | undefined}
      defaultValue={defaultValue as number | undefined}
      onChange={handleChange as (value: number) => void}
      {...props}
    />
  );
}
