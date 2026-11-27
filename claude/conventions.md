# 根目录开发约定

## 常用命令（pnpm workspace）

| 命令 | 作用 |
|---|---|
| `pnpm dev` | web dev server（5173，代理到 server 3110） |
| `pnpm dev:server` | server watch 模式（tsx watch src/app.ts） |
| `pnpm dev:all` | build:packages 后并行起 server + web |
| `pnpm build` | build:packages（shared→sdk）再 build web |
| `pnpm build:packages` | 仅构建 shared + sdk |
| `pnpm typecheck` | web 双 tsconfig 类型检查 |

- 长期进程用 procm 管理：`procm-commands.json` 已登记 dev/dev:server/build/build:packages/preview/typecheck。
- 改 shared/sdk 代码后必须 `pnpm build:packages`，否则下游引用旧 dist。

## 仓库级规则（AGENTS.md 摘要）

- 最小改动优先；重大歧义先澄清；多用代码测试少开浏览器。
- 搜代码用 rg / grep / CodeGraph（**索引未建**，需要时先 `codegraph init`）。
- 输出始终简体中文。

## i18n 流程

- 文案源在 `apps/web/src/locales/{en,zh}/`；`i18n-workset.txt` 为工作集清单。
- 校验：`node scripts/check-locale-parity.mjs`（双语 key 对齐）、`node scripts/audit-i18n-hardcode.mjs`（硬编码审计）。

## Git 边界（.gitignore 要点）

- flow-spaces-data 的 `plugins/`、`workflows/`、`mini-apps/` **整目录不入库**（拆分到独立商店仓库，见 `.gitignore` 顶部注释：flow-spaces-plugins / flow-spaces-workflows / flow-spaces-mini-apps）。
- 不入库：`packages/server/flow-spaces-data/llm/providers.json`、`packages/server/public/uploads/*`、`packages/logs/`（server 运行日志，`app.ts` `__logDir` 运行时生成）、`.review/`、`*.tsbuildinfo`、`dist/`。
- `flow-spaces-data/` 的种子数据（agent-templates、llm、workspaces 注册表、uploads、sqlite 库）**是**入库的——修改时勿越界到被忽略的运行时目录。

## 商店内容边界（拆仓后）

- `packages/templates/` 只维护 agents/mcps/skills/output-styles/prompt/skillspackage；**不要**在本地新增 plugins/mini-app/workflows 商店内容——它们属于独立仓库（hunmer/flow-spaces-plugins 等）。
- web 端商店路由唯一入口 `apps/web/src/lib/agent-store.ts`：新增商店分类时扩 `REPO_ROUTES`；自定义镜像经 localStorage `flow-spaces:store-api-base`。
- 修改 templates 内容后跑 `pnpm --filter @flow-spaces/agents build`（generate-index.mjs）重生成 index.json。

## 禁止事项

- 不手改生成物：`packages/templates/*/index.json`（generate-index.mjs 生成）、`apps/web/public/monaco/`。
- `scripts/gen-feature-map.py` 仍可运行，但其产物（docs/feature_map.*）已不随仓分发，勿提交生成物。
- 不主动执行 git 提交/分支/reset。
