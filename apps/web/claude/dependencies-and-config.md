# apps/web 依赖与配置

## 关键运行时依赖（package.json 摘要）

- 框架：React 19 + react-router-dom（SPA）、Vite 7、Tailwind CSS v4（@tailwindcss/vite）。
- 编辑器/画布：@xyflow/react（工作流画布）、@uiw/react-codemirror + @codemirror/*（CodeMirror 6 代码编辑，语言白名单见 `src/lib/code-languages.ts`：仅前端技术/js/ts、css/less/scss、html/xml、markdown、json + Python + 配置文件 yaml/ini/toml/dockerfile，其余回落 plaintext）、@tiptap/*（富文本）。
- AI 流：@ai-sdk/react + anthropic/google/openai providers（浏览器侧直连可选路径）。
- UI：react-aria-components、@radix-ui/*、@dnd-kit/*、@tanstack/react-table、sonner、framer-motion、lucide-react + @remixicon/react + @tabler/icons-react。
- workspace 包：`@flow-spaces/sdk`、`@flow-spaces/shared`。
- 其他重库：@babel/standalone（mini-app 预览 JSX 沙箱，动态 import）、recharts、flexlayout-react、lightgallery。emoji-picker-react 已移除（2026-11，省 39MB）：agent 头像图标选择改用自研轻量组件 `src/components/common/icon-picker.tsx`（BoardUI token + 内置静态 emoji 分组）。

## 配置文件

| 文件 | 作用 |
|---|---|
| `vite.config.ts` | alias（`@`→src；next/*→shims；next-intl→shim）、dev 代理（/api /ws /public /static → 127.0.0.1:3110，`SERVER_URL` 可覆盖）、manualChunks vendor 拆分、dev-inspector |
| `tsconfig.web.json` / `tsconfig.node.json` / `tsconfig.json` | 双 project 类型检查（web DOM 侧 / vite+electron node 侧） |
| `boardui.json` | BoardUI 组件 alias 与 registry（MCP install_components 落点） |
| `AGENTS.md` | BoardUI 设计规则（boardui:rules 区块） |
| `electron/main.mjs`、`preload.mjs` | Electron 壳 |

## 环境变量

- `NEXT_PUBLIC_SERVER_URL`：server 地址（唯一被 define 的 NEXT_PUBLIC_* 变量；空串回退 window.location.hostname）。
- `SERVER_URL`：vite dev 代理目标（默认 `http://127.0.0.1:3110`）。

## 版本/兼容提醒

- TypeScript strict + ES2022 + bundler resolution（根 tsconfig.base.json）。
- `next/*` 与 `next-intl` 导入仅作为迁移兼容存在，alias 已重定向，勿新增。
- CodeMirror 6 全部走 bundle（vite manualChunks 拆 vendor-codemirror chunk），无 public 静态分发。
