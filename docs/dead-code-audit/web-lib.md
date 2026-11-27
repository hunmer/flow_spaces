# 死代码审计 — apps/web/src（components/ 之外）

审计范围：`apps/web/src` 的 `lib/`、`hooks/`、`styles/`、`shims/`、`utils/`、`locales/`、`electron/`、`app/`（api 除外）。
方法：入口链（`src/main.tsx`、`apps/web/vite.config.ts:119-124` alias、`apps/web/package.json` scripts）→ 对每个文件 rg 搜文件名/路径 → 0 命中的再反查导出符号二次确认。
判定基准：当前代码是否消费（Monaco→CodeMirror、商店拆仓之后的状态）。
日期：2026-11-27 · 审计人：audit-web-lib

## A 高置信可删

| # | 文件 | 搜索关键字 | 证据 | 备注 |
|---|------|-----------|------|------|
| A1 | `apps/web/src/shims/next/dynamic.tsx` | `next/dynamic` | rg 全仓（含 src 与 electron）仅命中 shim 文件自身；`vite.config.ts:122` 的 `next/*` alias 虽存在，但无任何代码 import `next/dynamic` | 0 消费。删 shim 后 alias 规则可保留（其他 next/* shim 仍用） |
| A2 | `apps/web/src/shims/styled-jsx.d.ts` | `styled-jsx` | rg 全仓仅命中 shim 自身；`tsconfig.web.json` `types: []`，无 styled-jsx 依赖用法 | Next.js styled-jsx 类型垫片迁移残留；删除前全局确认无 JSX `<style jsx>` 用法（已确认无） |
| A3 | `apps/web/src/app/api/chat/route.ts` | `api/chat`、`route.ts` | 371 行 Next.js App Router route handler（Vercel AI SDK POST `/api/chat`）。无任何 import 引用；Vite SPA 不处理 `app/api` route；`stores/chat.ts:455/707/1101` 的 `/api/chat/workspaces/...` 等走 vite proxy → packages/server，与本文件无关 | ⚠️ 文件头注释声明其为 BoardUI agent 模板的运行时契约（`RUNTIME_CONTRACT` 版本标记，模板安装链可能按路径引用/保留定制版）。删除前需 Lead 确认模板安装（store 拉取安装）不再按此路径写入。若确认无依赖即可删 |

## B 疑似（仅弱引用/字符串/动态引用可能）

| # | 文件 | 搜索关键字 | 证据 | 备注 |
|---|------|-----------|------|------|
| B1 | `apps/web/src/locales/en/issue.json` + `apps/web/src/locales/zh/issue.json` | `useTranslations('issue`、`"issue.` | `useTranslations(...)` 全部 266 处调用中无 `issue` namespace；带点 key 字符串（`'issue.xxx'`/`"issue.xxx"`）0 命中 | 文件本身被 `en/index.ts:15`、`zh/index.ts:15` 导入（barrel 消费，不计 A）。存在动态 namespace 调用（变量传入）的可能，故列疑似；`workflow-editor-page-client.tsx:19` 等出现的 `'issue'` 是 embeddedMode 枚举值，非 i18n key |
| B2 | `apps/web/src/locales/en/flexLayout.json` + `apps/web/src/locales/zh/flexLayout.json` | `useTranslations('flexLayout`、`"flexLayout.` | 同上，namespace 与 key 字符串均 0 命中 | 同 B1 |
| B3 | `apps/web/src/locales/en/database.json` + `apps/web/src/locales/zh/database.json` | `useTranslations('database`、`"database.` | 同上，0 命中 | 同 B1；`mobile-panel.ts:13`、`file-icon.tsx:228`、`sqlite.ts` 中的 `"database"` 均为非 i18n 用途 |
| B4 | `apps/web/src/locales/en/agentCommands.json` + `apps/web/src/locales/zh/agentCommands.json` | `useTranslations('agentCommands` | 同上，0 命中 | 同 B1 |
| B5 | `apps/web/src/locales/en/skillsPackages.json` + `apps/web/src/locales/zh/skillsPackages.json` | `useTranslations('skillsPackages` | 同上，0 命中 | 同 B1 |
| B6 | `apps/web/src/locales/en/outputStyles.json` + `apps/web/src/locales/zh/outputStyles.json` | `useTranslations('outputStyles` | 同上，0 命中 | 同 B1 |

B 档合计 12 个文件（6 namespace × en/zh）。处置建议：确认仓库内无 `useTranslations(变量)` 动态引用这些 namespace 后，可连同 `en/index.ts`/`zh/index.ts` 的 import 一并删除。

## C 排除的误报与统计

### C1 排除的误报（核实为活跃）

| 文件/目录 | 曾疑似 | 核实结果 |
|-----------|--------|----------|
| `apps/web/src/styles/`（全部 5 个 css） | 目录孤岛 | `main.tsx` 导入 `globals.css`+`app-root.css`；`globals.css:3` @import `boardui/globals.css`；`boardui/globals.css:2-3` @import `theme.css`+`typography.css` — CSS 链全活跃 |
| `apps/web/src/locales/*.json`（70 个中 58 个） | 逐文件查 t() 太重 | `en/index.ts`、`zh/index.ts` 各 35 条 import，目录内 json 恰好 35 个/语言，全部被 barrel 消费（文件级无孤儿；仅 B 档 6 ns 疑似 key 级未用） |
| `apps/web/electron/main.mjs` / `preload.mjs` | — | `package.json` `"electron:dev": "electron electron/main.mjs"`；`main.mjs:26` 加载 `preload.mjs` — 均活跃 |
| `apps/web/src/shims/next/navigation`、`next/image`、`shims/next-intl.tsx`、`next-intl.test.ts` | Next 迁移残留 | 分别被路由代码、components-catalog/auth-media-carousel/free-landing-previews/editor-file-icon、locale-provider 等大量引用 — 活跃 |
| `apps/web/src/lib/workflow-nodes/`（barrel + constants + registry + i18n + definitions/*） | barrel 可能无人用 | barrel 被 26 文件消费；definitions 内部经相对路径互引 — 全活跃 |
| `apps/web/src/app/`（router.tsx、login/、mini-apps/、workflows/、placeholders.tsx、login-rings.module.css） | Next pages 残留 | 由 `main.tsx` → AppRoutes 消费；`login-rings.module.css` 被 `login/page.tsx` 引用 — 活跃 |
| `apps/web/src/lib/` 其余 29 个顶层文件 | — | 逐一 rg 引用全部 ≥1 命中（account-api、agent-members、agent-store、api-error、auth、code-languages、converter、layout-templates、mini-app-preview、mini-app-workflow-config、model-catalog、native-notification、navigate、provider-icon、routes、sdk、server、terminal-registry、themes、ui-exports、utils、workflow-api、workflow-edge-id、workflow-plugin-api、workflow-prompt、ws 等）— 全活跃 |
| `apps/web/src/hooks/`（9 个） | — | 全活跃：use-count-up、use-mobile、use-persistent-state、use-plugin-list、use-resolved-agent-icon、use-resolved-workspace-id、use-user-avatar、use-workflow-editor、workflow-clipboard（后者含测试文件引用） |
| `apps/web/src/utils/`（4 个） | — | cx（数十处）、directional-icon、scroll-direction（carousel.tsx）、use-dismiss-on-outside-press — 全活跃 |

### C2 审计规则排除项

- `*.test.*` / demo 文件不计入（如 `shims/next-intl.test.ts`、`workflow-reference-edges.test.ts`）。
- barrel `index.ts` re-export 且 barrel 本身被消费的，视为消费（locales json、workflow-nodes definitions）。
- vite 配置直接引用的（tailwind css 入口、alias、manualChunks）视为消费。
- 仅类型导入也算消费（无此类孤例发现）。

### C3 统计

| 档 | 数量 | 明细 |
|----|------|------|
| A 高置信可删 | 3 文件 | shims/next/dynamic.tsx、shims/styled-jsx.d.ts、app/api/chat/route.ts（A3 需 Lead 确认模板链） |
| B 疑似 | 12 文件 | locales 6 namespace × en/zh（issue、flexLayout、database、agentCommands、skillsPackages、outputStyles） |
| C 核实为活跃 | ~110+ 文件 | styles 5、locales index 2 + json 70（其中 12 转入 B）、electron 2、shims 5、lib 30 + workflow-nodes、hooks 9、utils 4、app 路由层 |
