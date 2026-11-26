import * as React from "react"
import { cx } from "@/utils/cx"

/**
 * cossui → BoardUI：**token 重样式**。
 * 纯展示组件（div/label/p），样式切到 BoardUI 语义 token；
 * 结构与导出保持不变。
 */
function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cx("flex flex-col gap-4", className)} {...props} />
}

function Field({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cx("flex flex-col gap-2", className)} {...props} />
}

function FieldLabel({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cx("text-body-medium text-text-primary", className)} {...props} />
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cx("text-body-regular text-text-secondary", className)} {...props} />
}

function FieldSeparator({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cx("relative flex items-center py-2", className)} {...props}>
      <div className="flex-1 border-t border-separator-border" />
      {children && (
        <span className="px-2 text-caption-1-medium text-text-tertiary">{children}</span>
      )}
      <div className="flex-1 border-t border-separator-border" />
    </div>
  )
}

export { Field, FieldGroup, FieldLabel, FieldDescription, FieldSeparator }
