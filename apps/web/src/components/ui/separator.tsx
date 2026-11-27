import { cx } from "@/utils/cx";


// Mini App 运行时兼容层：存量 Mini App 经 @flow-spaces/ui / window.FlowSpacesUI
// 消费此组件的旧 API 表面（lib/ui-exports.ts 再导出）。
// 业务代码请改用 @/components/base/*；此文件仅为 Mini App 平台契约保留。
/**
 * Separator migrated to BoardUI visuals: a 1px hairline on the BoardUI
 * separator token (`--color-separator-border`) so it reads on any surface in
 * both themes. The DOM stays a plain `<div>` so the original props surface is
 * unchanged (no radix dependency).
 */
function Separator({
  orientation = "horizontal",
  className,
  ...props
}: React.ComponentProps<"div"> & {
  /** 旧 shadcn API：'horizontal' | 'vertical'，垂直时为 1px 宽（高度可由 style 覆盖） */
  orientation?: "horizontal" | "vertical";
}) {
  return (
    <div
      data-slot="separator"
      data-orientation={orientation}
      role="none"
      className={cx(
        "shrink-0 bg-separator-border",
        orientation === "vertical" ? "h-full w-px" : "h-px w-full",
        className,
      )}
      {...props}
    />
  )
}

export { Separator }
