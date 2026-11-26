import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import inspectorPlugin from "@react-dev-inspector/babel-plugin";
import { inspectorServer } from "@react-dev-inspector/vite-plugin";

/**
 * Dev proxy target: flow-spaces server.
 * Override with SERVER_URL env var if needed.
 */
const SERVER_TARGET = process.env.SERVER_URL || "http://127.0.0.1:3110";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * mermaid 的 dist 是多文件 + 内部循环依赖的 ESM 簇，仅按包名分组会把簇内
 * 模块初始化顺序切断（运行时 TDZ: "Cannot access 'Z' before initialization"，
 * 页面空白）。manualChunks 里用 getModuleInfo 从 mermaid 模块出发双向 BFS
 * （importedIds + importers）收集整个 mermaid 簇及其 npm 依赖闭包，
 * 整体归入 vendor-mermaid，保证簇完整不被 chunk 边界切断。
 *
 * ⚠️ 时机：rollup 调用 manualChunks 的模块顺序不确定，懒构建（首次遇到
 * mermaid 模块才建闭包）会让先被查询的 mermaid 依赖掉进兜底组，偶发
 * mermaid↔misc 循环引用（TDZ 空白页）。因此首次 manualChunks 调用
 * （无论 id 是什么）就从入口模块出发全量构建闭包。
 */
let mermaidClosure: Set<string> | null = null;
const buildMermaidClosure = (
  startId: string,
  getModuleInfo: (mid: string) => {
    importedIds?: readonly string[];
    importers?: readonly string[];
    isEntry?: boolean;
  } | null,
): Set<string> => {
  const closure = new Set<string>();
  const pushCluster = (m: string) => {
    if (m.includes("node_modules/mermaid")) {
      closure.add(m);
      return true;
    }
    return false;
  };

  // 0) 从 startId 沿 importers 爬到 entry，再向下 BFS 收集全部 mermaid 种子。
  //    mermaid 是静态 import（mermaid-preview），entry 可达全部簇成员。
  let entry = startId;
  for (let guard = 0; guard < 200; guard++) {
    const info = getModuleInfo(entry);
    if (info?.isEntry) break;
    const up = info?.importers?.[0];
    if (!up) break;
    entry = up;
  }
  const seeds: string[] = [];
  const seen = new Set<string>([entry]);
  const queue = [entry];
  for (let i = 0; i < queue.length; i++) {
    const info = getModuleInfo(queue[i]);
    for (const dep of info?.importedIds ?? []) {
      if (seen.has(dep)) continue;
      seen.add(dep);
      if (pushCluster(dep)) seeds.push(dep);
      queue.push(dep);
    }
  }
  if (seeds.length === 0) return closure; // 防御：图里没有 mermaid

  const cluster = seeds.slice();
  // 1) 双向爬 mermaid 簇（循环连通图，从任一种子可覆盖全簇）
  for (let i = 0; i < cluster.length; i++) {
    const info = getModuleInfo(cluster[i]);
    for (const dep of [
      ...(info?.importedIds ?? []),
      ...(info?.importers ?? []),
    ]) {
      if (!closure.has(dep) && dep.includes("node_modules/mermaid")) {
        closure.add(dep);
        cluster.push(dep);
      }
    }
  }
  // 2) 簇成员的 npm 依赖（含传递）也收进来，保持 chunk 自包含
  const deps = cluster.slice();
  for (let i = 0; i < deps.length; i++) {
    const info = getModuleInfo(deps[i]);
    for (const dep of info?.importedIds ?? []) {
      if (dep.includes("node_modules/") && !closure.has(dep)) {
        closure.add(dep);
        deps.push(dep);
      }
    }
  }
  return closure;
};

