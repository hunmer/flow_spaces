# apps/web 常见问题

**Q: 页面空白/控制台 TDZ "Cannot access ... before initialization"？**
vendor chunk 分组被改动导致 mermaid 簇被切断。看 `vite.config.ts` 的 `buildMermaidClosure`；恢复注释中的分组顺序，本地 `pnpm build` 验证。

**Q: 代码编辑器渲染异常？**
编辑器为 CodeMirror 6（@uiw/react-codemirror），全部依赖走 bundle（vendor-codemirror chunk）。升级依赖后重新 `pnpm build` 即可。

**Q: 找某个 UI 组件从哪开始？**
优先 `components/base/`、`components/application/`（BoardUI）；其次 `components/ui/`；业务件按域在 `components/<domain>/`。dev 模式点组件可直接跳源码（react-dev-inspector）。

**Q: 新增文案不生效/语言不全？**
文案必须进 `src/locales/{en,zh}/*.json`；跑 `scripts/check-locale-parity.mjs`（缺 key 报错）。LocaleProvider 经 next-intl shim 读取。

**Q: 编辑器页面高度塌了？**
`#root` 高度链依赖 `ViewportInsets` 维护的 `--app-content-height`（`styles/app-root.css`）。检查该组件是否在入口 Provider 树中、`index.html` 静态 class 是否被改动。

**Q: 请求 404/CORS？**
dev 下 `/api` `/ws` `/public` `/static` 由 vite 代理到 server（默认 3110）。确认 server 已起（`pnpm dev:server`）或设 `SERVER_URL`。

**Q: 类型报错指向 next 模块？**
`next/*`、`next-intl` 被 alias 到 `src/shims/`；不要安装 next 包本身，检查 import 是否在 shim 覆盖范围（dynamic/image/navigation/intl）。

**Q: Mini App 预览白屏？**
预览在 Babel standalone 沙箱编译用户 JSX（动态 import，独立 chunk）。看 Network 是否加载了 vendor-babel；用户代码报错会渲染原始错误文案，先看 console。
