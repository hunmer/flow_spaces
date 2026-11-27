# Plan 001: 删除 agent-spaces 迁移残留（迁移期脚本 / Flutter-Tauri 原生壳 / i18n 工作集）

## Status

- **Priority**: P1（用户直接下令清理）
- **Effort**: M
- **Risk**: 低（全部删除项均为 0-活引用或恒 false 分支；唯一有调用方的导出签名不变）
- **Planned at**: commit `d28d7b6`（2026-11-27，工作树干净）。执行前若 `git rev-parse --short HEAD` 不是 `d28d7b6` 或 `git status` 非空，STOP 并上报。

## Why this matters

本仓 flow_spaces 是从 agent-spaces（Next.js + Flutter 壳）迁移来的 Vite SPA。迁移后残留三类死物：

1. **迁移期一次性脚本**：`copy-closure.mjs`/`verify-copy.mjs`（T2 复制校验，硬编码指向旧仓 `../../agent_spaces`，早已无用）。
2. **Flutter/Tauri 原生壳桥接代码**：Flutter 壳已废弃（用户裁定），`native-notification.ts` 的 Flutter 桥、`navigate.ts` 的 Flutter 静态资源分支、`theme-provider.tsx` 的 `AgentSpacesStatusBar` 状态栏桥、`viewport-insets.tsx` 的原生 insets 读取，全是永不可达或恒 false 的代码。
3. **i18n 硬编码审计工具**：`i18n-workset.txt`（64 条 Next.js `app/components` 路径清单，指向已不存在的目录结构）+ `audit-i18n-hardcode.mjs`（用户裁定彻底退役；`check-locale-parity.mjs` 保留是活工具）。

## Repo facts（执行者必读）

- Windows 机器，仓库根 `E:\flow_spaces`（bash 路径 `/e/flow_spaces`）。pnpm monorepo。
- **验证命令（全部从仓库根执行，除非注明）**：
  - typecheck：`cd apps/web && npx tsc --noEmit -p tsconfig.web.json`（基线 exit 0）
  - i18n：`node scripts/check-locale-parity.mjs`（基线 exit 0，输出 `✓ en/zh 键完全对称：28 个命名空间，2956 个键`）
  - build：`cd apps/web && npx vite build`（基线 exit 0，约 33s；仅写 `dist/`，标准 ignored 目录）
  - `node --test` **基线就是红的**（`group-execution-state.test.mjs` 依赖运行时数据目录 `packages/server/flow-spaces-data/mini-apps/game-asset-canvas/`，ERR_MODULE_NOT_FOUND，与本任务无关）——**不要**把测试跑通当作验收，也不要试图修它。
- 代码风格：双引号/单引号混用随文件现状；中文注释；导出函数带 `/** ... */` JSDoc。保持文件原有引号风格。
- 上一轮死代码清理已有提交（`2d5ef57` web、`4778397` server、`ae14e0a` AgentSpacesUI→FlowSpacesUI 重命名），本轮是它的延续。

## Scope

**In-scope（且仅限这些文件）**：
- `scripts/copy-closure.mjs`、`scripts/verify-copy.mjs`、`scripts/audit-i18n-hardcode.mjs`、`i18n-workset.txt`（删除）
- `apps/web/src/lib/native-notification.ts`、`apps/web/src/lib/navigate.ts`（瘦身）
- `apps/web/src/components/layout/theme-provider.tsx`、`apps/web/src/components/layout/viewport-insets.tsx`（瘦身）
- `apps/web/src/components/home/login-form.tsx`、`apps/web/src/components/workflow/workflow-node-execution-log.tsx`（调用点修正）
- `apps/web/src/lib/auth.ts`、`apps/web/src/lib/sdk.ts`、`apps/web/src/components/sidebar-rail/SidebarRail.tsx`（仅删一行注释，各一处）
- 文档：`claude/conventions.md`、`claude/testing-and-quality.md`、`claude/file-map.md`、`claude/changelog.md`、`apps/web/claude/faq.md`、`apps/web/claude/testing-and-quality.md`
- 非跟踪垃圾：`.tmp/docs-audit-lifecycle.md`、`.tmp/docs-audit-workflow.md`、`apps/web/debug.log`

