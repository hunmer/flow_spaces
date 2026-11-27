"use client"

// Mini App 运行时兼容层：存量 Mini App 经 @flow-spaces/ui / window.FlowSpacesUI
// 消费 NumberInput 的 API 表面（lib/ui-exports.ts 再导出）。
// 业务代码请改用 @/components/base/number-field；此文件仅为 Mini App 平台契约保留。

import * as React from "react"
import { useTranslations } from "next-intl"
import { MinusIcon, PlusIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

interface NumberInputProps
  extends Omit<React.ComponentProps<"input">, "type" | "inputMode" | "onChange" | "value"> {
  /** 当前数值；受控。传 undefined/null/"" 时按空串渲染。 */
  value?: number | "" | null
  /** 数值变化回调；输入中透传未 clamp 的数值，失焦/回车时 clamp 到 [min,max]，空输入回传 undefined。 */
  onChange?: (value: number | undefined) => void
  /** 最小值（含）。默认不限制。 */
  min?: number
  /** 最大值（含）。默认不限制。 */
  max?: number
  /** 步进。默认 1。 */
  step?: number
  /** 是否禁用 +/- 步进按钮。默认 false（保留按钮）。 */
  hideButtons?: boolean
  /** 是否启用滚轮调值（聚焦后滚轮 ±step）。默认 true。 */
  wheel?: boolean
}

/**
 * 数值输入：基于 ui <Input>（BoardUI InputBase 外壳 + AriaInput 后端）。
 *
 * 未整体迁移到 BoardUI NumberField 的原因（见团队记忆 team/handoff/forms）：
 * 1. 现有受控中间态（"-"、"1."）依赖 onBeforeInput 拦截 + 原生 onChange，
 *    react-aria NumberField 受控模式下会在每次输入解析并回写 value，
 *    中间态会被规范化掉；
 * 2. +/- 步进按钮为自绘叠层（next-intl 文案、边界 disabled），与
 *    NumberField 内置 stepper 重复；
 * 3. 滚轮调值需要 non-passive wheel listener 阻止页面滚动，NumberField
 *    不暴露该钩子。
 *
 * 实现要点（避开浏览器原生 input[type=number] 的 spinner）：
 * 1. 用 type="text" + inputMode="decimal" —— 没有 spinner，无需 CSS hack。
 * 2. 用正则 onBeforeInput 校验，只允许数字、负号、小数点（按 min/step 决定是否允许负号/小数）。
 * 3. 滚轮聚焦时按 step 增减（wheel:true，可关）。
 * 4. +/- 按钮（可 hideButtons 关闭）；到边界自动 disabled。
 * 5. 失焦/回车时 clamp 到 [min,max]；输入中不改写显示内容（本地草稿态）。
 *
 * onChange 直接收 number | undefined（不再是 event）。
 */
function NumberInput({
  className,
  value,
  onChange,
  min,
  max,
  step = 1,
  hideButtons = false,
  wheel = true,
  disabled,
  onFocus,
  onBlur,
  onKeyDown,
  ...props
}: NumberInputProps) {
  const t = useTranslations("common")
  const allowNegative = typeof min === "number" ? min < 0 : true
  const allowDecimal = !Number.isInteger(step) || String(step).includes(".")

  const clamp = React.useCallback(
    (n: number) => {
      if (Number.isNaN(n)) return n
      if (typeof min === "number") n = Math.max(min, n)
      if (typeof max === "number") n = Math.min(max, n)
      return n
    },
    [min, max],
  )

  // 输入草稿：聚焦输入期间原样保留用户键入的文本（含 "-"、"1." 等中间态），
  // 不做 clamp/规范化；仅失焦/回车时 commit 解析并 clamp。
  const [draft, setDraft] = React.useState<string | null>(null)

  const stepBy = React.useCallback(
    (dir: 1 | -1) => {
      if (disabled) return
      setDraft(null)
      const base = typeof value === "number" && !Number.isNaN(value) ? value : typeof min === "number" ? min : 0
      const n = Number(base) + dir * (step || 1)
      onChange?.(Number.isNaN(n) ? undefined : clamp(n))
    },
    [disabled, value, min, step, onChange, clamp],
  )

  const display =
    draft !== null
      ? draft
      : value === null || value === undefined || value === ""
        ? ""
        : String(value)
  const atMin = typeof min === "number" && typeof value === "number" && value <= min
  const atMax = typeof max === "number" && typeof value === "number" && value >= max

  // 输入校验：组合后的值需匹配数字格式（在字符插入前拦截非法输入）。
  // 策略——允许中间态："" / "-" / "0" / "12" / "1." / "1.5"，按 allowNegative/allowDecimal 决定是否允许负号/小数。
  const handleBeforeInput = React.useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      const insert = ("data" in e ? (e as unknown as InputEvent).data : null) ?? ""
      if (insert === null) return // 组合输入/删除/控制键放行
      const el = e.currentTarget
      const start = el.selectionStart ?? el.value.length
      const end = el.selectionEnd ?? el.value.length
      const next = el.value.slice(0, start) + insert + el.value.slice(end)
      const body = allowDecimal
        ? `^${allowNegative ? "-?" : ""}(\\d+\\.?\\d*|)$`
        : `^${allowNegative ? "-?" : ""}\\d*$`
      if (!new RegExp(body).test(next)) e.preventDefault()
    },
    [allowDecimal, allowNegative],
  )

  const handleWheel = React.useCallback(
    (e: WheelEvent) => {
      if (!wheel || disabled) return
      e.preventDefault() // 必须 non-passive 才生效，见下方 useEffect 注册
      stepBy(e.deltaY < 0 ? 1 : -1)
    },
    [wheel, disabled, stepBy],
  )

  const commit = React.useCallback(
    (raw: string) => {
      if (raw.trim() === "") {
        onChange?.(undefined)
        return
      }
      const n = Number(raw)
      onChange?.(Number.isNaN(n) ? undefined : clamp(n))
    },
    [clamp, onChange],
  )

  const handleBlur = React.useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      setDraft(null)
      commit(e.target.value)
      onBlur?.(e)
    },
    [commit, onBlur],
  )

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        setDraft(null)
        commit((e.target as HTMLInputElement).value)
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        stepBy(1)
      }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        stepBy(-1)
      }
      onKeyDown?.(e)
    },
    [commit, stepBy, onKeyDown],
  )

  // 滚轮调值：React 的 onWheel 是 passive listener，preventDefault 会被忽略 →
  // 滚轮会冒泡触发祖先容器滚动（节点表单/ReactFlow pane 出滚动条）。
  // 改用 useEffect 注册原生 non-passive wheel listener（{ passive: false }）才能真正阻止。
  const containerRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener("wheel", handleWheel, { passive: false })
    return () => el.removeEventListener("wheel", handleWheel)
  }, [handleWheel])

  // 宽度策略：让宽度与内容解耦，避免数字位数变化撑开容器。
  // - 外层 div 由 className 定宽（默认 w-24），去掉 w-fit。
  // - Input 用 size={1} + min-w-0 + w-full，消除原生 input intrinsic 宽度膨胀，稳定填满容器。
  const inputEl = (
    <Input
      type="text"
      inputMode="decimal"
      role="spinbutton"
      size={1}
      aria-valuenow={typeof value === "number" ? value : undefined}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={typeof value === "number" ? String(value) : undefined}
      value={display}
      disabled={disabled}
      className={cn(
        "h-full w-full min-w-0 text-sm",
        // 有按钮时右侧留位给叠层
        hideButtons ? "" : "pr-7",
      )}
      onBeforeInput={handleBeforeInput}
      onChange={(e) => {
        // 输入中：只保存草稿并透传未 clamp 的数值，不改写显示内容。
        const raw = e.target.value
        setDraft(raw)
        if (raw.trim() === "") {
          onChange?.(undefined)
          return
        }
        const n = Number(raw)
        onChange?.(Number.isNaN(n) ? undefined : n)
      }}
      onFocus={onFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      {...props}
    />
  )

  if (hideButtons) {
    return (
      <div ref={containerRef} className={cn("flex h-8 w-24 items-center", className)}>
        {inputEl}
      </div>
    )
  }

  return (
    <div ref={containerRef} className={cn("relative flex h-8 w-24 items-center", className)}>
      {inputEl}
      {/* 步进按钮叠在右侧，类似原生 spinner 但可点 */}
      <div className="pointer-events-none absolute inset-y-0 right-0 flex flex-col">
        <button
          type="button"
          tabIndex={-1}
          aria-label={t("increase")}
          disabled={disabled || atMax}
          onClick={() => stepBy(1)}
          className="pointer-events-auto flex min-h-0 flex-1 basis-0 items-center justify-center border-l border-b border-input text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <PlusIcon className="size-3" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label={t("decrease")}
          disabled={disabled || atMin}
          onClick={() => stepBy(-1)}
          className="pointer-events-auto flex min-h-0 flex-1 basis-0 items-center justify-center border-l border-input text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <MinusIcon className="size-3" />
        </button>
      </div>
    </div>
  )
}

export { NumberInput }
export type { NumberInputProps }
