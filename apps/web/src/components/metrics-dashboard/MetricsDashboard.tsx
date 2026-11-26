// MetricsDashboard — 1:1 提取自 uiarc.dev 模块 13068 (chunk 13068.f8148e6675de205d.js)
// 映射表: t=jsx-runtime r=react i.I=useReducedMotion n.i=animate o.PY1=m d.N=AnimatePresence
// l.A=Check(64577) c.A=Download(50825) h.A=ArrowUpRight(9751) u.A=ArrowDownRight(71556)
// m.T=motion tokens(7770) p=css module(71068)
// x=METRICS b=RANGES v=END_DATE g=wave j=DAILY k=aggregate y=TOP_PAGES f=SOURCES
// w=fmtInt N=fmtCompact M=fmtDate A=formatValue T=Ticker F=MetricsDashboard D=Breakdown
//
// Flow Spaces 适配（其余逻辑/数据 1:1 保留，数据为占位）:
//  - 复制自 E:\ui-templates\src\uiarc\metrics-dashboard\，作为 /home 默认页内容。
//  - 设计令牌来自 ../sidebar-rail/rail-tokens.css（uiarc 令牌作用域，与侧边栏共用），
//    通过根元素挂 fs-rail-tokens 类生效——内容区不继承 uiarc 令牌，与侧边栏同一策略。
//  - 仅改标题/副标题/aria 文案；数据（METRICS/DAILY/TOP_PAGES/SOURCES）保持模板占位。
import {
  useId,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  m,
  AnimatePresence,
  animate,
  useReducedMotion,
} from "motion/react";
import { Check, Download, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { T } from "./motion-tokens";
import { getNodeDefinition } from "@/lib/workflow-nodes/registry";
import { fetchWithAuth } from "@/lib/auth";
import styles from "./metrics-dashboard.module.css";
import "../sidebar-rail/rail-tokens.css";

const METRICS = [
  { key: "runs", label: "Runs", unit: "count" },
  { key: "successRate", label: "Success rate", unit: "percent" },
  { key: "memory", label: "Memory usage", unit: "percent" },
  { key: "cpuGpu", label: "CPU/GPU usage", unit: "percent" },
];

const RANGES = [
  { value: "7d", label: "7D", long: "Last 7 days", days: 7, step: 1 },
  { value: "30d", label: "30D", long: "Last 30 days", days: 30, step: 1 },
  { value: "90d", label: "90D", long: "Last 90 days", days: 90, step: 7 },
] as const;

// ---- 真实统计（GET /api/workflows/metrics/summary） ----

interface MetricsSummary {
  days: { date: string; runs: number; completed: number; errors: number }[];
  topWorkflows: { name: string; count: number }[];
  topPlugins: { name: string; count: number }[];
  resource: { memoryPercent: number; cpuPercent: number; sampledAt: number };
}

interface DailyEntry {
  date: Date;
  runs: number;
  successRate: number;
  memory: number;
  cpuGpu: number;
}

// 空窗口兜底：请求失败/无数据时展示全 0，避免图表数值 NaN。
function emptyDaily(length = 90): DailyEntry[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length }, (_e, a) => ({
    date: new Date(today.getTime() - (length - 1 - a) * 864e5),
    runs: 0,
    successRate: 0,
    memory: 0,
    cpuGpu: 0,
  }));
}

function aggregate(e: DailyEntry[], a: string) {
  const weight = e.reduce((s, d) => s + d.runs, 0);
  if ("runs" === a) return weight;
  if ("successRate" === a) {
    // 成功率按当天完成+失败的运行数加权；无运行则取均值（通常为 0）
    const w =
      e.reduce((s, d) => s + d.runs, 0) > 0
        ? e.reduce((s, d) => s + d.successRate * d.runs, 0) / weight
        : e.length
          ? e.reduce((s, d) => s + d.successRate, 0) / e.length
          : 0;
    return w;
  }
  const pick = (d: DailyEntry) => ("memory" === a ? d.memory : d.cpuGpu);
  // 内存/CPU 为采样值：按运行次数加权，无运行日均时
  return weight > 0
    ? e.reduce((s, d) => s + pick(d) * d.runs, 0) / weight
    : e.length
      ? e.reduce((s, d) => s + pick(d), 0) / e.length
      : 0;
}

