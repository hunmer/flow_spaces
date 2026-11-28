import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import inspectorPlugin from "./inspector-babel-plugin";
import { inspectorServer } from "@react-dev-inspector/vite-plugin";

/**
 * Dev proxy target: flow-spaces server.
 * Override with SERVER_URL env var if needed.
 */
const SERVER_TARGET = process.env.SERVER_URL || "http://127.0.0.1:3110";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

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
    // 页面 origin（生产）或 hostname + 开发后端端口（开发）。
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
         */
        manualChunks(id) {
          if (!id.includes("node_modules/")) return;
          if (
            id.includes("node_modules/@codemirror/") ||
            id.includes("node_modules/@lezer/") ||
            id.includes("node_modules/@uiw/")
          )
            return "vendor-codemirror";
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
          // d3/victory-vendor/@dagrejs 等共享基础库保留在 vendor-misc。
          if (id.includes("node_modules/recharts")) return "vendor-recharts";
          // —— vendor-misc 瘦身（O4）：把兜底组里的大块头拆独立 chunk ——
          // @babel/standalone（5.5MB）已在消费点 react-renderer.tsx 改为动态
          // import，独立成 chunk 后按需加载，不进首屏。
          if (id.includes("node_modules/@babel/standalone"))
            return "vendor-babel";
          // elkjs（1.6MB）：被 xyflow 布局使用。⚠️ 不能归入 recharts
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
          // 媒体重库：lightgallery
          if (id.includes("node_modules/lightgallery")) return "vendor-media";
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
    // 与 Electron 的 DEV_URL 保持一致，避免 localhost 仅监听 IPv6 ::1。
    host: "127.0.0.1",
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
