# Plan 002: 删除 CodeGraph 死代码扫描确认的 8 处死函数

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: 低（全部为零调用死代码，rg 全仓唯一出现=定义行）
- **Planned at**: 工作树含 plan 001 未提交变更（基线 d28d7b6 + 001 执行结果）。执行前确认 `git status --short` 中已有 16 M + 4 D（plan 001 的变更集）存在；**不要动它们**。

## Why this matters

plan 001 清理之后，用 CodeGraph（SQLite 知识图谱，0 入边函数粗筛）+ rg 交叉验证（防图谱断链误报）扫出的第二批死代码。每处都经过双重验证：图谱零入边 + 全仓 rg 唯一出现是定义本身。

## Scope

**In-scope（10 个符号，8 个文件）**——删除目标，行号是删除时的锚点（同文件多处删除时按从下往上删，避免行号漂移）：

1. `packages/server/src/services/agent-commands.ts:91-96` — `function resolveCommandPath(agentId, name, group?)`
2. `packages/server/src/services/persistent-agent-context.ts:68-75` — `function buildInstructionFileContext(...)`（转发 wrapper；调用方已直接用 `buildInstructionFileContextFromFiles`）
3. `packages/server/src/adapters/langchain-runtime.ts:805-828` — `function summarizeStreamTokenForLog(...)`；**同时删除**同文件 208 行与 211 行两段**已注释掉的调用**（`// d(\`stream ai | ${summarizeStreamTokenForLog(...)}...\`)` 与 `// d(\`stream token skipped | ...\`)`）
4. `packages/server/src/services/execution-manager.ts:306-312` — `ExecutionManager` 类方法 `getRunningSessionCount()`
5. `packages/server/src/services/workflow.ts:33-35` — `function getLabel(node)`
6. `packages/server/src/services/hook-engine.ts:189-191` — `HookEngine` 类方法 `getHooks()`
7. `packages/server/src/services/workflow-trigger-service.ts:53-59` — `getHookConflicts(...)`；**同文件** `:61-63` — `getHookUrl(...)`
8. `packages/templates/generate-index.mjs:50-64` — `function listDirFiles(dir)`；**同文件** `:311-387` — `function writeZip(files, outPath)`（被替代的遗弃 helper，脚本现用 `collectDirFiles`）

删除时把函数**紧邻上方的 JSDoc/注释块**（若有）一并删除，不留孤儿注释。

**Out-of-scope**：
- 同文件里其他任何函数；`buildInstructionFileContextFromFiles`（活代码，保留）；`validateCron`（route 层有转发，活）；plan 001 已做的变更（保持原样）。
- 不新增代码，不做任何"顺手重构"。

## Commands

```bash
cd apps/web && npx tsc --noEmit -p tsconfig.web.json   # 前端 typecheck
cd packages/server && npx tsc --noEmit                 # server typecheck（若无独立 tsconfig 则跳过并记录）
node scripts/check-locale-parity.mjs
```

## Steps

### Step 1 — 删除 10 个死符号

按 In-scope 清单删（同文件多处的先删行号大的）。用 edit 工具按内容精确匹配删除；保持各文件原有行尾（**一律 LF**——若 edit 后 git diff 出现整文件行数暴涨，用 `perl -i -pe 's/\r\n/\n/' <file>` 归一，这是 plan 001 的已知坑）。

**Verify**: 每删完一个文件 `git diff --stat -- <file>` 确认变更行数与删除的函数体行数同量级（整文件重写=行尾污染，必须修）。

### Step 2 — server 侧类型检查

死方法删除后若 `ExecutionManager`/`HookEngine`/`WorkflowTriggerService` 的类被某个 interface/type 约束（如 `implements` 或依赖注入的 interface 引用了这些方法名），typecheck 会红。红了的处理：**STOP 并上报**（说明存在图谱没看到的接口契约），不要自行改接口定义——那属于范围扩张，需 Lead 裁决。

**Verify**: server typecheck 通过（或确认无独立 tsconfig 后用 `cd packages/server && npx tsc --noEmit -p tsconfig.json`，若项目没有该配置，改为跑 `pnpm typecheck` 并记录输出）。

### Step 3 — 全量验收

**Verify/Done criteria**:
```bash
# 1. 死符号清零（全部应无匹配）：
for s in resolveCommandPath buildInstructionFileContext summarizeStreamTokenForLog getRunningSessionCount getHookConflicts getHookUrl listDirFiles writeZip; do rg -n "\b$s\b" packages apps scripts && echo "FAIL $s"; done
# 例外：getLabel 与 getHooks 名字通用，允许在其他文件出现（只验 workflow.ts:33 与 hook-engine.ts:189 两处定义已消失）：
rg -n "function getLabel" packages/server/src/services/workflow.ts   # 应无匹配
rg -n "getHooks\(\)" packages/server/src/services/hook-engine.ts     # 应无匹配
# 2. typecheck / parity 绿
# 3. git status --short：相比执行前新增的 M 文件恰好 = In-scope 的 8 个文件
```

## STOP conditions

- server typecheck 报错且涉及被删方法名 → 接口契约存在，STOP 上报。
- rg 验证发现任何死符号存在 plan 未记录的引用方 → 误判，STOP 上报（不删）。
- 发现 `listDirFiles`/`writeZip` 在 generate-index.mjs 内被字符串/动态方式调用 → STOP 上报。

## Maintenance notes

- 这批由 CodeGraph 0-入边扫描 + rg 双验证产出；后续新增死代码疑点同法复扫（`.codegraph/codegraph.db` SQL + rg 交叉）。
- 重复函数分析（walk/formatDuration/sleep 等）另行输出，不在本 plan 范围。
