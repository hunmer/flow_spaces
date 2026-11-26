import { useEffect, useRef, type PointerEvent } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionStyle,
} from "motion/react";
import { GalleryVerticalEnd } from "lucide-react";
import { LoginForm } from "@/components/home/login-form";
import styles from "./login-rings.module.css";

/** 同心圆环：外圈间距 60，每第 3 圈为主环（稍亮），营造纵深。 */
const rings = Array.from({ length: 14 }, (_, index) => ({
  r: 224 + index * 60,
  major: index % 3 === 2,
}));

/** 指针视差：仅可悬停的精细指针参与，reduced motion 时禁用。 */
function useDrift(reduce: boolean) {
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const x = useSpring(pointerX, { visualDuration: 0.9, bounce: 0 });
  const y = useSpring(pointerY, { visualDuration: 0.9, bounce: 0 });
  const dx = useTransform(x, (value) => `${value.toFixed(2)}px`);
  const dy = useTransform(y, (value) => `${value.toFixed(2)}px`);
  const canHover = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => {
      canHover.current = query.matches;
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (reduce || !canHover.current || event.pointerType !== "mouse") return;
    const box = event.currentTarget.getBoundingClientRect();
    pointerX.set(((event.clientX - box.left) / box.width - 0.5) * -2);
    pointerY.set(((event.clientY - box.top) / box.height - 0.5) * -2);
  };
  const onPointerLeave = () => {
    pointerX.set(0);
    pointerY.set(0);
  };
  return {
    style: { "--dx": dx, "--dy": dy } as MotionStyle,
    onPointerMove,
    onPointerLeave,
  };
}

/** 密码登录单页：同心圆环背景 + 居中卡片（表单复用 LoginForm，仅密码渠道）。 */
export default function LoginPage() {
  const reduce = !!useReducedMotion();
  const drift = useDrift(reduce);

  return (
    <section
      className="relative flex min-h-svh flex-col overflow-hidden bg-background text-foreground"
      onPointerMove={drift.onPointerMove}
      onPointerLeave={drift.onPointerLeave}
    >
      <motion.div
        className={`pointer-events-none absolute inset-0 grid place-items-center ${styles.backdrop}`}
        style={drift.style}
        aria-hidden="true"
      >
        <svg className={styles.lines}>
          <svg x="50%" y="50%" overflow="visible">
            <line className={styles.axis} x1="-2400" x2="2400" y1="0" y2="0" />
            <line className={styles.axis} x1="0" x2="0" y1="-2400" y2="2400" />
            {rings.map((ring) => (
              <circle
                key={ring.r}
                className={
                  ring.major
                    ? `${styles.ring} ${styles.ringMajor}`
                    : styles.ring
                }
                r={ring.r}
                cx="0"
                cy="0"
              />
            ))}
          </svg>
        </svg>
      </motion.div>

      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10">
        <a href="/" className="flex items-center gap-2 font-medium">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GalleryVerticalEnd className="size-4" />
          </div>
          Agent Spaces
        </a>
      </header>

      <main className="relative z-10 grid flex-1 place-items-center px-4 pb-10">
        <motion.div
          className="w-full max-w-sm rounded-2xl border bg-card/70 p-8 shadow-xl backdrop-blur-sm"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={
            reduce
              ? { duration: 0.2 }
              : { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
          }
        >
          <LoginForm />
        </motion.div>
      </main>
    </section>
  );
}
