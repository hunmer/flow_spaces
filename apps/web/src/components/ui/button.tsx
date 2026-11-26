import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';

import { Button as BoardButton } from '@/components/base/buttons/button';
import type { ButtonProps as BoardButtonProps } from '@/components/base/buttons/button';
import { LinkButton } from '@/components/base/buttons/link-button';
import { cx } from '@/utils/cx';

/**
 * cossui → BoardUI 迁移适配层。
 *
 * 对外保持 shadcn/coss 的 API（variant/size/asChild/buttonVariants，730+ 处
 * 引用零改动），内部映射到 BoardUI（React Aria）实现：
 *
 *   variant  default|secondary|outline|ghost|destructive|link|success|warning|...
 *            → BoardUI primary|secondary|secondary|ghost|danger|link-button|primary…
 *            （success/warning/info/dark/light/gradient/glass 当前全仓 0 处使用，
 *             映射到最近的 BoardUI variant，需要时再补 token）
 *   size     default→medium · sm→small · lg→medium(+h-10) · icon/icon-sm/icon-lg
 *            → 方形覆盖（children 是图标元素，BoardUI 的 iconOnly+leadingIcon
 *              prop 形态不兼容，故不用 iconOnly，直接用 className 定方形）
 *
 * buttonVariants / asChild 分支用本地 token 类串（BoardUI Button 未导出样式
 * 表）；若 base/buttons/button.tsx 的 token 改名，这里需同步。
 */

type BoardVariant = NonNullable<BoardButtonProps['variant']>;
type BoardSize = NonNullable<BoardButtonProps['size']>;

export type ButtonVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'destructive'
  | 'link'
  | 'success'
  | 'warning'
  | 'info'
  | 'dark'
  | 'light'
  | 'gradient'
  | 'glass';

export type ButtonSize =
  | 'default'
  | 'sm'
  | 'lg'
  | 'icon'
  | 'icon-sm'
  | 'icon-lg';

const variantMap: Record<ButtonVariant, BoardVariant> = {
  default: 'primary',
  secondary: 'secondary',
  outline: 'secondary',
  ghost: 'ghost',
  destructive: 'danger',
  link: 'primary', // link 由 buttonVariants/LinkButton 分支单独处理，此处占位保证 Record 完整
  success: 'primary',
  warning: 'primary',
  info: 'primary',
  dark: 'primary',
  light: 'secondary',
  gradient: 'primary',
  glass: 'ghost',
};

const sizeMap: Record<Exclude<ButtonSize, 'icon' | 'icon-sm' | 'icon-lg'>, BoardSize> = {
  default: 'medium',
  sm: 'small',
  lg: 'medium',
};

const squareSize: Record<'icon' | 'icon-sm' | 'icon-lg', string> = {
  icon: 'size-9 p-0',
  'icon-sm': 'size-7 p-0',
  'icon-lg': 'size-10 p-0',
};

/* ---------------------------------------------------------------------- */
/*  buttonVariants —— 与 base/buttons/button.tsx 的 token 保持一致的类串。  */
/* ---------------------------------------------------------------------- */

const boardButtonBase =
  'inline-flex items-center justify-center gap-0.5 whitespace-nowrap overflow-hidden ' +
  'font-sans select-none cursor-pointer button-press-motion ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-border-focus-ring ' +
  'disabled:cursor-not-allowed aria-disabled:cursor-not-allowed ' +
  '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0';

const boardVariantClass: Record<BoardVariant, string> = {
  primary: 'bg-button-primary text-text-white shadow-xs disabled:text-button-primary-disabled-foreground disabled:shadow-none',
  danger: 'bg-button-danger text-text-white shadow-xs disabled:text-foreground-disabled-danger disabled:shadow-none',
  secondary:
    'bg-background-primary-default text-text-primary border border-border-button-default shadow-xs ' +
    'hover:bg-background-primary-hover hover:border-border-button-hover ' +
    'active:bg-background-primary-active active:border-border-button-active ' +
    'disabled:bg-background-primary-disabled disabled:border-border-button-default disabled:text-text-tertiary disabled:shadow-none',
  ghost:
    'bg-button-ghost-background text-button-ghost-foreground hover:bg-button-ghost-hover active:bg-button-ghost-active ' +
    'disabled:bg-button-ghost-disabled disabled:text-button-ghost-disabled-foreground disabled:shadow-none',
};

const linkVariantClass =
  'text-accent-600 active:text-accent-800 underline-offset-3 hover:underline ' +
  'disabled:text-text-tertiary';

const boardSizeClass: Record<BoardSize, string> = {
  medium: 'h-9 rounded-2lg p-2 text-body-medium',
  small: 'h-8 rounded-lg px-2 py-1.5 text-body-medium',
  xs: 'h-6 rounded-sm px-2 text-caption-1-semibold',
};

type VariantsInput = {
  variant?: ButtonVariant | null;
  size?: ButtonSize | null;
  className?: string;
};

export function buttonVariants({ variant, size, className }: VariantsInput = {}): string {
  variant = variant ?? 'default';
  size = size ?? 'default';
  if (variant === 'link') {
    return cx(
      boardButtonBase,
      linkVariantClass,
      size === 'sm' ? 'text-body-medium' : 'text-body-medium',
      size === 'icon' || size === 'icon-sm' || size === 'icon-lg'
        ? squareSize[size]
        : size === 'lg'
          ? 'h-10'
          : undefined,
      className,
    );
  }
  const bv = variantMap[variant];
  return cx(
    boardButtonBase,
    boardVariantClass[bv],
    size === 'icon' || size === 'icon-sm' || size === 'icon-lg'
      ? cx('rounded-2lg', squareSize[size])
      : cx(boardSizeClass[sizeMap[size]], size === 'lg' && 'h-10'),
    className,
  );
}

/* ---------------------------------------------------------------------- */
/*  Button                                                                  */
/* ---------------------------------------------------------------------- */

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
  children?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', asChild = false, type, ...props }, ref) => {
    if (asChild) {
      // Radix Slot：children 是渲染元素（如 <a href>），套用 BoardUI token 类。
      return (
        <Slot
          className={buttonVariants({ variant, size, className })}
          ref={ref}
          {...props}
        />
      );
    }

    if (variant === 'link') {
      return (
        <LinkButton
          variant="primary"
          size={size === 'sm' ? 'small' : size === 'icon-sm' ? 'xs' : 'medium'}
          className={cx(
            (size === 'icon' || size === 'icon-sm' || size === 'icon-lg') && squareSize[size],
            size === 'lg' && 'h-10',
            className,
          )}
          // 原生 <button> 默认 type="submit"，保持迁移前语义
          type={type ?? 'submit'}
          ref={ref}
          {...props}
        />
      );
    }

    const isSquare = size === 'icon' || size === 'icon-sm' || size === 'icon-lg';
    return (
      <BoardButton
        variant={variantMap[variant]}
        size={size === 'sm' ? 'small' : 'medium'}
        className={cx(
          isSquare && cx('rounded-2lg', squareSize[size]),
          size === 'lg' && 'h-10',
          className,
        )}
        type={type ?? 'submit'}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button };