const fmtInt = new Intl.NumberFormat("en-US"),
  fmtCompact = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }),
  fmtDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }),
  formatValue = (e: { unit: string }, a: number) =>
    "percent" === e.unit ? a.toFixed(1) + "%" : fmtInt.format(Math.round(a));

function Ticker({ value: e, format: a }: { value: number; format: (v: number) => string }) {
  let s = useRef<HTMLSpanElement>(null),
    o = useRef(e),
    d = useRef(a),
    [l] = useState(() => a(e)),
    c = useReducedMotion();
  useEffect(() => {
    d.current = a;
  });
  useEffect(() => {
    let a = s.current;
    if (!a) return;
    if (c) {
      o.current = e;
      a.textContent = d.current(e);
      return;
    }
    let t = animate(o.current, e, {
      duration: T.duration.considered,
      ease: T.ease.standard,
      onUpdate: (e) => {
        o.current = e;
        a!.textContent = d.current(e);
      },
    });
    return () => t.stop();
  }, [e, c]);
  return <span ref={s}>{l}</span>;
}

export function MetricsDashboard() {
  let e = useReducedMotion(),
    a = useId(),
    [s, n] = useState("30d"),
    [p, g] = useState("runs"),
    [w, F] = useState(false),
    [I, L] = useState<number | null>(null),
    [P, $] = useState(false),
    S = useRef<number | undefined>(undefined),
    B = useRef<HTMLElement>(null),
    [R, C] = useState("lg");
  // 真实统计：每日运行序列 + Top 工作流/插件 + 资源占用采样
  let [DAILY, setDaily] = useState<DailyEntry[]>(() => emptyDaily(90)),
    [TOP_PAGES, setTopPages] = useState<{ name: string; share: number }[]>([]),
    [SOURCES, setSources] = useState<{ name: string; share: number }[]>([]);
  useEffect(() => {
    let alive = true;
    fetchWithAuth("/api/workflows/metrics/summary?days=90")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status))))
      .then((s: MetricsSummary) => {
        if (!alive) return;
        let res = s.resource ?? { memoryPercent: 0, cpuPercent: 0 };
        setDaily(
          (s.days ?? []).map((d) => {
            let finished = d.completed + d.errors;
            return {
              date: new Date(d.date + "T00:00:00"),
              runs: d.runs,
              successRate: finished > 0 ? (d.completed / finished) * 100 : 0,
              // 历史逐日资源占用未落盘：以当前采样值铺满序列（KPI 数值真实）
              memory: res.memoryPercent,
              cpuGpu: res.cpuPercent,
            };
          }),
        );
        // share 直接放调用次数（Breakdown 的 total 传 1，条形按最大值归一）
        setTopPages((s.topWorkflows ?? []).map((x) => ({ name: x.name, share: x.count })));
        setSources(
          (s.topPlugins ?? []).map((x) => ({
            name: getNodeDefinition(x.name)?.label ?? x.name,
            share: x.count,
          })),
        );
      })
      .catch(() => {
        /* 保留全 0 兜底数据 */
      });
    return () => {
      alive = false;
    };
  }, []);
  useLayoutEffect(() => {
    let e = B.current;
    if (!e) return;
    let a = (e: number) => C(e < 460 ? "sm" : e < 640 ? "md" : "lg");
    a(e.getBoundingClientRect().width);
    let s = new ResizeObserver(([e]) => a(e!.contentRect.width));
    return (s.observe(e), () => s.disconnect());
  }, []);
  let z = useMemo(
    () =>
      (function (e: string) {
        let { days: a, step: s } = RANGES.find((a) => a.value === e)!,
          LEN = DAILY.length,
          t = DAILY.slice(Math.max(0, LEN - a)),
          r = DAILY.slice(Math.max(0, LEN - 2 * a), Math.max(0, LEN - a)),
          i: Record<string, { date: Date; value: number; previous: number }[]> =
            {};
        for (let e of METRICS) {
          let n: { date: Date; value: number; previous: number }[] = [];
          for (let i = 0; i < a; i += s) {
            let o = t[i]?.date ?? t[t.length - 1]?.date ?? new Date();
            n.push({
              date: o,
              value: aggregate(t.slice(i, i + s), e.key),
              previous: aggregate(r.slice(i, i + s), e.key),
            });
          }
          i[e.key] = n;
        }
        let n = Object.fromEntries(
          METRICS.map((e) => {
            let a = aggregate(t, e.key),
              s = aggregate(r, e.key);
            return [
              e.key,
              {
                value: a,
                delta:
                  "percent" === e.unit || 0 === s
                    ? a - s
                    : ((a - s) / s) * 100,
              },
            ];
          }),
        );
        return {
          series: i,
          totals: n as Record<string, { value: number; delta: number }>,
          step: s,
          runs: (n as Record<string, { value: number }>).runs.value,
        };
      })(s),
    [s, DAILY],
  ),
    E = METRICS.find((e) => e.key === p)!,
    Q = z.series[p],
    V = RANGES.find((e) => e.value === s)!,
    H = useMemo(() => {
      let o = Q.flatMap((e) => (w ? [e.value, e.previous] : [e.value])),
        d = (() => {
          let e = Math.min(...o),
            a = Math.max(...o),
            s =
              "percent" === E.unit ? Math.max(0, e - (a - e) * 0.6) : 0,
            t = (a - s || 1) / 3,
            r = 10 ** Math.floor(Math.log10(t)),
            i = [1, 2, 2.5, 5, 10].map((e) => e * r).find((e) => e >= t) ?? t,
            n = Math.floor(s / i) * i;
          return { min: n, max: n + 3 * i, ticks: [0, 1, 2, 3].map((e) => n + i * e) };
        })(),
        l = (e: number) => (1 === Q.length ? 300 : (e / (Q.length - 1)) * 600),
        c = (e: number) => 180 - ((e - d.min) / (d.max - d.min)) * 180,
        h = (e: "value" | "previous") =>
          (function (e: [number, number][]) {
            if (e.length < 3)
              return e
                .map(
                  ([e, a], s) =>
                    (s ? "L" : "M") + e.toFixed(1) + " " + a.toFixed(1),
                )
                .join(" ");
            let a = e.length,
              s = e
                .slice(1)
                .map(([a, s], t) => (s - e[t][1]) / (a - e[t][0])),
              t = e.map((_p, t) => {
                if (0 === t) return s[0];
                if (t === a - 1) return s[a - 2];
                let r = s[t - 1],
                  i = s[t];
                return r * i <= 0 ? 0 : (2 * r * i) / (r + i);
              }),
              r = `M${e[0][0].toFixed(1)} ${e[0][1].toFixed(1)}`;
            for (let s = 0; s < a - 1; s++) {
              let [a, i] = e[s],
                [n, o] = e[s + 1],
                d = (n - a) / 3;
              r += ` C${(a + d).toFixed(1)} ${(i + t[s] * d).toFixed(1)} ${(n - d).toFixed(1)} ${(o - t[s + 1] * d).toFixed(1)} ${n.toFixed(1)} ${o.toFixed(1)}`;
            }
            return r;
          })(Q.map((a, s) => [l(s), c(a[e])])),
        u = h("value");
      return {
        scale: d,
        x: l,
        y: c,
        current: u,
        previous: h("previous"),
        area: u + " L600 180 L0 180 Z",
      };
    }, [Q, w, E.unit]),
    Y = Math.ceil(Q.length / ("sm" === R ? 4 : "md" === R ? 5 : 6)),
    U = null === I ? null : Q[I];
  function q(e: React.PointerEvent<HTMLDivElement>) {
    let a = e.currentTarget.getBoundingClientRect();
    L(
      Math.round(
        Math.min(1, Math.max(0, (e.clientX - a.left) / a.width)) *
          (Q.length - 1),
      ),
    );
  }
  useEffect(() => () => window.clearTimeout(S.current), []);
  let K = e
      ? { duration: 0 }
      : { duration: T.duration.fast, ease: T.ease.standard },
    X = e ? { duration: 0 } : T.spring.smooth,
    J = U ? Math.min(88, Math.max(12, (H.x(I!) / 600) * 100)) : 0;
  return (
    <section
      ref={B}
      className={`${styles.dashboard} fs-rail-tokens`}
      data-size={R}
      aria-label="Workspace overview dashboard"
    >
      <header className={styles.header}>
        <div className={styles.title}>
          <h2>Overview</h2>
          <p>{"flow-spaces \u00b7 " + V.long}</p>
        </div>
        <div className={styles.actions}>
          <div
            className={styles.segmented}
            role="group"
            aria-label="Time range"
          >
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                aria-pressed={s === r.value}
                aria-label={r.long}
                onClick={() => {
                  n(r.value);
                  L(null);
                }}
              >
                {s === r.value && (
                  <m.span
                    layoutId={`${a}-range`}
                    className={styles.segmentThumb}
                    transition={e ? { duration: 0 } : T.spring.snappy}
                  />
                )}
                <span className={styles.segmentLabel}>{r.label}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.exportButton}
            onClick={function () {
              $(!0),
                window.clearTimeout(S.current),
                (S.current = window.setTimeout(() => $(!1), 1800));
            }}
            aria-live="polite"
          >
            <span className={styles.exportIcon}>
              <AnimatePresence initial={false} mode="popLayout">
                <m.span
                  key={P ? "done" : "idle"}
                  initial={!e && { opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={e ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                  transition={K}
                >
                  {P ? <Check size={14} /> : <Download size={14} />}
                </m.span>
              </AnimatePresence>
            </span>
            <span className={styles.exportLabel}>
              <span aria-hidden={P} data-hidden={P}>
                Export
              </span>
              <span aria-hidden={!P} data-hidden={!P}>
                Exported
              </span>
            </span>
          </button>
        </div>
      </header>
      <div className={styles.kpis} role="tablist" aria-label="Metric">
        {METRICS.map((s) => {
          let r = z.totals[s.key],
            i = r.delta > 0,
            n = p === s.key,
            d =
              "percent" === s.unit
                ? Math.abs(r.delta).toFixed(1) + " pts"
                : Math.abs(r.delta).toFixed(1) + "%";
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={n}
              className={styles.kpi}
              onClick={() => {
                g(s.key);
                L(null);
              }}
            >
              {n && (
                <m.span
                  layoutId={`${a}-kpi`}
                  className={styles.kpiIndicator}
                  transition={e ? { duration: 0 } : T.spring.smooth}
                />
              )}
              <span className={styles.kpiLabel}>{s.label}</span>
              <span className={styles.kpiValue}>
                <Ticker value={r.value} format={(e) => formatValue(s, e)} />
              </span>
              <span className={`${styles.delta} ${i ? styles.good : styles.bad}`}>
                {r.delta >= 0 ? (
                  <ArrowUpRight size={13} aria-hidden />
                ) : (
                  <ArrowDownRight size={13} aria-hidden />
                )}
                <span>{d}</span>
                <span className={styles.srOnly}>
                  {r.delta >= 0 ? "up" : "down"} versus previous period
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className={styles.chartSection}>
        <div className={styles.chartBar}>
          <div className={styles.legend} aria-hidden>
            <span>
              <i className={styles.swatch} />
              {E.label}
            </span>
            {w && (
              <span>
                <i className={styles.swatchPrevious} />
                Previous period
              </span>
            )}
          </div>
          <label className={styles.compare}>
            <input
              type="checkbox"
              checked={w}
              onChange={(e) => F(e.target.checked)}
            />
            <span className={styles.check} aria-hidden>
              <Check size={11} strokeWidth={2.5} />
            </span>
            Compare
          </label>
        </div>
        <div className={styles.plot}>
          <div className={styles.yAxis} aria-hidden>
            {[...H.scale.ticks].reverse().map((e) => (
              <span key={e}>
                {"percent" === E.unit
                  ? e.toFixed(+(e < 10)) + "%"
                  : fmtCompact.format(e)}
              </span>
            ))}
          </div>
          <div
            className={styles.chartArea}
            tabIndex={0}
            role="img"
            aria-label={`${E.label}, ${V.long.toLowerCase()}. Use arrow keys to inspect values.`}
            onPointerMove={q}
            onPointerDown={q}
            onPointerLeave={(e) => {
              "mouse" === e.pointerType && L(null);
            }}
            onKeyDown={function (e) {
              if (
                "ArrowLeft" !== e.key &&
                "ArrowRight" !== e.key &&
                "Home" !== e.key &&
                "End" !== e.key
              )
                return;
              e.preventDefault();
              let a = Q.length - 1;
              L((s) =>
                "Home" === e.key
                  ? 0
                  : "End" === e.key
                    ? a
                    : Math.min(
                        a,
                        Math.max(
                          0,
                          (s ?? a) + ("ArrowRight" === e.key ? 1 : -1),
                        ),
                      ),
              );
            }}
            onBlur={() => L(null)}
          >
            <div className={styles.grid} aria-hidden>
              {H.scale.ticks.map((e) => (
                <span key={e} />
              ))}
            </div>
            <AnimatePresence initial={false}>
              <m.svg
                key={s + p}
                className={styles.svg}
                viewBox="0 0 600 180"
                preserveAspectRatio="none"
                aria-hidden
                initial={!e && { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: e ? 0 : T.duration.standard,
                  ease: T.ease.standard,
                }}
              >
                <m.path
                  className={styles.area}
                  initial={false}
                  animate={{ d: H.area }}
                  transition={X}
                />
                <m.path
                  className={styles.previous}
                  initial={false}
                  animate={{ d: H.previous, opacity: +!!w }}
                  transition={X}
                />
                <m.path
                  className={styles.line}
                  initial={false}
                  animate={{ d: H.current }}
                  transition={X}
                />
              </m.svg>
            </AnimatePresence>
            {U && (
              <>
                <span
                  className={styles.crosshair}
                  style={{ left: `${(H.x(I!) / 600) * 100}%` }}
                  aria-hidden
                />
                <span
                  className={styles.dot}
                  style={{
                    left: `${(H.x(I!) / 600) * 100}%`,
                    top: `${(H.y(U.value) / 180) * 100}%`,
                  }}
                  aria-hidden
                />
                <div
                  className={styles.tooltip}
                  style={{
                    left: `${J}%`,
                    ...(H.y(U.value) / 180 < 0.5
                      ? { top: "auto", bottom: 6 }
                      : null),
                  }}
                  role="status"
                >
                  <span className={styles.tooltipDate}>
                    {z.step > 1 ? "Week of " : ""}
                    {fmtDate.format(U.date)}
                  </span>
                  <strong>{formatValue(E, U.value)}</strong>
                  {w && (
                    <span className={styles.tooltipPrevious}>
                      {formatValue(E, U.previous)} previous
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
          <div className={styles.xAxis} aria-hidden>
            {Q.map((e, a) => {
              if (a % Y != 0) return null;
              let s = (H.x(a) / 600) * 100;
              return (
                <span
                  key={a}
                  style={{
                    left: `${s}%`,
                    transform: `translateX(${0 === a ? 0 : s > 92 ? -100 : -50}%)`,
                  }}
                >
                  {fmtDate.format(e.date)}
                </span>
              );
            })}
          </div>
        </div>
      </div>
      <div className={styles.breakdowns}>
        <Breakdown
          title="Top workflows"
          column="Runs"
          rows={TOP_PAGES}
          total={1}
          reduce={!!e}
        />
        <Breakdown
          title="Top plugins"
          column="Calls"
          rows={SOURCES}
          total={1}
          reduce={!!e}
        />
      </div>
    </section>
  );
}

function Breakdown({
  title: e,
  column: a,
  rows: s,
  total: r,
  reduce: i,
}: {
  title: string;
  column: string;
  rows: { name: string; share: number }[];
  total: number;
  reduce: boolean;
}) {
  let n = Math.max(1, ...s.map((e) => e.share));
  return (
    <section className={styles.breakdown} aria-label={e}>
      <div className={styles.breakdownHead}>
        <h3>{e}</h3>
        <span>{a}</span>
      </div>
      <ul>
        {s.map((e) => (
          <li key={e.name}>
            <span
              className={styles.bar}
              style={{
                clipPath: `inset(0 ${(100 - (e.share / n) * 100).toFixed(2)}% 0 0 round 6px)`,
                transitionDuration: i ? "0ms" : undefined,
              }}
              aria-hidden
            />
            <span className={styles.rowName} title={e.name}>
              {e.name}
            </span>
            <span className={styles.rowValue}>
              <Ticker
                value={r * e.share}
                format={(e) => fmtInt.format(Math.round(e))}
              />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default MetricsDashboard;
