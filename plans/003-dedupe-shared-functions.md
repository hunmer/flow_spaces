# Plan 003: 重复函数提取为通用函数（sleep / formatDuration / walkTree / walkDir）

## Status

- **Priority**: P2
- **Effort**: M（纯行为等价重构，9 文件改 import + 2 新文件 + 删 ~13 处本地实现）
- **Risk**: 中低（逻辑不变；风险在调用方 import 路径与类型签名对齐）
- **Planned at**: 工作树含 plan 001/002 未提交变更。执行前 `git status --short` 应看到 001 的 16 M + 4 D 与 002 的 8 M；**不要动它们**。
- **前置**: 依赖 plan 002 先完成（避免同文件交叉编辑）。

## Why this matters

CodeGraph 同名函数扫描发现 `walk`×20（两族）、`formatDuration`×6、`sleep`×5 等跨文件重复。函数体比对后确认：`sleep` 5 处实现 100% 一致；`formatDuration` 中 2 对字面/逻辑重复；`walk` 的 FileNode 树遍历子族 7 处共享同一递归骨架（其中 chat-panel 与 agent-chat-ui 6 行**字面相同**）；server fs 遍历 5 处骨架相同过滤各异。散弹式重复的代价：改时长显示格式要改 6 个文件，漏一处就行为不一致。

## 重复函数分析结论（审计记录，执行者必读）

### 可以提取（本 plan 范围）
| 组 | 现状 | 提取为 |
|---|---|---|
| `sleep` server 侧 4 处 | 4 文件各 3 行，实现 100% 相同 | `packages/server/src/utils.ts` → `sleep(ms)` |
| `formatDuration` 群 A | message-item.tsx:314 与 workflow-executions-card.tsx:22 同为 h/m/s 阶梯（后者多 null 分支） | `apps/web/src/lib/format.ts` → `formatDurationHms(ms)` |
| `formatDuration` 群 C | workflow-execution-bar.tsx:66 与 workflow-node-types.ts:96 **5 行字面相同**（start/end→ms/s） | 同上文件 → `formatElapsedMs(start, end?)` |
| `walk` FileNode 子族 | editor-panel×4、agent-chat-utils、chat-panel、agent-chat-ui（后两者 6 行字面相同） | `apps/web/src/lib/tree.ts` → `walkTree` / `findTreeNode` 泛型版 |
| `visit` workflow 族 | workflow-clipboard.ts:9、workflow-canvas-references.ts:52、use-workflow-edge-operations.ts:444（WorkflowNode children 树） | 同上 `walkTree`（getChildren 抽象） |
| `walk` server fs 族 | external-import、search、skill×2、mini-app-store×2 骨架同/过滤各异 | `packages/server/src/utils.ts` → `walkDir(root, opts)` visitor 版 |

### 明确不提取（considered and rejected，防误改）
- `formatDuration` 群 B usage-dashboard-utils.ts:24（短时长 `0ms/3.2s/12m`，语义=调用量统计）与群 D display-node-views/utils.ts:70（**输入是秒**、`2:05` 倒计时格式）：名字撞车、语义不同，保留原地。
- `sleep` web 侧 stores/chat.ts:37 仅 1 处，无重复，保留（web/server 不共享运行时代码）。
- `walk` JSONContent 遍历 chat-input-utils.ts:18（TipTap 自有形状）、泛型 unknown 深遍历 share/page.tsx:64 与 workflow-node-execution-log.tsx:160：语义独异。
- `walk` 脚本侧：packages/templates/generate-index.mjs 3 处 + packages/sdk/scripts/fix-esm-extensions.mjs —— 独立 mjs 无法 import server TS util，脚本自包含惯例。
- React 惯例名 handle*/commit/submit/toggle/load/save/measure 等同名 handler：语义各异，非重复。

## Commands

```bash
cd apps/web && npx tsc --noEmit -p tsconfig.web.json
node scripts/check-locale-parity.mjs
rg -n "function sleep|function formatDuration|function walk|const walk =|function visit|const visit =" apps/web/src packages/server/src   # 本地定义应只剩豁免清单
```

## Steps

### Step 1 — 新建 `packages/server/src/utils.ts`
```ts
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function walkDir(
  root: string,
  opts: {
    skip?: (name: string, isDir: boolean) => boolean;
    visit: (fullPath: string, relPath: string, isDir: boolean) => void;
  },
): void {
  const recurse = (dir: string, prefix: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (opts.skip?.(entry.name, entry.isDirectory())) continue;
      const fullPath = join(dir, entry.name);
      const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      opts.visit(fullPath, relPath, entry.isDirectory());
      if (entry.isDirectory()) recurse(fullPath, relPath);
    }
  };
  recurse(root, '');
}
```
（形态以实际迁移对齐为准；如果 skill.ts 的两处需要返回数组，用 visit 收集适配。）

