# apps/web (`@flow-spaces/web`)

Vite + React 19 SPA 前端（自 flow-spaces Next.js 迁移）。三大界面域：工作流可视化编辑器（xyflow）、Mini App 平台（列表/编辑/Babel 沙箱预览）、聊天与首页壳。UI 基于 BoardUI 源码级组件库 + Tailwind v4 语义 token。

## 约定

- 写 UI 前先查 `components/base|application/`；BoardUI 规则全文见 `AGENTS.md`（boardui:rules 区块）：颜色/排版只用语义 token 与组合工具类。
- 后端调用一律走 `lib/sdk.ts` 的 SDK 实例；WS 走 `lib/ws.ts`。
- 新路由改 `src/app/router.tsx`；文案进 `src/locales/{en,zh}/`，提交前跑根 `scripts/check-locale-parity.mjs`。
- 勿新增 `next/*` 导入（alias 到 shims，仅为兼容存量）。
- dev 5173 代理到 server 3110；`pnpm typecheck` 两套 tsconfig 都要过。

## 文件索引

| 文件 | 用途 | 何时阅读 |
|---|---|---|
| [架构总览](claude/overview.md) | 运行形态、设计取舍、边界 | 首次接触 |
| [开发约定](claude/conventions.md) | 命令、BoardUI 规则摘要、禁止事项 | 写任何代码前 |
| [模块职责](claude/module-responsibilities.md) | src/ 与 components/ 子域划分 | 定位功能 |
| [入口与启动](claude/entrypoints.md) | 入口链、构建流程、初始化 | 启动/排查 |
| [对外接口](claude/public-interfaces.md) | 页面路由表、后端消费面 | 加页面/接口 |
| [依赖与配置](claude/dependencies-and-config.md) | 依赖、vite/tsconfig/boardui 配置、环境变量 | 升级/配置问题 |
| [数据模型](claude/data-model.md) | stores、数据流、本地持久化 | 改状态/数据流 |
| [测试与质量](claude/testing-and-quality.md) | typecheck、现有测试、风险 | 提交前 |
| [文件索引](claude/file-map.md) | 目录结构速查 | 找文件 |
| [FAQ](claude/faq.md) | 白屏/编辑器/i18n/高度链等 | 排错 |
| [变更记录](claude/changelog.md) | 索引更新历史 | 了解变更 |

## 扫描状态

- **更新时间**: 2026-11-27（init-project 增量更新：商店拆仓）
- **2026-11-28 增量⑤**: 商店源设置改自动保存——`store-sources-panel.tsx` 删保存按钮，修改（输入/增删行/切默认源）即 500ms 防抖 PUT（空白行不进载荷；校验不过暂缓并提示，失败停自动重试、留「重试」按钮）；保存期间编辑保持 dirty，完成后补存，无竞态。
- **2026-11-27 增量②**: settings 拆分——536 行 `components/settings/settings-dialog.tsx` 按功能拆为瘦壳 + `appearance-panel.tsx`（主题+鼠标指针）/ `general-panel.tsx` / `account-panel.tsx` / `store-sources-panel.tsx` / `option-card.tsx`（model-settings-panel 原已独立）；新增「商店源」设置栏目：新建 `lib/store-sources.ts`（类型/默认源/配置缓存/REST），三类商店源地址可增删改、默认 GitHub+本地端口两源、持久化后端，`agent-store.ts` 的 `fetchStoreIndex` 改按源顺序故障转移（成功源记忆供散件解析跟随），见 server 侧 `GET/PUT /api/user/store-sources`。
- **2026-11-28 增量④**: 默认本地商店源改指三仓 http-server 镜像端口——`lib/store-sources.ts` `defaultStoreSources()` 的 Local 源从 `${serverUrl}/agents-store`（3110，已不含拆仓后的三类内容）改为跟随访问主机名的 `http://<host>:8091|8092|8093`（plugins/workflows/mini-app 三仓 `npm run serve`，见各仓 package.json）；已保存过商店源配置的用户不受影响（存量值优先，恢复默认后生效新端口）。
- **2026-11-27 增量③**: mini-apps 页导入改造——header「导入 ZIP」按钮换成「导入」下拉（导入 ZIP / 从 GitHub 导入两项），GitHub 地址输入从商店模式内联行移入新组件 `mini-apps/mini-apps-github-import-dialog.tsx`（自包含：parse → 拉 app.json → installFromStore → 刷新+关闭），商店模式 toolbar 仅本地模式显示；商店源设置每行新增默认源 radio（`StoreSource.default`，`store-sources.ts` 归一为每类恰一个默认 + `orderedSources` 默认排前优先尝试），删除默认源/首个新增自动补默认，见 server 侧 store-sources 归一。
- **2026-11-27 增量**: 商店消费改外部仓库——`lib/agent-store.ts`（`resolveStoreUrl`/`REPO_ROUTES`/`parseGithubRepoUrl`，默认 gh-proxy raw，镜像存 localStorage `flow-spaces:store-api-base`，旧同源 `/agents-store` base 自动清除）成为 plugins/workflows/mini-app 三类商店索引的统一入口（消费点 6 处：mini-apps-page / workflows-page / workflow-plugins-dialog / agent-dialog-data / mcps-dialog / use-skills-data）；本地 `/agents-store` 仅剩 agents/mcps/skills 等无前缀内容。
- **已扫描**: src/ 全子树结构、vite/tsconfig/AGENTS/boardui 配置、electron、路由表、入口链
- **未深挖**: `components/ui/`（96 文件）与 `components/reui/` 逐件 API；`locales/` 逐命名空间内容
- **下一步建议**: 需要时补扫 `components/workflow/display-node-views/`（自定义节点视图清单）
