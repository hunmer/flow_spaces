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
- 搜代码用 CodeGraph（.codegraph 索引已建）/ fff / rg。
- 输出始终简体中文。

## i18n 流程

- 文案源在 `apps/web/src/locales/{en,zh}/`；`i18n-workset.txt` 为工作集清单。
- 校验：`node scripts/check-locale-parity.mjs`（双语 key 对齐）、`node scripts/audit-i18n-hardcode.mjs`（硬编码审计）。

## Git 边界（.gitignore 要点）

- 不入库：`packages/server/flow-spaces-data/workflows/*/execution_history|versions/`、`mini-apps/*/data|configs/`、`packages/logs/`、`.review/`、`*.tsbuildinfo`、`dist/`。
- `flow-spaces-data/` 的 manifest/src 本体**是**入库的——修改时勿越界到被忽略的运行时数据目录。

## 禁止事项

- 不手改生成物：`docs/feature_map.*`（由 `scripts/gen-feature-map.py` 生成）、`packages/templates/*/index.json` 与 `mini-app/*.zip`、`apps/web/public/monaco/`。
- 不主动执行 git 提交/分支/reset。
