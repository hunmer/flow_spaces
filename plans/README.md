# Plans — 索引

| Plan | Title | Priority | Effort | Depends | Status |
|---|---|---|---|---|---|
| [001](001-agent-spaces-leftover-purge.md) | 删除 agent-spaces 迁移残留（迁移期脚本 / Flutter-Tauri 原生壳 / i18n 工作集） | P1 | M | — | DONE（2026-11-27 Lead 验收通过，未提交） |
| [002](002-codegraph-dead-functions.md) | 删除 CodeGraph 死代码扫描确认的 8 处死函数 | P2 | S | 001 | DONE（2026-11-27 Lead 验收通过，未提交） |
| [003](003-dedupe-shared-functions.md) | 重复函数提取为通用函数（sleep / formatDuration / walkTree / walkDir） | P2 | M | 002 | PLANNED（待用户批准执行） |

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

## Findings considered and rejected（有意保留，勿再审计）

- `window.AgentSpacesUI` / `AgentSpaces` / `AgentSpacesAPI` 兼容别名 —— 存量 mini-app 兜底（changelog 有记录）。
- `AGENT_SPACES_DATA_DIR` env 回退（json-store.ts）、`User-Agent 'AgentSpaces/1.0'` —— 运行时兼容串，非死代码。
- `main.tsx` 头部 Next→SPA 迁移对照注释、`docs/workflow/` 迁移文档 —— 架构记忆，有文档价值。
- `scripts/check-locale-parity.mjs`、`gen-feature-map.py`、`docs/feature_map.html/.json` —— 活工具/活产物。
- `node --test` 基线红 —— 依赖 flow-spaces-data 运行时数据（game-asset-canvas），与源码无关，不作为任何 plan 的验收 gate。
