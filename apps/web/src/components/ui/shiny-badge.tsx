import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { CHIP_COLORS, type ChipColor } from '@/components/base/badges/chip';
import { cx } from '@/utils/cx';

/**
 * 迁移说明（BoardUI 收敛）：本模块不再依赖 ui/badge，内部改用 base
 * badges/chip 的官方外观（CHIP_COLORS 色板 + caption 排版）渲染，
 * 扫光层内联自旧 ui/badge 的 BadgeShine（animate-shine 关键帧不变）。
 * 对外导出（ShinyBadge + shinyBadgeVariants）保持不变，消费方无需改动。
 */
const shinyBadgeVariants = cva(
  'inline-flex items-center rounded-full border text-xs font-semibold transition-colors focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent',
        secondary: 'border-transparent',
        destructive: 'border-transparent',
        outline: 'text-foreground',
      },
      shiny: {
        true: 'relative overflow-hidden',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      shiny: false,
    },
  },
);

/** variant → base Chip color 的语义映射 */
const SHINY_VARIANT_TO_COLOR: Record<NonNullable<VariantProps<typeof shinyBadgeVariants>['variant']>, ChipColor> = {
  default: 'blue',
  secondary: 'neutral',
  destructive: 'rose',
  outline: 'soft',
};

export interface ShinyBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof shinyBadgeVariants> {
  shiny?: boolean;
  shinySpeed?: number;
}

/** 扫光层（浅色/深色两套），内联自旧 ui/badge 的 BadgeShine 实现 */
function ShinyBadgeShine({ duration }: { duration: string }) {
  return (
    <>
      <span
        className="absolute inset-0 pointer-events-none animate-shine dark:hidden"
        style={{
          background:
            'linear-gradient(120deg, transparent 40%, rgba(255,255,255,0.6) 50%, transparent 60%)',
          backgroundSize: '200% 100%',
          animationDuration: duration,
          mixBlendMode: 'screen',
        }}
      />
      <span
        className="absolute inset-0 pointer-events-none animate-shine hidden dark:block"
        style={{
          background:
            'linear-gradient(120deg, transparent 40%, rgba(0,0,150,0.25) 50%, transparent 60%)',
          backgroundSize: '200% 100%',
          animationDuration: duration,
          mixBlendMode: 'multiply',
        }}
      />
    </>
  );
}

function ShinyBadge({
  className,
  variant,
  shiny = false,
  shinySpeed = 5,
  children,
  ...props
}: ShinyBadgeProps) {
  const color = variant ? SHINY_VARIANT_TO_COLOR[variant] : 'blue';
  return (
    <span
      className={cx(
        // base Chip 官方外观（caption 形态），shiny 时收为圆角胶囊保证扫光裁剪正确
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-1.5 py-1 text-caption-1-medium',
        CHIP_COLORS[color],
        shiny && 'relative overflow-hidden rounded-full',
        className,
      )}
      {...props}
    >
      {shiny ? (
        <>
          <span className="relative z-10 inline-flex items-center">{children}</span>
          <ShinyBadgeShine duration={`${shinySpeed}s`} />
        </>
      ) : (
        children
      )}
    </span>
  );
}

export { ShinyBadge, shinyBadgeVariants };
