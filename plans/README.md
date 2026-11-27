# Plans — 索引

| Plan | Title | Priority | Effort | Depends | Status |
|---|---|---|---|---|---|
| [001](001-agent-spaces-leftover-purge.md) | 删除 agent-spaces 迁移残留（迁移期脚本 / Flutter-Tauri 原生壳 / i18n 工作集） | P1 | M | — | DONE（2026-11-27 Lead 验收通过，未提交） |
| [002](002-codegraph-dead-functions.md) | 删除 CodeGraph 死代码扫描确认的 8 处死函数 | P2 | S | 001 | DONE（2026-11-27 Lead 验收通过，未提交） |
| [003](003-dedupe-shared-functions.md) | 重复函数提取为通用函数（sleep / formatDuration / walkTree / walkDir） | P2 | M | 002 | DONE（2026-11-27 已提交 0bba3d7；skill 沉淀 806c29f） |

基线 commit `d28d7b6`（2026-11-27）。执行者按 plan 内 Done criteria 机器化验收。

## 001 执行记录（2026-11-27）

- 执行者：dsh-team 成员 executor（zai-coding-cn / glm-5.3 / max）；变更集 = In-scope 15 M + 4 D 精确一致，未提交。
- Lead 审查：逐 hunk 核对 diff 全部符合 plan；修复了执行者引入的 CRLF 行尾污染（8 文件，`perl -i -pe 's/\r\n/\n/'` 归一，diff 从 1887 行假 diff 恢复 20+/221-）。
- 验收：parity ✅（28 ns / 2956 键）、vite build ✅（33.59s）、grep 词表 ✅（仅剩 changelog 历史条目）；typecheck 因**用户并行 dashboard 开发**（untracked usage-period-chart-card.tsx 等）报 3 错，与本清理零关系，in-scope 文件干净。
- 计划外补充（Lead 审查发现）：scripts/gen-feature-map.py:66 infra.scripts 正则死分支 `i18n-workset\.txt$|` 已由一次性 subagent 删除（dsh 收尾任务因 sidecar 连续 4 次重启抖动、attempts 3/3 烧尽而 abort，改道 host 级 subagent 完成）。
- 豁免（勿再审计）：docs/feature_map.json/html 对 4 个已删文件的 path 快照（图谱产物数据，行数统计本就全面滞后，下次跑 gen-feature-map.py 重建自动消化）；claude/changelog.md 历史条目。

## 002 执行记录（2026-11-27）

- 执行者：host 级一次性 subagent dead-code-purge；变更集 = 8 文件 -169 行纯删除、0 插入，与 In-scope 精确一致，未提交。
- 基线变化：用户已提交 plan 001 变更（e76b0d5 / 0240d7b "fix"），同时 dashboard 并行开发组件已处理，typecheck 基线恢复全绿。
- Lead 复核：逐 hunk 审查通过；执行者两处合理裁量——①langchain-runtime.ts 207-211 注释块整删（只删调用会留孤儿 `// if {...}` `// }`）②generate-index.mjs listDirFiles 上方 2 行说明注释一并删。行尾 CRLF 坑再次复现（8 文件），执行者已按红线 perl 归一，Lead 复查 diff 干净。
- Lead 复跑验收：web tsc ✅ / server tsc ✅ / parity ✅（28 ns 2956 键）/ 死符号 rg 零匹配。
- 遗留（不阻塞）：①packages/server/claude/architecture.md:121 的 getHookConflicts 文档描述（非代码引用，归入 003 顺手同步）②generate-index.mjs 的 deflateRawSync/crc32 unused import 成员（inflateRawSync:253 仍用，import 行活；.mjs 无 tsc 约束，归入 003）。

## 003 执行记录（2026-11-27）

