# apps/web 模块职责

## src/ 顶层

| 目录/文件 | 职责 | 规模 |
|---|---|---|
| `main.tsx` | SPA 入口：Provider 树（Theme/Locale/ViewportInsets/DevInspector/CommandPalette/Toaster）+ BrowserRouter | 1 文件 |
| `app/` | 路由层：`router.tsx` 路由表 + 各路由客户端壳（login、workflows/[id]、workflows/share、mini-apps、mini-apps-preview）+ `api/` 路由级数据 | 9 文件 |
| `components/` | 全部 UI 组件（见下表） | 522 文件 |
| `stores/` | zustand 状态：account/agent/channel/chat/editor(+editor-send)/inspector-history/llm/mobile-panel/terminal/workflow(+workflow-editor)/workspace/search-commands | 25 文件 |
| `lib/` | 基础库：sdk 客户端、ws、auth、themes、routes、code-languages、model-catalog、terminal-registry、workflow-nodes/prompt/plugin-api/edge-id/api、layout-templates、mini-app-workflow-config 等 |
| `hooks/` | use-mobile、use-persistent-state、use-plugin-list、use-resolved-agent-icon、use-resolved-workspace-id、use-user-avatar、use-workflow-editor、use-count-up、workflow-clipboard | 9 文件 |
| `locales/` | en/zh 双语 JSON（约 30 命名空间） | 73 文件 |
| `shims/` | next 兼容层：next/{dynamic,image,navigation}、next-intl.tsx、styled-jsx.d.ts | 5 文件 |
| `styles/` | globals.css、app-root.css（#root 高度链）、boardui/ | 5 文件 |
| `utils/` | cx、directional-icon、scroll-direction、use-dismiss-on-outside-press | 4 文件 |

## components/ 子域（按规模）

| 子域 | 职责 |
|---|---|
| `workflow/`（126） | 工作流编辑器核心：xyflow 画布、节点视图（display-node-views、markdown-node-view、sticky-note-view、loop-body-view）、画布 hooks（data/dom-events/export/edge/group/node operations、editor-agent-chat/editor-execution/editor-state）、工具栏/样式面板/选择菜单/自动布局、知识库/插件/SQLite 对话框 |
| `ui/`（96） | 通用 UI 原子组件（shadcn 风格基座，供业务与 BoardUI 之外使用） |
| `application/`（68）+ `base/`（59）+ `foundations/`（4）+ `reui/`（5） | BoardUI 源码级组件库（base=原子，application=复合业务件，foundations=DirectionProvider/scroll-fade 等机制，reui=补充件） |
| `chat/`（33）+ `composer/`（6） | 会话流渲染（消息分段/附件/工具调用展示）与输入区（@提及、模型选择、语音） |
| `sidebar/`（31）+ `sidebar-rail/`（8） | 全局侧栏导航与轨道布局壳（SidebarRail 包裹列表页） |
| `mini-apps/`（26） | Mini App 列表页、编辑器页、预览容器、运行沙箱（react-renderer + Babel standalone 动态加载） |
| `editor/` | CodeMirror 6 代码编辑器封装（code-editor、code-languages、菜单栏、预览） |
| `common/`（12） | 跨域通用组件 |
| `home/`（5）+ `metrics-dashboard/`（3） | 首页（MarketingHome/HomePage）与仪表盘 |
| `command-palette/`（2） | 全局命令面板（Cmd+K） |
| 其余 | layout（theme/locale-provider/viewport-insets/dev-inspector）、git、plugins、settings、table、viewers、decorations、workflows（列表页，模板索引经 `lib/agent-store.ts` 路由到外部 flow-spaces-workflows 仓库）各 2–5 文件 |

## electron/

`main.mjs`（主进程，加载 dev server 或构建产物）+ `preload.mjs`（桥接）。
