# packages/server (`@flow-spaces/server`)

Express 5 后端服务，REST API + WebSocket，SQLite 存储。核心能力：多 AI Agent 运行时适配（Claude Code/Codex/Grok/**Gemini CLI**/LangChain/Hermes/Pi/Open Agent SDK，`RUNTIME_DESCRIPTORS` 登记 20 个 runtime id 含 11 个别名）、Runtime 安装与版本管理、Workflow 可视化执行引擎、Issue 任务系统、实时通信（聊天/终端/语音识别）、知识库 + 向量嵌入、Git 操作、MCP 工具集成、Notification Hub 通知推送（微信/飞书 Bot）。

## 约定

- 入口 `src/app.ts`，所有路由在此注册。
- 存储层在 `src/storage/`，业务逻辑在 `src/services/`。
- AI 运行时适配器在 `src/adapters/`，`claude-code-runtime` 是独立子模块；新增运行时需实现统一接口。
- Runtime 管理（CLI 发现/SDK 安装）集中在 `routes/runtime.ts`。
- Issue 系统跨 `services/issue*.ts` + `agents/issue-agent-runner.ts` + `storage/issue-store.ts`。
- WebSocket 处理在 `src/ws/`。
- 运行时数据目录 `flow-spaces-data/` 勿手动修改。
- 路由前缀 `/api/`，`/api/inspector/track` 为唯一无认证端点。

## 文件索引

| 文件 | 用途 | 何时阅读 |
|---|---|---|
| [架构总览](claude/overview.md) | 架构、运行时形态 | 首次接触 |
| [入口与启动](claude/entrypoints.md) | app.ts 入口、启动流程 | 需要启动/理解初始化 |
| [对外接口](claude/public-interfaces.md) | REST API、WebSocket 端点 | 需要调用/新增接口 |
| [模块职责](claude/module-responsibilities.md) | 路由/服务/存储/适配器分类 | 需要定位功能 |
| [AI 运行时适配器](claude/ai-adapters.md) | 各 Agent SDK 适配详情 + Runtime 管理 | 需要新增/修改运行时 |
| [Grok 运行时协议](claude/grok-runtime.md) | Grok CLI 子进程协议、JSON 事件 schema、自定义模型 config.toml | 改 Grok 适配器/对接新 endpoint |
| [Gemini CLI 运行时](claude/gemini-cli-runtime.md) | gemini-cli 子进程协议、stdout JSON 事件、附件上下文、resume 会话 | 改 Gemini 适配器/对接新 endpoint |
| [数据模型](claude/data-model.md) | Storage 层、领域模型 | 需要改数据结构 |
| [测试与质量](claude/testing-and-quality.md) | 测试覆盖 | 需要运行/补充测试 |
| [文件索引](claude/file-map.md) | 完整目录结构 | 需要找文件 |
| [变更记录](claude/changelog.md) | 更新历史 | 了解变更 |

## 扫描状态

- **更新时间**: 2026-11-15（init-project 全量复核；上次深扫 2026-07-27）
- **已扫描**: package.json、app.ts（36 处 app.use）、routes 25 文件、services 74、storage 19、adapters 14 + agents 4（claude-code-runtime 子目录 / ai-sdk-chat / langchain-runtime / git.ts）、ws 11、dev 19、test 38；`RUNTIME_DESCRIPTORS` 20 个 id（9 独立 runtimeKind + 11 别名）
- **本期变更**: 移除 Team 多 Agent 协作功能（`services/team*.ts` 8 文件、`routes/team.ts`、`builtin-tools/team-tools.ts` 及 `/api/teams` `/api/team-inbox` `/api/team-messages` 3 个挂载点、`claude/team-runtime.md` 文档删除；存量 `flow-spaces-data/team/` JSON 与旧 channel `teamIds` 字段保留并安全忽略）；新增 Gemini CLI 运行时（`adapters/gemini-cli-runtime.ts` 422 行）；下线 `/ws/lsp/typescript`；新增 `ws/mini-app-channels.ts`；`services/mini-app-services.ts` 新增 `startServicesWatcher`
- **2026-11-15 复核**: 文件级功能映射纳入根 `docs/feature_map.json/html`（server.* 节点，`scripts/gen-feature-map.py` 生成，全仓 4072 文件 100% 覆盖）
- **跳过**: node_modules, dist, flow-spaces-data, public