- 执行者：host 级一次性 subagent dedupe-extract；交付 3 个新 util（`packages/server/src/utils.ts` 的 sleep+walkDir、`apps/web/src/lib/format.ts` 的 formatDurationHms+formatElapsedMs、`apps/web/src/lib/tree.ts` 的 walkTree+findTreeNode）+ 20 处调用方迁移 + 2 个 002 遗留顺手项（architecture.md 文档同步、generate-index.mjs import 收敛），净 -88 行。
- Lead 审查：editor-panel 4 处 walk 迁移的 visit 过滤/getChildren 递归限制逐一核验等价；message-item 格式分支逐档验算（5s/1m 30s/1h 0m）；workflow-node-types 与 helpers 用转发别名保外部 import 方零改动；chat-panel/agent-chat-ui 字面重复对收敛。CRLF 坑第三次复现（3 文件），执行者当场 perl 归一。
- Lead 复跑验收：web tsc ✅ / server tsc ✅ / parity ✅（28 ns 2956 键）/ rg 豁免清单零残留 / vite build ✅ 34.08s。
- 提交：执行者提交 `0bba3d7`（20 files +170/-194），并把审计方法论沉淀为 [skills/codegraph-dead-dup-audit/SKILL.md](../skills/codegraph-dead-dup-audit/SKILL.md)（`806c29f`，58 行：死函数三步法、重复函数六判据、行为等价红线、转发保稳、提交前终检清单）。
- **行尾坑最终裁决（修正此前标准修法）**：本仓行尾**混合**——editor-panel.tsx 与 mini-app-tools.ts 的 HEAD blob 本身是 CRLF，其余为 LF。此前"perl 一律转 LF"的归一策略对这两文件制造 2000+ 行假 diff（plan 001/002 期间碰巧正确是因为当时涉及文件 HEAD 全是 LF）。**正确策略：归一前先比对 HEAD blob 行尾，跟随各文件既有行尾**（`git show HEAD:<file> | od -c | head -1` 快速判定）。建议后续用 .gitattributes 或 editorconfig 统一，消除混合根源。
- **4 处放弃（执行者形态裁决，Lead 追认）**：①search.ts:110 的 walk 是 async+短路（results.length>=maxResults）+IO 内嵌，同步 visitor 无法等价表达——**同时纠正了 plan 003 前置审计的误判**：②workflow-clipboard.ts:9 是 map 语义（返回新值重建结构）③workflow-canvas-references.ts:52 是 unknown 深遍历（与 share/page 同形态）④use-workflow-edge-operations.ts:444 是 edge 图 DFS 环检测——三处均非 plan 描述的"children 树遍历"，保持原样。教训：plan 只看行数/名字归类的形态判断必须经函数体比对复核。
- 净效果：server 4 sleep→1、web 4 formatDuration→2 群收敛、FileNode 树遍历 7 处→2 个泛型、fs 遍历 5 处→1 visitor。

## Findings considered and rejected（有意保留，勿再审计）

### agent-spaces 清理（001 轮）

- `window.AgentSpacesUI` / `AgentSpaces` / `AgentSpacesAPI` 兼容别名 —— 存量 mini-app 兜底（changelog 有记录）。
- `AGENT_SPACES_DATA_DIR` env 回退（json-store.ts）、`User-Agent 'AgentSpaces/1.0'` —— 运行时兼容串，非死代码。
- `main.tsx` 头部 Next→SPA 迁移对照注释、`docs/workflow/` 迁移文档 —— 架构记忆，有文档价值。
- `scripts/check-locale-parity.mjs`、`gen-feature-map.py`、`docs/feature_map.html/.json` —— 活工具/活产物。
- `node --test` 基线红 —— 依赖 flow-spaces-data 运行时数据（game-asset-canvas），与源码无关，不作为任何 plan 的验收 gate。

### 重复函数豁免（003 轮，勿再审计）
- `search.ts:110` walk —— async+短路+IO 内嵌，非同步 visitor 可表达。
- `workflow-clipboard.ts:9` / `workflow-canvas-references.ts:52` / `use-workflow-edge-operations.ts:444` —— map 语义 / unknown 深遍历 / DFS 环检测，非树遍历。
- `usage-dashboard-utils.ts:24`、`display-node-views/utils.ts:70` formatDuration —— 语义独异（短时长统计 / 秒倒计时 2:05）。
- `stores/chat.ts:37` sleep —— web 侧单例无重复；`generate-index.mjs`/`fix-esm-extensions.mjs` walk —— 独立 mjs 脚本自包含。
- React 惯例名 handler（handle*/commit/submit/toggle/load/save/measure）—— 语义各异非重复。
