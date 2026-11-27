import { cx } from "@/utils/cx";


// Mini App 运行时兼容层：存量 Mini App 经 @flow-spaces/ui / window.FlowSpacesUI
// 消费此组件的旧 API 表面（lib/ui-exports.ts 再导出）。
// 业务代码请改用 @/components/base/*；此文件仅为 Mini App 平台契约保留。
/**
 * Skeleton migrated to BoardUI visuals: reuses the BoardUI skeleton recipe
 * (`.bui-skeleton` sheen from styles/boardui/globals.css, blocks tinted from
 * the text colour at 8% so they read on any surface in both themes). The DOM
 * stays a plain `<div>` so the original props surface is unchanged.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cx("bui-skeleton block rounded-xl bg-text-primary/8", className)}
      {...props}
    />
  )
}

function SkeletonGroup({ count = 3, children }: { count?: number; children: (i: number) => React.ReactNode }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>{children(i)}</div>
      ))}
    </>
  )
}

export { Skeleton, SkeletonGroup }
