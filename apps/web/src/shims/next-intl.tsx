/**
 * `next-intl` shim：纯 React 实现（无 Next.js 请求上下文依赖）。
 *
 * 覆盖业务闭包内实际使用的全部导出：
 *   - NextIntlClientProvider（components/layout/locale-provider.tsx）
 *   - useTranslations(namespace?)，含无参根调用（全路径 key）
 *     · t(key, values?)   —— dot-path 查找 + `{var}` 插值（本项目语言包无
 *       ICU 复数/数字格式，未实现）
 *     · t.has(key)        —— tools-dialog.tsx 使用
 *     · t.raw(key)
 *   - getTranslator(namespace?) / setRuntimeLocale(locale, messages)
 *     —— 模块级同步译文：LocaleProvider 首次挂载与 locale 变化时经
 *        setRuntimeLocale 同步运行时快照，非 React 模块（store、纯工具
 *        函数）可用 getTranslator 同步取译文
 *   - createTranslator / useLocale / useTimeZone / useNow / useFormatter
 *     仅类型占位（业务闭包未使用，防隐性引用）
 *
 * 通过 vite.config.ts alias（next-intl → 本文件）生效，业务文件零改动。
 */
import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

/** next-intl IntlError 的兼容形状（业务代码只读 err.code） */
export interface IntlError {
  code: string;
  message: string;
}

export type MissingTranslationValue = string | undefined;

interface IntlContextValue {
  locale: string;
  messages: Record<string, unknown>;
  timeZone?: string;
  now?: Date;
  onError?: (error: IntlError) => void;
  getMessageFallback?: (args: {
    namespace?: string;
    key: string;
  }) => string;
}

const IntlContext = createContext<IntlContextValue>({
  locale: "zh",
  messages: {},
});

export interface AbstractIntlMessages {
  [key: string]: AbstractIntlMessages | string;
}

export interface IntlCache {
  dateTime: Record<string, Intl.DateTimeFormat>;
  number: Record<string, Intl.NumberFormat>;
}

export interface NextIntlClientProviderProps {
  children?: ReactNode;
  locale?: string;
  /** 不传时继承外层 Provider（next-intl 的 RSC 继承语义的 SPA 近似） */
  messages?: AbstractIntlMessages;
  timeZone?: string;
  now?: Date;
  formats?: Record<string, unknown>;
  onError?: (error: IntlError) => void;
  getMessageFallback?: (args: { namespace?: string; key: string }) => string;
}

export function NextIntlClientProvider({
  children,
  locale,
  messages,
  timeZone,
  now,
  formats: _formats,
  onError,
  getMessageFallback,
}: NextIntlClientProviderProps) {
  const parent = useContext(IntlContext);
  const value: IntlContextValue = {
    locale: locale ?? parent.locale,
    messages: (messages ?? parent.messages) as Record<string, unknown>,
    timeZone: timeZone ?? parent.timeZone,
    now: now ?? parent.now,
    onError: onError ?? parent.onError,
    getMessageFallback: getMessageFallback ?? parent.getMessageFallback,
  };

  return <IntlContext.Provider value={value}>{children}</IntlContext.Provider>;
}

/** dot-path 读取嵌套 messages；命中字符串或非字符串值都返回 */
function resolvePath(
  messages: Record<string, unknown>,
  path: string,
): { found: boolean; value: unknown } {
  const segments = path.split(".");
  let cursor: unknown = messages;
  for (const segment of segments) {
    if (
      cursor &&
      typeof cursor === "object" &&
      segment in (cursor as Record<string, unknown>)
    ) {
      cursor = (cursor as Record<string, unknown>)[segment];
    } else {
      return { found: false, value: undefined };
    }
  }
  return { found: true, value: cursor };
}

/** `{var}` 插值：默认跳过未提供的变量（与 next-intl 行为一致——报错但保留原文） */
function interpolate(
  template: string,
  values?: Record<string, unknown>,
): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name] ?? "") : match,
  );
}

export type TranslationValues = Record<string, unknown>;

