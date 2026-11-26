import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useEffect,
  type ReactNode,
} from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { useReducedMotion, AnimatePresence, m } from "motion/react";
import { T } from "./motion-tokens";
import styles from "./tooltip.module.css";
// fs-rail-tokens (rail-tokens.css): tooltip content portals to <body>, outside
// the token-scoped rail, so it must carry the scoped design tokens itself.
import "./rail-tokens.css";

// Global hover-state store: while any tooltip is open, new ones open instantly.
let anyOpen = false;
let openCount = 0;
let closeTimer = 0;
const listeners = new Set<() => void>();
const hoverStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  get: () => anyOpen,
  set(next: boolean) {
    if (anyOpen !== next) {
      anyOpen = next;
      listeners.forEach((l) => l());
    }
  },
  opened() {
    openCount += 1;
    window.clearTimeout(closeTimer);
    hoverStore.set(true);
  },
  closed() {
    openCount = Math.max(0, openCount - 1);
    if (!openCount) {
      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(() => hoverStore.set(false), 300);
    }
  },
};

function TooltipText({ text }: { text: string }) {
  const reduce = useReducedMotion();
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const lastText = useRef<string | null>(null);
  const [size, setSize] = useState<{
    width: number;
    height: number;
    animate: boolean;
  } | null>(null);

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const box = entry.borderBoxSize?.[0];
      const text = el.textContent;
      const changed = lastText.current !== null && lastText.current !== text;
      lastText.current = text;
      setSize({
        width: Math.ceil(box?.inlineSize ?? el.offsetWidth),
        height: Math.ceil(box?.blockSize ?? el.offsetHeight),
        animate: changed,
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <m.span
      className={styles.text}
      initial={false}
      animate={size ? { width: size.width, height: size.height } : undefined}
      transition={size?.animate && !reduce ? T.spring.morph : { duration: 0 }}
    >
      <span ref={measureRef} className={styles.measure} aria-hidden="true">
        {text}
      </span>
      <AnimatePresence mode="popLayout" initial={false}>
        <m.span
          key={text}
          className={styles.line}
          initial={
            !reduce && {
              opacity: 0,
              y: "0.3em",
              filter: `blur(${T.blur.soft}px)`,
            }
          }
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={
            reduce
              ? { opacity: 0, transition: { duration: 0 } }
              : {
                  opacity: 0,
                  y: "-0.3em",
                  filter: `blur(${T.blur.subtle}px)`,
                  transition: {
                    duration: T.duration.instant,
                    ease: T.ease.standard,
                  },
                }
          }
          transition={{ duration: T.duration.standard, ease: T.ease.enter }}
        >
          {text}
        </m.span>
      </AnimatePresence>
    </m.span>
  );
}

export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}) {
  const storeOpen = useSyncExternalStore(
    hoverStore.subscribe,
    hoverStore.get,
    () => false,
  );
  const [open, setOpen] = useState(false);
  const [instant, setInstant] = useState(false);

  useEffect(() => {
    if (open) {
      hoverStore.opened();
      return hoverStore.closed;
    }
  }, [open]);

  return (
    <TooltipPrimitive.Provider delayDuration={250} skipDelayDuration={0}>
      <TooltipPrimitive.Root
        open={open}
        delayDuration={250 * Number(!storeOpen)}
        onOpenChange={(next) => {
          if (next) setInstant(hoverStore.get());
          setOpen(next);
        }}
      >
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            className={`${styles.tooltip} fs-rail-tokens`}
            data-instant={instant || undefined}
            side={side}
            sideOffset={8}
            collisionPadding={12}
          >
            {typeof content === "string" || typeof content === "number" ? (
              <TooltipText text={String(content)} />
            ) : (
              content
            )}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
