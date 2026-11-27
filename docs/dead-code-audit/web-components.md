# 孤儿组件审计：apps/web/src/components/

> 审计日期：2026-11-27 ｜ 范围：`apps/web/src/components/`（501 个 ts/tsx，排除 `*.test.*`）+ pages/views 入口链反查
> 方法：`main.tsx → app/router.tsx → 页面 → 子组件` 入口链摸底后，对每个组件文件名在 `apps/web/src` 全量（692 个 ts/tsx）做锚定 import 搜索。锚定模式 `['"][@.][^'"]*/(names)['"]`，只认 `@/…` alias 与 `./ ../` 相对 import（含动态 `import(...)`），排除 `"/components/xxx"` 纯字符串 href。0 命中者再反查导出符号名确认。

## A 高置信可删（2 个）

| # | 文件 | 已搜索的引用关键字 | 0 命中证据 | 所属功能域猜测 |
|---|---|---|---|---|
| 1 | `apps/web/src/components/home/workflows-table.tsx` | `workflows-table`、`@/components/home/workflows-table`、`./workflows-table` | 全 src 692 文件锚定搜索 0 import 命中（三轮扫描均 0）；符号名 `WorkflowsTable` 亦无命中 | 旧 Home dashboard 的工作流表格；已被 `metrics-dashboard/MetricsDashboard.tsx`（← home-page.tsx:8）与 `marketing-home.tsx` 取代 |
| 2 | `apps/web/src/components/base/command-palette/command-palette.tsx` | `base/command-palette`、`./command-palette`、`@/components/base/command-palette` | 0 import 命中。唯一引用均为非 import：`application/docs/component-preview-hrefs.ts:87` 与 `components-index.ts:49` 中的 `"/components/command-palette"` href 字符串；`application/docs/command-palette-preview.tsx:15` 仅注释说明"mirror components/base/command-palette"（docs 预览页是独立实现，非 import） | base 组件库的 ⌘K 命令面板演示组件。注意：`components/command-palette/command-palette.tsx`（另一个同名目录）被 `main.tsx:29` 引用，是活代码，勿混淆 |

> 删除 A-2 时注意：`components-index.ts:49` 的 docs 索引条目与预览路由字符串会指向不存在的实现，可一并清理（属文档路由，非代码依赖）。

## B 疑似（仅经 barrel / 字符串引用，不可安全删）

| # | 文件 | 引用形态 | 说明 |
|---|---|---|---|
| B1 | `apps/web/src/components/ui/badge.tsx`、`ui/tabs.tsx`、`ui/tooltip.tsx`、`ui/skeleton.tsx`、`ui/calendar.tsx` | 仅 `lib/ui-exports.ts:11/12/16/18/24/37` barrel re-export，无直接 import | barrel 被三个 mini-app 运行时文件 `import * as AgentSpacesUI`（mini-app-renderer.tsx:5、react-renderer.tsx:76、use-mini-app-host-api.tsx:12）动态访问，无法静态判定哪些导出被用。各文件头注释自述"旧 API 表面，仅 ui-exports 再导出" |
| B2 | `apps/web/src/components/ui/navigation-menu.tsx`、`ui/avatar-group.tsx`、`ui/number-input.tsx` | 仅经 `lib/ui-exports.ts` barrel | `navigation-menu.tsx:11` 注释自述"当前无业务消费方（仅 ui-exports 再导出）"，但因 B1 同因（运行时动态访问）保守处理 |
| B3 | `apps/web/src/components/workflow/display-node-views/utils.tsx`（及同名 utils 文件） | 文件名 `utils` 搜索歧义，未单独证实 | 父目录 `display-node-views/index.ts` 被 `lib/workflow-nodes/definitions/{display,miniapp}.ts:2` import 且全量 re-export 六个 view，utils 大概率被 view 内部引用；文件名太泛无法精确验证，保留 |

## C 排除的误报与统计

### 统计

| 项 | 数量 |
|---|---|
| `apps/web/src/components/` 扫描文件数（ts/tsx，排除 `*.test.*`） | 501 |
| 全 src 扫描文件数（搜索空间） | 692 |
| 各目录初筛孤儿候选数 | 约 30（多为文件名猜错/字符串 href 误报） |
| 复核后 A 高置信可删 | **2** |
| B 疑似（barrel/歧义） | **8+ 个文件（3 组）** |
| 确认为活代码的反转候选 | 28（重点：`components/command-palette/command-palette.tsx` 曾误判，后被 main.tsx:29 引用证实存活） |

### 主要误报与排除原因

| 候选 | 排除原因 |
|---|---|
| `components/command-palette/command-palette.tsx` + `ask-ai.ts` | `main.tsx:29` 直接 import，活代码 |
| `base/command-palette` 曾混入的 `components/command-palette` 歧义 | 两个同名目录，base 版为孤儿、非 base 版存活，已区分 |
| `chat/*` 全部 30 文件（attachments、chat-message-list、member-info-card、context 等） | 均有 import 命中；`member-info-card` 经 `member-hover-card.tsx:9` 动态 `import("./member-info-card")` 引用 |
| `workflow/` 约 150 文件（含全部 properties-*、variable-*、canvas-*、display-node-views 六 view、knowledge-base-*-dialog 链） | 均被 `workflow-editor.tsx`/`workflow-canvas.tsx`/`workflow-node.tsx`/`workflow-properties-panel.tsx` 及 `lib/workflow-nodes/definitions/*.ts` 引用；knowledge-base-edit-dialog ← knowledge-base-list-dialog:11 ← workflow-fields-knowledge-base:10 |
| `ui/` 原语（card/table/dialog/button/input 等 60+ 文件） | 有直接 import（如 ui/card ← workflows/share/page.tsx:8）或经 ui-exports |
| `"/components/xxx"` 字符串大量命中（component-preview-hrefs.ts、components-index.ts、component-previews-free.tsx） | docs 预览路由字符串，非 import；仅作 A-2 的"仅文档引用"证据 |
| `*.test.*` / stories 文件 | 按规则排除 |
| editor/ 下曾猜测的 code-editor-ctx-menu、code-editor-status-bar 等 | 文件清单核实不存在（猜测名），非孤儿 |
