import * as React from "react";
import { cx } from "@/utils/cx";

// Mini App 运行时兼容层：存量 Mini App 经 @flow-spaces/ui / window.FlowSpacesUI
// 消费 shadcn/ui Avatar 的旧 API 表面（lib/ui-exports.ts 再导出）。
// 业务代码请改用 @/components/base/avatar；此文件仅为 Mini App 平台契约保留。
/**
 * BoardUI 视觉的 Avatar 复合 API：圆形 span + AvatarImage(img) +
 * AvatarFallback(首字母占位)。无 radix 依赖（旧版用的 @radix-ui/react-avatar
 * 不在本仓依赖内），样式 token 对齐 base/avatar（bg-avatar-neutral-background）。
 */

function Avatar({
  className,
  ...props
}: React.ComponentProps<"span">): React.JSX.Element {
  return (
    <span
      className={cx(
        "relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-avatar-neutral-background text-text-secondary",
        className,
      )}
      data-slot="avatar"
      {...props}
    />
  );
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<"img">): React.JSX.Element {
  return (
    <img
      className={cx("aspect-square size-full object-cover", className)}
      data-slot="avatar-image"
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<"span">): React.JSX.Element {
  return (
    <span
      className={cx(
        "flex size-full items-center justify-center text-body-medium font-medium",
        className,
      )}
      data-slot="avatar-fallback"
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback };
