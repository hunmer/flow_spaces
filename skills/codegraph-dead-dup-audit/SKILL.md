# CodeGraph 死函数/重复函数审计

## 何时使用

- 重构前审计：找全仓重复定义的同名/同形态函数，评估可提取性。
- 死代码清理：确认函数零引用后安全删除。
- 提取共享 util 前的调用方普查与"行为等价"验证。

## 前置

- 项目需有 `.codegraph/` 索引（本仓已建）。无索引先 `codegraph init`；索引存在但失效时用 rg 代替。
- 主工具 `codegraph_explore`：query 传符号名/文件名/自然语言问题，一次返回相关符号的**逐行源码 + 符号间调用路径 + 爆炸半径**。projectPath 传项目根（本仓 `E:\flow_spaces`）。
- codegraph 返回的是索引快照，交叉验证必须用 `rg`（文本级，能覆盖字符串/动态引用）。

## 流程 A：死函数检查

1. `codegraph_explore` query="函数名" → 看返回的调用路径里除了定义处还有谁引用。
2. 文本交叉验证（必做）：`rg -n "函数名" <scope>`。仅命中定义行 = 候选死函数。
3. 导出函数需查包外消费者：rg 该导出名在整个消费方 tsconfig 范围（如 packages/sdk、apps/web 消费 packages/*）。
4. 删除后断言：`rg -n "函数名" src` 应为 0；顺手清掉文档/claude 索引里的残留提及（md 文件 rg 一遍）。
5. 双侧 typecheck 收尾：`cd apps/web && npx tsc --noEmit -p tsconfig.web.json`；`cd packages/server && npx tsc --noEmit`。

## 流程 B：重复函数检查（plan-003 实战提炼）

1. **全仓普查分布**：`rg -n "function <name>|const <name> =" src packages` 列出所有定义点。
2. **逐处拉形态**：`codegraph_explore` query="<name> 各所在文件名" 拉源码+调用路径，比对签名、输出格式、null/边界语义、闭包与 IO 依赖。
3. **形态判别（提取可行性的关键判据）**：
   - ✅ 纯 visitor（visit 无返回值、无短路、同步）→ 可抽 walkDir/walkTree 类
   - ❌ map 语义（visit 返回新值重建结构，返回值依赖）→ 不抽
   - ❌ 短路 / 计数上限 / early-return 依赖遍历返回值 → 不抽
   - ❌ async IO 内嵌遍历体（await readdir/stat）→ 同步 visitor 无法等价，不抽
   - ❌ 泛型 unknown 深遍历（string/array/object 三分支）→ 语义独异不抽
   - ❌ 图遍历（环检测、visited Set）→ 非树不抽
   - 判据出处：plan-003 中 workflow-clipboard:9（map）、search.ts:110（async+短路）、workflow-canvas-references:52（unknown 深遍历）、use-workflow-edge-operations:444（图环检测）四处均因此放弃。
4. **提取时行为等价红线**：递归条件逐处核对（同仓同名函数会有"仅目录递归"vs"有 children 就递归"两种原形态，都要原样保留进各自 getChildren）；visit 顺序（先 visit 后 recurse vs 边判断边 recurse）逐处比对。
5. **外部 import 方保稳**：被外部 import 的导出函数改转发 `export { newFn as oldName } from './util'`，import 方零改动。
6. **迁移后断言组**：
   ```bash
   rg -n "function sleep|const sleep" packages/server/src        # 定义只剩 util 文件
   rg -n "function formatDuration" apps/web/src                   # 只剩豁免清单
   rg -c "const walk =|function walk\(" apps/web/src              # 恰为豁免数
   node scripts/check-locale-parity.mjs                           # 若动了文案
   cd apps/web && npx vite build                                  # 生产构建兜底
   ```

## 本仓已知坑

- **行尾混合仓库**：DSH edit 工具把整文件写成 CRLF；仓库 blob 多数 LF，但**个别文件本身是 CRLF**（editor-panel.tsx、builtin-tools/mini-app-tools.ts）。每个文件 edit 完必须 `git diff --stat -- <file>` 看行数：
  - 行数≈预期改动 → 无事；
  - 行数≈整文件 → 判定行尾被改写：`git show HEAD:<file> | rg -c $'\r'` 查 HEAD 行尾，**跟随 HEAD**（LF blob 用 `perl -i -pe 's/\r\n/\n/' <file>`，CRLF blob 反向 `s/\n/\r\n/`），重新 add 后复查 diff 行数。
  - 提交前终检：`git diff --cached --check` + 逐文件 `rg -q $'\r'`（CRLF 文件的 trailing-whitespace 报警属预期，其余文件必须 0）。
- rg pattern 含括号时用单引号包裹，避免 shell 转义问题。
- 既有错误甄别：typecheck 报错先 `git stash` 前后对比或 rg 定位是否并行开发引入（plan 里应预先声明既有错误清单，不算新增）。

## 产出要求

- 放弃项必须逐处记录"文件:行号 + 形态证据 + 判据条款"，交 Lead 裁决，不硬凑。
- 交付报告含：新建 util 签名 / 迁移清单（每处一行）/ 放弃项及原因 / 验收输出摘要 / git status 全文。