**Out-of-scope（严禁触碰）**：
- `window.AgentSpacesUI` / `window.AgentSpaces` / `window.AgentSpacesAPI` 兼容别名（存量 mini-app 兜底，见 claude/changelog.md 记录）——本 plan 的 grep 验收词是精确的 `AgentSpacesStatusBar`，不会误伤它们。
- `AGENT_SPACES_DATA_DIR` env 回退（`packages/server` 的 json-store.ts）、`User-Agent 'AgentSpaces/1.0'` 字符串。
- `apps/web/src/main.tsx` 头部 Next→SPA 迁移对照注释、`docs/workflow/` 迁移文档、`docs/feature_map.html/.json`、`scripts/check-locale-parity.mjs`、`scripts/gen-feature-map.py`。
- `packages/`（server/sdk/shared/templates）任何文件。
- 不新增任何依赖；不改任何仍在消费的 API 签名。

## Current state（excerpt 全部为规划时的真实源码，含行号）

### A. native-notification.ts（`apps/web/src/lib/native-notification.ts`，162 行）

头注释（1-6 行）：
```ts
/**
 * Native notification abstraction layer.
 *
 * - Web: uses the browser Notification API
 * - Flutter: uses __flutterBridge.invoke('sendNotification')
 */
```

待删段落：L10 `ANDROID_ONGOING_TASK_NOTIFICATION_ID`；L17-32 `isFlutterEnvironment`/`isNativeEnvironment`/`isNativeAndroidEnvironment`；L34-42 `isTauriEnvironment`/`isTauriAndroidEnvironment`（`@deprecated` 恒 false/转发，0 外部调用方）；L46-48、L54-56、L62-64 三个公开导出内的 `if (isFlutterEnvironment()) {...}` 分支；L68-75 `sendAndroidOngoingWorkflowNotification`；L121-162 Flutter 桥整段（`FlutterBridge` 类型、`getBridge`、`getFlutterPermission`、`requestFlutterPermission`、`sendFlutterNotification`）。

保留段落：L8 `NotificationPermissionStatus` 类型；L12-15 `NativeNotificationOptions` 接口；L77-119 Web 段（`getWebPermission`/`requestWebPermission`/`sendWebNotification`/`mapWebStatus`）；三个公开导出 `getNotificationPermission`/`requestNotificationPermission`/`sendNativeNotification`（签名不变——调用方 `apps/web/src/components/mini-apps/use-mini-app-host-api.tsx:15-19` import 三导出、`apps/web/src/app/workflows/share/page.tsx:14` import `sendNativeNotification`，均不改）。

### B. navigate.ts（`apps/web/src/lib/navigate.ts`，78 行）

L1 `import { isFlutterEnvironment, isNativeEnvironment } from './native-notification';` —— native-notification 删导出后此 import 必须同步删，**Step B 与 Step A 必须同一次提交内完成**，否则 typecheck 红。

L3-27 `nativeNavigate` 现逻辑：`isDev=true` 恒真 + Flutter local-assets 判定，`window.location` 静态跳转分支永不可达（Vite SPA 无静态导出）。L29-30 `tauriNavigate` 别名（`@deprecated`）。L32-77 `toStaticHref`（Next.js 静态导出 URL 改写，SPA 下无意义）。

`toStaticHref` 唯一调用方：`apps/web/src/components/workflow/workflow-node-execution-log.tsx:30` import + `:440` 调用：
```tsx
const href = toStaticHref(`/workflows/${workflowId}?executionLogId=${executionLogId}&preview=1`);
```
`tauriNavigate` 唯一调用方：`apps/web/src/components/home/login-form.tsx:18` import + `:49` `tauriNavigate(router, loginRedirectUrl(searchParams.toString()))`。
`nativeNavigate` 其余 4 个消费方（`workflow-editor-page-client.tsx:6`、`command-palette.tsx:46`、`workflow-card.tsx:11`、`workflows-page.tsx:25`）签名不变，零改动。

