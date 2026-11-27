# Plans — 索引

| Plan | Title | Priority | Effort | Depends | Status |
|---|---|---|---|---|---|
| [001](001-agent-spaces-leftover-purge.md) | 删除 agent-spaces 迁移残留（迁移期脚本 / Flutter-Tauri 原生壳 / i18n 工作集） | P1 | M | — | DONE（2026-11-27 Lead 验收通过，未提交） |

基线 commit `d28d7b6`（2026-11-27）。执行者按 plan 内 Done criteria 机器化验收。

## 001 执行记录（2026-11-27）

- 执行者：dsh-team 成员 executor（zai-coding-cn / glm-5.3 / max）；变更集 = In-scope 15 M + 4 D 精确一致，未提交。
- Lead 审查：逐 hunk 核对 diff 全部符合 plan；修复了执行者引入的 CRLF 行尾污染（8 文件，`perl -i -pe 's/\r\n/\n/'` 归一，diff 从 1887 行假 diff 恢复 20+/221-）。
- 验收：parity ✅（28 ns / 2956 键）、vite build ✅（33.59s）、grep 词表 ✅（仅剩 changelog 历史条目）；typecheck 因**用户并行 dashboard 开发**（untracked usage-period-chart-card.tsx 等）报 3 错，与本清理零关系，in-scope 文件干净。
- 计划外补充（Lead 审查发现）：scripts/gen-feature-map.py:66 infra.scripts 正则死分支 `i18n-workset\.txt$|` 已由一次性 subagent 删除（dsh 收尾任务因 sidecar 连续 4 次重启抖动、attempts 3/3 烧尽而 abort，改道 host 级 subagent 完成）。
- 豁免（勿再审计）：docs/feature_map.json/html 对 4 个已删文件的 path 快照（图谱产物数据，行数统计本就全面滞后，下次跑 gen-feature-map.py 重建自动消化）；claude/changelog.md 历史条目。

## Findings considered and rejected（有意保留，勿再审计）

- `window.AgentSpacesUI` / `AgentSpaces` / `AgentSpacesAPI` 兼容别名 —— 存量 mini-app 兜底（changelog 有记录）。
- `AGENT_SPACES_DATA_DIR` env 回退（json-store.ts）、`User-Agent 'AgentSpaces/1.0'` —— 运行时兼容串，非死代码。
- `main.tsx` 头部 Next→SPA 迁移对照注释、`docs/workflow/` 迁移文档 —— 架构记忆，有文档价值。
- `scripts/check-locale-parity.mjs`、`gen-feature-map.py`、`docs/feature_map.html/.json` —— 活工具/活产物。
- `node --test` 基线红 —— 依赖 flow-spaces-data 运行时数据（game-asset-canvas），与源码无关，不作为任何 plan 的验收 gate。