export interface Translator {
  (key: string, values?: TranslationValues): string;
  has: (key: string) => boolean;
  raw: (key: string) => unknown;
}

export function useTranslations(namespace?: string): Translator {
  const ctx = useContext(IntlContext);

  // 与 next-intl 一致：语言/消息未改变时保持函数引用，避免使调用方的 memo 全部失效。
  return useMemo(() => {
    const reportMissing = (fullKey: string): string => {
      ctx.onError?.({
        code: "MISSING_MESSAGE",
        message: `Could not resolve "${fullKey}" in messages for locale "${ctx.locale}".`,
      });
      return ctx.getMessageFallback
        ? ctx.getMessageFallback({ namespace, key: fullKey })
        : fullKey;
    };

    function translate(key: string, values?: TranslationValues): string {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      const { found, value } = resolvePath(ctx.messages, fullKey);
      if (!found || typeof value !== "string") {
        return reportMissing(fullKey);
      }
      return interpolate(value, values);
    }

    translate.has = (key: string): boolean => {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      const { found, value } = resolvePath(ctx.messages, fullKey);
      return found && typeof value === "string";
    };

    translate.raw = (key: string): unknown => {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      const { found, value } = resolvePath(ctx.messages, fullKey);
      if (!found) return reportMissing(fullKey);
      return value;
    };

    return translate;
  }, [ctx.locale, ctx.messages, ctx.onError, ctx.getMessageFallback, namespace]);
}

/**
 * 模块级运行时 locale 快照：LocaleProvider 首次挂载与 locale 变化时经
 * setRuntimeLocale 写入，供非 React 模块（store、纯工具函数）同步取译文。
 * 未同步前与 IntlContext 缺省一致（zh / 空包），t() 回退为 key 本身。
 */
const runtimeLocale: {
  locale: string;
  messages: Record<string, unknown>;
} = { locale: "zh", messages: {} };

export function setRuntimeLocale(
  locale: string,
  messages: AbstractIntlMessages,
): void {
  runtimeLocale.locale = locale;
  runtimeLocale.messages = messages as Record<string, unknown>;
}

/** 与 useTranslations 同构的同步 translator，不依赖 React 渲染上下文 */
export function getTranslator(namespace?: string): Translator {
  function translate(key: string, values?: TranslationValues): string {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    const { found, value } = resolvePath(runtimeLocale.messages, fullKey);
    if (!found || typeof value !== "string") return fullKey;
    return interpolate(value, values);
  }

  translate.has = (key: string): boolean => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    const { found, value } = resolvePath(runtimeLocale.messages, fullKey);
    return found && typeof value === "string";
  };

  translate.raw = (key: string): unknown => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    return resolvePath(runtimeLocale.messages, fullKey).value;
  };

  return translate;
}

/** 以下导出业务闭包未使用，仅保持模块形状、防隐性引用崩溃 */

export function useLocale(): string {
  return useContext(IntlContext).locale;
}

export function useNow(): Date {
  return useContext(IntlContext).now ?? new Date();
}

export function useTimeZone(): string | undefined {
  return useContext(IntlContext).timeZone;
}

/** next-intl 的 Intl.Formatters 子集（TS 全局 Intl 命名空间无此类型；业务闭包未使用，占位即可） */
interface ShimFormatters {
  dateTime: (value: Date | number, options?: Intl.DateTimeFormatOptions) => string;
  number: (value: number, options?: Intl.NumberFormatOptions) => string;
  relativeTime: () => string;
}

export function useFormatter(): ShimFormatters {
  const { locale, timeZone } = useContext(IntlContext);
  return {
    dateTime: (value: Date | number, options?: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale, { timeZone, ...options }).format(value),
    number: (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, options).format(value),
    relativeTime: () => "",
  };
}

export function createTranslator(_opts: {
  locale: string;
  messages?: AbstractIntlMessages;
}): Translator {
  // 简化实现：业务闭包未使用（仅服务端 request 场景）
  const noop = ((key: string) => key) as Translator;
  noop.has = () => false;
  noop.raw = (key: string) => key;
  return noop;
}