### C. theme-provider.tsx（`apps/web/src/components/layout/theme-provider.tsx`）

- L32-39：`declare global { interface Window { AgentSpacesStatusBar?: {...} } }` 整块删。
- L63：`window.AgentSpacesStatusBar?.setTheme(resolved);` 删。
- L81 inline script 字符串内片段 `if(window.AgentSpacesStatusBar){window.AgentSpacesStatusBar.setTheme(r)}` 删（位于 `m.content=...;` 之后、`var f=` 之前）。这是纯字符串编辑，tsc 不会校验——必须靠 build/grep 验收。
- `applyNativeTheme` 其余保留（meta theme-color 是 Web 功能）。

### D. viewport-insets.tsx（`apps/web/src/components/layout/viewport-insets.tsx`，94 行）

- L4 `import { isNativeEnvironment } from "@/lib/native-notification";` 删（A 删导出后必删）。
- L6-13 `declare global __agentSpacesNativeInsets` 删；L15-27 `getAndroidNativeTopInset`/`getAndroidNativeKeyboardInset` 删。
- `updateViewportInsets()`（L29-47）改：L32 `const topInset = getAndroidNativeTopInset();` 删；L37 `Math.max(visualKeyboardHeight, getAndroidNativeKeyboardInset())` → `visualKeyboardHeight`；L41 `Math.max(0, viewportHeight - topInset)` → `viewportHeight`（topInset 恒 0）；L46 `--app-top-inset` setProperty 行删（`apps/web/src/styles/globals.css:101` 已有 `--app-top-inset: 0px` 默认、`:214` 消费，CSS 兜底）。
- L80/L88 `flow-spaces-native-insets` 事件监听 add/remove 两行删。
- 组件本体保留（visualViewport 键盘高度是纯 Web 功能，`main.tsx:27` 挂载）。

### E. 注释清理（仅删一行，各一处）

- `apps/web/src/lib/auth.ts:65`：`// 不能经 toStaticHref —— 会拼出不存在的 /login.html。`（上一行"Vite SPA"注释保留）
- `apps/web/src/lib/sdk.ts:25`：`// 不能经 toStaticHref —— 会拼出不存在的 /login.html（同 lib/auth.ts 401 分支）。`（同上）
- `apps/web/src/components/sidebar-rail/SidebarRail.tsx:443`：`// 不能经 toStaticHref（会拼出不存在的 /login.html）。`（上一行保留）

### F. 文档同步（精确行内容规划时已验证）

- `claude/conventions.md:25-26`：`；\`i18n-workset.txt\` 为工作集清单` 尾巴删掉、audit 命令半句删掉 → 两行变为：
  ```
  - 文案源在 `apps/web/src/locales/{en,zh}/`。
  - 校验：`node scripts/check-locale-parity.mjs`（双语 key 对齐）。
  ```
