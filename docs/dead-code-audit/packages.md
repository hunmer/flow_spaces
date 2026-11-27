# packages/sdk · packages/shared · packages/templates · scripts/docs 死代码审计

> 审计人：audit-packages（team_mwyqzz3g7j480）· 2026-11-27
> 方法：以"当前仓内代码（apps/web/src、packages/server/src、packages/sdk/src）是否消费"为准。sdk/shared 为 npm 发布包，本仓未消费 ≠ 判死，仅标记。
> 搜索基准：rg/grep 全文匹配符号名，0 命中 = 在 apps/web/src、packages/server/src、packages/sdk/src（排除 packages/shared 自身）中无引用。

## A 高置信可删（包内未被本仓消费 / 失效产物）

### A1. packages/sdk —— 7 个模块在本仓 0 消费

证据：`grep -rE "sdk\.<module>" apps/web/src packages/server/src` 全部 0 命中；且 barrel `packages/sdk/src/index.ts` 的 `create*Api` 除 `createSDK`/`ApiError` 外无外部 import（全仓仅 `import { createSDK }`、`import { ApiError }` 及 type 导入）。

| 模块文件 | 搜索关键字 | 命中 | 备注 |
|---|---|---|---|
| packages/sdk/src/modules/notification.ts | `sdk.notification` | 0 | apps/web 的 notificationApi 是 `use-mini-app-host-api.tsx` 本地对象，与 sdk 无关；shared 的 notification 类型另有 16 处命中，勿混淆 |
| packages/sdk/src/modules/tools.ts | `sdk.tools` | 0 | — |
| packages/sdk/src/modules/account.ts | `sdk.account` | 0 | — |
| packages/sdk/src/modules/agent-store.ts | `sdk.agentStore` | 0 | 商店路由走 `apps/web/src/lib/agent-store.ts`（直连 GitHub raw），不经 sdk |
| packages/sdk/src/modules/font.ts | `sdk.font` | 0 | — |
| packages/sdk/src/modules/inspector.ts | `sdk.inspector` | 0 | — |
| packages/sdk/src/modules/avatar.ts | `sdk.avatar` | 0 | — |

其余 17 个模块均有消费（miniApp 87 行/20 文件、workflow 43/9、agent 28/12、chat 30/2、editor 24/5、sqlite 25/4、workflowPlugin 19/1、skills 14/3、channel 13/4、llm 11/4、knowledgeBase 12/5、workspace 6/5、mcps 6/1、search 3/3、externalImport 2/1、agentCommands 1/1、auth 1/1）。
⚠️ 以上 7 个模块为发布包对外 API，若外部用户在用则不可删——结论为"包内未被本仓消费"，删除需先确认 npm 无下游。

### A2. packages/shared —— 4 个类型域全量导出 0 命中

对文件全部 export 符号逐一 grep，均 0 命中：

| 类型域文件 | 搜索关键字（全导出） | 命中 | 备注 |
|---|---|---|---|
| packages/shared/src/types/speech.ts | SpeechRecognitionProvider / SpeechRecognitionConfig / SpeechRecognitionResult / TencentSpeechCredentials | 全 0 | 疑似旧语音识别功能遗留 |
| packages/shared/src/types/subscription.ts | SubscriptionProvider / SubscriptionConfig / SubscriptionQuota / SubscriptionLimit | 全 0 | 订阅功能遗留 |
| packages/shared/src/types/worktree.ts | WorktreeInfo / WorktreeStatus / CreateWorktreeInput | 全 0 | git worktree 功能遗留 |
| packages/shared/src/types/workflow-shortcut.ts | ShortcutGroup / ShortcutAction / ShortcutBinding / SHORTCUT_GROUPS / SHORTCUT_ACTIONS / getMergedBindings | 全 0 | 快捷键契约遗留 |

同样受"发布包对外 API"豁免保护，不直接判死。

### A3. scripts/ 生成产物

| 文件 | 证据 | 备注 |
|---|---|---|
| scripts/copy-report.txt | 根 package.json / procm-commands.json 均不引用；仅 docs/feature_map.* 提及文件名 | `copy-closure.mjs` 的运行输出产物，可随产物清理 |

## B 疑似（低置信 / 仅部分失效）

