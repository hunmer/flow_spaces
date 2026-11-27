# apps/web 文件索引

## 顶层

```
apps/web/
├── index.html                 # SPA 壳（#root）
├── vite.config.ts             # alias/代理/vendor 拆分/dev-inspector
├── tsconfig{,.web,.node}.json # 双 project 类型检查
├── boardui.json               # BoardUI registry/alias
├── AGENTS.md                  # BoardUI 设计规则（boardui:rules）
├── electron/                  # main.mjs + preload.mjs
├── public/                    # icons(1085 svg)、ai-chat 等静态资源
└── src/
```

## src/

| 路径 | 内容 |
|---|---|
| `main.tsx` | 入口 Provider 树 |
| `app/` | router.tsx、login/、workflows/（[id]、share）、mini-apps/（[id]）、mini-apps-preview/、api/、placeholders.tsx |
| `components/workflow/` | 画布、节点视图、editor hooks、对话框、工具栏（126 文件，编辑器核心） |
| `components/mini-apps/` | 列表/编辑/预览/沙箱渲染 |
| `components/chat/` `composer/` | 会话流与输入区 |
| `components/base|application|foundations|reui/` | BoardUI 组件库 |
| `components/ui|common|table|viewers|decorations/` | 通用 UI |
| `components/sidebar|sidebar-rail|layout|home|metrics-dashboard|command-palette|settings/` | 壳与导航 |
| `components/editor/` | CodeMirror 6 封装 |
| `components/git|plugins/` | Git 面板、插件面板 |
| `stores/` | 14+ zustand store（workflow-editor/、search-commands/ 为子目录） |
| `lib/` | sdk.ts、ws.ts、agent-store（商店路由/镜像/旧 base 清除）、auth、themes、routes、code-languages、model-catalog、workflow-*、terminal-registry 等 |
| `hooks/` | 9 个通用 hooks |
| `locales/{en,zh}/` | 29 命名空间 ×2 语言 |
| `shims/` | next 兼容层（next/dynamic|image|navigation、next-intl、styled-jsx） |
| `styles/` | globals.css、app-root.css、boardui/ |
| `utils/` | cx、directional-icon、scroll-direction、use-dismiss-on-outside-press |

完整文件级映射见仓库根 `docs/feature_map.html`（web.* 功能节点）。