- `claude/testing-and-quality.md:12`：`3. i18n：\`node scripts/check-locale-parity.mjs\`（en/zh key 对齐）+ 按需 \`audit-i18n-hardcode.mjs\`。` → 删 `+ 按需 \`audit-i18n-hardcode.mjs\``。
- `claude/file-map.md`：L8 `├── i18n-workset.txt        # i18n 翻译工作集清单` 删；L16 `│   ├── audit-i18n-hardcode.mjs` 删；L17 `│   ├── copy-closure.mjs / verify-copy.mjs   # 迁移期 closure 复制校验` 删。
- `apps/web/claude/faq.md:13`：`跑 \`scripts/check-locale-parity.mjs\`（缺 key 报错）与 \`scripts/audit-i18n-hardcode.mjs\`（硬编码审计）。` → `跑 \`scripts/check-locale-parity.mjs\`（缺 key 报错）。`
- `apps/web/claude/testing-and-quality.md:17`：`提交前跑根 \`scripts/check-locale-parity.mjs\` 与 \`scripts/audit-i18n-hardcode.mjs\`（硬编码文案审计）。` → 删 `与 \`scripts/audit-i18n-hardcode.mjs\`（硬编码文案审计）`。
- `claude/changelog.md`：顶部（现有 `## 2026-11-27 — 文件图标集精简 + 功能图谱重建` 之前）插入：
  ```markdown
  ## 2026-11-27 — agent-spaces 迁移残留清理

  - 删迁移期脚本：`scripts/copy-closure.mjs`、`scripts/verify-copy.mjs`（T2 复制校验，指向已废弃旧仓）与 `i18n-workset.txt`、`scripts/audit-i18n-hardcode.mjs`（i18n 硬编码审计退役，`check-locale-parity.mjs` 保留）。
  - web 删 Flutter/Tauri 原生壳残留：`native-notification.ts` 只留 Web 通知分支（公开导出签名不变）；`navigate.ts` 简化为纯客户端路由（删 `toStaticHref`/`tauriNavigate`，`login-form`/`workflow-node-execution-log` 调用点同步）；`theme-provider.tsx` 删 `AgentSpacesStatusBar` 桥；`viewport-insets.tsx` 删 `__agentSpacesNativeInsets` 读取（`--app-top-inset` 回落 CSS 默认 0）。
  - 文档同步：conventions / testing-and-quality / file-map / faq 移除退役脚本引用。
  ```

## Commands

```bash
# 全部从仓库根 E:\flow_spaces 执行
cd apps/web && npx tsc --noEmit -p tsconfig.web.json   # typecheck
node scripts/check-locale-parity.mjs                     # i18n parity
cd apps/web && npx vite build                            # build（~33s）
```

## Steps

> 顺序执行。Step 2（native-notification）与 Step 3（navigate）必须同批完成——navigate.ts:1 import 的两个符号在 Step 2 中被删，中途状态 typecheck 必红，属预期。

### Step 1 — 删迁移期文件与本地垃圾

```bash
git rm scripts/copy-closure.mjs scripts/verify-copy.mjs scripts/audit-i18n-hardcode.mjs i18n-workset.txt
rm .tmp/docs-audit-lifecycle.md .tmp/docs-audit-workflow.md apps/web/debug.log
```

（后三个是非跟踪文件，`rm` 即可；`.tmp/` 若因此变空则整个目录一起删。）

**Verify**: `git status --short` 显示 4 个 `D` 行；`ls .tmp` 与 `ls apps/web/debug.log` 报不存在。

### Step 2 — native-notification.ts 只留 Web 分支

按 Current state A 的清单删 Flutter/Tauri 段落，三个公开导出删 `if (isFlutterEnvironment())` 分支后直接 `return` Web 实现；头注释删 `- Flutter: ...` 一行。保留 `NativeNotificationOptions` 接口与 `sendNativeNotification` 的第三参（调用方可能传，Web 分支忽略之）。

**Verify**: 文件内 `grep -n "isFlutter\|isTauri\|isNative\|Flutter\|flutter" apps/web/src/lib/native-notification.ts` 无匹配；`export function` 恰好 3 个（get/request/send）。

### Step 3 — navigate.ts 简化 + 两个调用点

`nativeNavigate` 改为：
```ts
export function nativeNavigate(router: { push: (href: string) => void; replace: (href: string) => void }, href: string, replace = false) {
  if (replace) {
    router.replace(href);
  } else {
    router.push(href);
  }
}
```
删 L1 import、L29-30 `tauriNavigate`、L32-77 `toStaticHref`。然后：
- `login-form.tsx`: L18 `import { tauriNavigate }` → `import { nativeNavigate }`；L49 `tauriNavigate(router, ...)` → `nativeNavigate(router, ...)`。
- `workflow-node-execution-log.tsx`: L30 import 行删；L440 改为 `const href = \`/workflows/${workflowId}?executionLogId=${executionLogId}&preview=1\`;`

**Verify**: `grep -rn "tauriNavigate\|toStaticHref" apps/web/src` 仅剩 Step 5 要删的 3 行注释（auth.ts:65 / sdk.ts:25 / SidebarRail.tsx:443）。

### Step 4 — theme-provider.tsx 删状态栏桥