### Step 2 — server 侧迁移 sleep + walkDir
1. 删本地 sleep + 加 import：`packages/server/src/services/builtin-tools/mini-app-tools.ts:425`、`builtin-tools/workflow-editor/helpers.ts:155`、`builtin-tools/workflow-exec-tools.ts:614`、`services/execution-manager.ts:2422`。
2. `external-import.ts:322` 的 walk（skip=dot 开头）→ `walkDir(dir, { skip: (name) => name.startsWith('.'), visit })`。
3. `skill.ts:403/454` 两处 → visit 收集进数组。
4. `mini-app-store.ts:300/371` 两处 → walkDir（skip=MANIFEST_SKIP_DIRS 只对目录）。
5. `search.ts:110`（45 行大户）→ **先通读 110-155 再迁移**：若 walk 内还有 scoring/短路逻辑，把可迁移的骨架部分用 walkDir 表达，业务逻辑留在调用方；若形态不合（如需返回值短路），**允许放弃此文件并在报告注明**，不硬凑。

### Step 3 — 新建 `apps/web/src/lib/format.ts`
```ts
export function formatDurationHms(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
export function formatElapsedMs(start: number, end?: number): string {
  const ms = Math.max(0, (end || Date.now()) - start);
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
```
迁移调用方（删本地函数+加 import，调用点零改动）：
- message-item.tsx:314 → formatDurationHms
- workflow-executions-card.tsx:22 → formatDurationHms（其 `ms?: number` null 检查留在调用点：`if (!ms || ms < 0) return null; formatDurationHms(ms)`）
- workflow-execution-bar.tsx:66 与 workflow-node-types.ts:96 → formatElapsedMs（注意保持 export 转发或直接改所有 import 方；**先 rg 这两个函数的 import 方数量再定**：若被外部 import，保留 `export { formatDuration } from ...` 转发别名更稳）

### Step 4 — 新建 `apps/web/src/lib/tree.ts` + 迁移
```ts
export function walkTree<T>(
  nodes: T[] | undefined,
  getChildren: (node: T) => T[] | undefined,
  visit: (node: T) => void,
): void {
  for (const node of nodes ?? []) {
    visit(node);
    const children = getChildren(node);
    if (children) walkTree(children, getChildren, visit);
  }
}
export function findTreeNode<T>(
  nodes: T[] | undefined,
  getChildren: (node: T) => T[] | undefined,
  pred: (node: T) => boolean,
): T | undefined {
  for (const node of nodes ?? []) {
    if (pred(node)) return node;
    const found = findTreeNode(getChildren(node), getChildren, pred);
    if (found) return found;
  }
  return undefined;
}
```
迁移（逐文件删本地 walk/visit 闭包，换 walkTree 调用）：
- editor-panel.tsx 4 处（81 目录路径收集、95 size map、109 files 收集、504 find→findTreeNode）
- agent-chat-utils.ts:93（files 收集）
- chat-panel.tsx:547 与 agent-chat-ui.tsx:171（字面相同的搜索对，统一 walkTree + push）
- workflow-clipboard.ts:9、workflow-canvas-references.ts:52、use-workflow-edge-operations.ts:444（children 取法按各文件 WorkflowNode 形状）
**注意**：editor-panel 81 处的原版是"先 visit 目录再递归"顺序，walkTree 也是先 visit 再递归——顺序一致；但 95/109 版本 visit 在 children 判断前（file 节点）——getChildren 返回 node.children 即可等价。逐处核对"visit 发生在进入 children 前"语义不反转。

### Step 6 — 002 遗留顺手项（两项）
1. packages/server/claude/architecture.md:121 附近：删除对已不存在的 `getHookConflicts` 的文档描述行（plan 002 遗留，仅文档）。
2. packages/templates/generate-index.mjs import 行：删去 unused 成员 `deflateRawSync`/`crc32`（`inflateRawSync` 253 行仍用，保留该成员与 import 行本身）。

**Verify**: `rg -n "getHookConflicts" packages/server/claude` → 0；`rg -n "deflateRawSync|crc32" packages/templates/generate-index.mjs` → 0。

### Step 7 — 验收
1. typecheck 绿（无**新增**错误——工作树既有 usage-period-chart-card.tsx 3 错是用户并行开发，非本任务）。
2. `rg -n "function sleep|const sleep" packages/server/src` → 0 匹配（utils.ts 定义除外）。
3. `rg -n "function formatDuration" apps/web/src` → 只剩豁免 2 处（usage-dashboard-utils、display-node-views/utils）。
4. `rg -n "const walk =|function walk\(" apps/web/src/components` → 只剩豁免 3 处（chat-input-utils、share/page、workflow-node-execution-log）。
5. `git status --short` 新增文件 = utils.ts ×2 + format.ts + tree.ts + 迁移的 M 文件集，无删除。
6. vite build 通过（`cd apps/web && npx vite build`）。

## STOP conditions
- search.ts:110 的 walk 形态与 visitor 不匹配（短路/返回值依赖）→ 跳过该文件并报告，不硬改。
- 任何迁移点行为语义存疑（visit 顺序、null 处理差异）→ 停下记录疑问，报告 Lead 裁决。
- typecheck 出现涉及迁移文件的新错误且无法在 10 分钟内定位 → STOP 上报。

## Maintenance notes
- walkTree 泛型版今后新组件优先复用，避免再长出第 21 个 walk。
- format.ts 若后续新增时长格式（如 formatDurationHms 的 i18n 版本），集中此文件。