| 项目 | 证据 | 备注 |
|---|---|---|
| packages/shared/src/types/workflow-ws.ts 中约 60 个 WS 请求/响应契约类型 | WorkflowListRequest / WorkflowCreateRequest / Dashboard* / Plugin*Request / WSIncomingMessage / WSOutgoingMessage / WSClientHello / WSServerHello / ChannelContract 等全 0 命中 | 同文件内 InteractionRequest(20)、InteractionResponse(19)、ClientNodeRequest(12)、ClientNodeResponse(14) 仍被消费，**整文件不可删**，仅契约类型段疑似过时（REST 化后遗留） |
| scripts/*.mjs、scripts/gen-feature-map.py（5 个脚本） | 根 package.json scripts 与 procm-commands.json 均未接入；仅被 claude/*.md、docs/feature_map.* 文档提及 | 属"工具脚本未接线"而非死代码，audit-i18n-hardcode / check-locale-parity / copy-closure / verify-copy / gen-feature-map 保留 |
| docs/workflow/ 9 篇中引用的 packages/templates/plugins/* 路径 | `plugins/`、`plugins/aliyun_oss`、`plugins/custom-view-demo`、`plugins/feed-parser`、`plugins/mira-sdk`、`packages/web`(旧路径) 等 6 个引用目标已不存在 | 2026-11 商店拆仓后文档未同步；是文档过期而非文件死亡 |
| packages/templates/skills/references | 目录项存在但 readdir 报 ENOENT（悬空目录/junction，Windows 上不可读） | 不在 skills/index.json 中；建议删除或修复 |
| packages/sdk/demo/（19 个 HTML 页 + css/js） | 仅被 packages/sdk/demo/README.md、demo/index.html 及根 CLAUDE.md、docs/feature_map.* 文档性提及；未被 apps/web / vite.config / server 挂载或打包 | 演示页（统计级别：19 html，根 CLAU.md 记 41 与实际不符）；自包含演示资产，非运行时依赖 |

## C 排除的误报与统计

### C1. templates 索引完整性（抽样+全量核对，全部健康）

| 目录 | 索引条目 | 正向（索引→文件） | 反向（文件→索引） |
|---|---|---|---|
| packages/templates/agents | 185 | 全量 185/185 存在（抽样 10 全过） | 孤儿 0（叶子按去扩展名比对） |
| packages/templates/mcps | 9 | 9/9 存在 | 9 文件全部入索引（除 index.json） |
| packages/templates/skills | 22 | 22/22 存在 | 孤儿 0（planning-with-files、superpowers 为嵌套 bundle，子路径均在索引中） |
| packages/templates/output-styles | 7 | 7/7 存在 | — |
| packages/templates/prompt | 2 | 2/2 存在 | — |
| packages/templates/skillspackage | 16 | 16/16 zip 存在（zipUrl 全部命中本地 zip） | — |

templates 内容文件均为活跃内容源，无一列为死代码。

### C2. 排除的误报

- **npm 公共包对外 API**：sdk 7 个未消费模块、shared 4 个零命中域均为发布包导出面，外部用户可能消费，只标记不判死。
- **shared 其余 22 个类型域**均有消费（channel 1569、workspace 734、issue 84、agent 77、workflow 74、tool 75、knowledge-base 96 等）。
- **packages/shared/src/index.ts**：barrel，非死文件。
- **docs/workflow/ 9 篇文档本身**：内容仍被 claude/ 与 feature_map 引用，仅个别路径引用过期（见 B），不判死。
- **scripts/ 5 个脚本**：文档级引用存在，属未接线工具，不判死（copy-report.txt 除外）。

### C3. 统计

- A 档：7 个 sdk 模块 + 4 个 shared 类型域 + 1 个生成产物（copy-report.txt）= **12 项**
- B 档：workflow-ws 契约类型段、5 个未接线脚本、docs/workflow 过期路径引用、skills/references 悬空目录、sdk/demo 19 页 = **5 项**
- C 档（误报排除/健康）：6 个 templates 目录索引双向核对通过、22 个 shared 域有消费、17 个 sdk 模块有消费、docs 与 scripts 文档引用成立
- 未修改任何源码文件；本报告为唯一写入文件。