按 Current state C 删三处（declare global 块、L63 调用、L81 inline script 片段）。

**Verify**: `grep -n "AgentSpacesStatusBar" apps/web/src/components/layout/theme-provider.tsx` 无匹配。

### Step 5 — viewport-insets.tsx 删原生 insets + 三处注释

按 Current state D 改 `updateViewportInsets` 与事件监听；再删 auth.ts:65 / sdk.ts:25 / SidebarRail.tsx:443 三行"不能经 toStaticHref"注释。

**Verify**: `grep -n "agentSpaces\|isNative\|flow-spaces-native-insets" apps/web/src/components/layout/viewport-insets.tsx` 无匹配；`grep -rn "toStaticHref" apps/web/src` 完全无匹配。

### Step 6 — 文档同步

按 Current state F 精确修改 6 个文档文件 + changelog 插条目。

**Verify**: `grep -rn "i18n-workset\|audit-i18n-hardcode\|copy-closure\|verify-copy" claude apps/web/claude CLAUDE.md apps/web/CLAUDE.md` 无匹配（changelog 新条目除外——changelog 记录删除历史是允许的，grep 时排除 `claude/changelog.md`）。

### Step 7 — 全量验收

依次执行（见 Done criteria）。**git status 核对**：变更文件集合必须与本 plan 的 In-scope 清单完全一致，多一个文件都算越界。

## Done criteria（机器可查）

```bash
cd apps/web && npx tsc --noEmit -p tsconfig.web.json        # exit 0
node scripts/check-locale-parity.mjs                          # exit 0，28 命名空间 2956 键
cd apps/web && npx vite build                                 # exit 0
grep -rn "AgentSpacesStatusBar\|__agentSpacesNativeInsets\|isTauri\|tauriNavigate\|toStaticHref\|__flutterBridge\|__FLUTTER_INTERNALS__\|audit-i18n-hardcode\|copy-closure\|verify-copy\|i18n-workset\|sendAndroidOngoingWorkflowNotification" apps/web/src packages claude apps/web/CLAUDE.md scripts docs   # 无匹配（claude/changelog.md 的历史条目除外）
git status --short   # 变更集 = 本 plan In-scope 清单，无其他
```

最后一条 grep 的注意点：`isTauri`/`toStaticHref` 等词是精确的，不会误伤有意保留的 `AgentSpacesUI`/`AgentSpaces`/`AgentSpacesAPI` 别名；若 grep 报出的匹配落在 `claude/changelog.md`，那是本 plan 自己写入的历史记录，属预期——其余任何匹配都是失败。

## STOP conditions

- `git rev-parse --short HEAD` ≠ `d28d7b6` 或工作树非空 → STOP 上报（基线漂移）。
- typecheck 报的错不在本 plan 触碰的文件集合内 → STOP 上报（可能撞上并行改动）。
- 发现 `nativeNavigate`/`toStaticHref`/`tauriNavigate`/native-notification 导出存在 In-scope 之外的引用方 → STOP 上报，不要顺手改。
- grep 验收在 `packages/` 或 `docs/` 命中 `__flutterBridge` 等 → 查明是残留新证据，STOP 上报而不是扩大删除范围。

## Maintenance notes

- `window.AgentSpacesUI`/`AgentSpaces`/`AgentSpacesAPI` 别名仍有意保留（存量 mini-app 兜底）；将来清它们需先审计 flow-spaces-data 里 mini-app 的 `window.AgentSpaces*` 使用面。
- `--app-top-inset` CSS 变量从 JS 设置改为纯 CSS 默认值（globals.css:101 的 `0px`）；若将来要恢复 inset（如 PWA 停靠栏），改 globals.css 默认值即可。
- `sendNativeNotification` 第三参 `options` 目前 Web 分支忽略；若将来有 Web 端 tag/renotify 需求，直接在 `sendWebNotification` 内消费它。
- 评审关注点：inline script（theme-provider.tsx L81）是字符串编辑，typecheck 看不见——review 时必须肉眼或 grep 确认片段删净且字符串仍合法（build 会做兜底）。