export default defineConfig(({ command }) => {
  const isDev = command === "serve";
  return {
  plugins: [
    react({
      // dev-inspector（组件源码定位）：babel 阶段往 JSX 注入
      // data-inspector-relative-path/-line/-column；仅开发态启用，
      // 生产构建保持原 babel 流程不受影响。
      ...(isDev
        ? { babel: { plugins: [[inspectorPlugin, { excludes: [/[\\/]node_modules[\\/]/] }]] } }
        : {}),
    }),
    tailwindcss(),
    // dev-inspector 服务端：dev server 挂载 launchEditorMiddleware，
    // 前端 gotoServerEditor 通过 /__launch-editor 打开 IDE。configureServer
    // 仅 dev server 生效，无需再判环境。
    inspectorServer(),
  ],
  resolve: {
    alias: [
      // `@` → src (same convention as the original project)
      { find: "@", replacement: r("./src") },
      // `next/*` → compatibility shims (see MIGRATION-NOTES.md)
      // resolver appends the extension (.ts) automatically.
      { find: /^next\/(.*)$/, replacement: r("./src/shims/next") + "/$1" },
      // `next-intl` → pure React provider shim (locale fixed via provider)
      { find: /^next-intl$/, replacement: r("./src/shims/next-intl.tsx") },
    ],
  },
  define: {
    // The only NEXT_PUBLIC_* var used by the original codebase
    // (src/lib/server.ts, src/proxy.ts). Empty string → fall back to
    // window.location.hostname, same as the original default behavior.
    "process.env.NEXT_PUBLIC_SERVER_URL": JSON.stringify(
      process.env.NEXT_PUBLIC_SERVER_URL ?? "",
    ),
  },
  build: {
    rollupOptions: {
      output: {
        /**
         * 大库拆独立 vendor chunk（T5）：原单 entry 11.6MB（gzip 3.3MB），
         * 首屏与缓存都不友好。按库分组后 entry 只剩业务代码。
         * pnpm 路径形如 .pnpm/<pkg>@<ver>/node_modules/<pkg>/...，
         * 用 "node_modules/<pkg>" 段匹配；顺序敏感，具体包在前。
         *
         * mermaid 特殊处理（见文件顶部 buildMermaidClosure 注释）：闭包整体
         * 归入 vendor-mermaid，避免簇内模块初始化顺序被 chunk 边界切断。
         */
        manualChunks(id, { getModuleInfo }) {
          if (!id.includes("node_modules/")) return;
          // 首次调用即构建 mermaid 闭包（种子从 entry 全图 BFS 发现，
          // 不依赖 rollup 的模块处理顺序，避免闭包成员先掉进兜底组）
          if (!mermaidClosure)
            mermaidClosure = buildMermaidClosure(id, getModuleInfo);
          // mermaid 模块及其闭包成员（dagre/khroma/cytoscape/...）整体归组
          if (id.includes("node_modules/mermaid") || mermaidClosure.has(id))
            return "vendor-mermaid";
          if (
            id.includes("node_modules/monaco-editor") ||
            id.includes("node_modules/@monaco-editor/")
          )
            return "vendor-monaco";
          if (
            id.includes("node_modules/katex") ||
            id.includes("node_modules/@vscode/rehype-katex")
          )
            return "vendor-katex";
          if (
            id.includes("node_modules/@tiptap/") ||
            id.includes("node_modules/prosemirror-")
          )
            return "vendor-tiptap";
          if (id.includes("node_modules/@xyflow/")) return "vendor-xyflow";
          // 注意：d3-*/victory-vendor/@dagrejs/elkjs 归 vendor-misc —— 归入
          // recharts/mermaid 组曾造成 circular chunk（recharts↔misc↔mermaid），
          // 这些布局/绘图基础库被多组共享，留在兜底组最稳。
          if (id.includes("node_modules/recharts")) return "vendor-recharts";
          // —— vendor-misc 瘦身（O4）：把兜底组里的大块头拆独立 chunk ——
          // @babel/standalone（5.5MB）已在消费点 react-renderer.tsx 改为动态
          // import，独立成 chunk 后按需加载，不进首屏。
          if (id.includes("node_modules/@babel/standalone"))
            return "vendor-babel";
          // elkjs（1.6MB）：被 xyflow 布局使用。⚠️ 不能归入 recharts/mermaid
          // 等业务组（曾造成 circular chunk TDZ 空白页），但独立自身 chunk
          // 拓扑在其使用方之下，安全。
          if (id.includes("node_modules/elkjs")) return "vendor-elk";
          // lucide-react（1.3MB）全量图标库，叶子依赖
          if (id.includes("node_modules/lucide-react")) return "vendor-icons";
          // react-aria 全家桶（react-aria/react-aria-components/react-stately/
          // @internationalized/date-fns/react-day-picker ≈1.4MB）
          if (
            id.includes("node_modules/react-aria") ||
            id.includes("node_modules/react-aria-components") ||
            id.includes("node_modules/react-stately") ||
            id.includes("node_modules/@internationalized/") ||
            id.includes("node_modules/react-day-picker") ||
            id.includes("node_modules/date-fns")
          )
            return "vendor-aria";
          // 媒体/表情重库：lightgallery + emoji-picker-react（≈720K）
          if (
            id.includes("node_modules/lightgallery") ||
            id.includes("node_modules/emoji-picker-react")
          )
            return "vendor-media";
          if (
            id.includes("node_modules/framer-motion") ||
            id.includes("node_modules/motion")
          )
            return "vendor-framer-motion";
          // React 基座单独一组，业务迭代不影响框架缓存
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler")
          )
            return "vendor-react";
          // 剩余第三方长尾统一兜底组，保证 entry 只含业务代码
          return "vendor-misc";
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: SERVER_TARGET, changeOrigin: true },
      "/ws": { target: SERVER_TARGET, changeOrigin: true, ws: true },
      "/public": { target: SERVER_TARGET, changeOrigin: true },
      "/static": { target: SERVER_TARGET, changeOrigin: true },
      // 本地模板商店静态路由（serve packages/templates；workflows/plugins/mini-app 已拆分走仓库路由）
      "/agents-store": { target: SERVER_TARGET, changeOrigin: true },
    },
  },
  };
});
