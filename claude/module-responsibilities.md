# 模块职责

| 模块 | 包名 | 职责 | 规模（tracked 文件） | 索引 |
|---|---|---|---|---|
| `apps/web` | `@flow-spaces/web` | React 19 SPA：工作流编辑器、Mini App 平台、聊天、BoardUI 组件库 | 1997 | [CLAUDE.md](../apps/web/CLAUDE.md) |
| `packages/server` | `@flow-spaces/server` | Express 5 后端：REST+WS、SQLite、AI 运行时适配、workflow 引擎、flow-spaces-data 运行时数据 | 170 src + 1072 data | [CLAUDE.md](../packages/server/CLAUDE.md) |
| `packages/sdk` | `@flow-spaces/sdk` | 前端统一 API SDK：24 模块封装全部后端 HTTP | 27 | [CLAUDE.md](../packages/sdk/CLAUDE.md) |
| `packages/shared` | `@flow-spaces/shared` | 前后端共享 TS 类型（27 域，纯类型） | 44 | [CLAUDE.md](../packages/shared/CLAUDE.md) |
| `packages/templates` | `@flow-spaces/agents` | Agent Store 内容：42 插件模板、10 内置 Mini App、workflow 模板 | 393 | [CLAUDE.md](../packages/templates/CLAUDE.md) |
| `packages/logs` | — | server 运行日志（不入库，仅本地） | 0 | 无索引 |

## 根级支撑

- `scripts/`：i18n 审计与校验、closure 复制/验证、`gen-feature-map.py`（功能图谱生成）。
- `docs/`：workflow 开发指南（9 篇）、agent-tools MCP 说明、boardui-migration/ 冒烟记录、smoke/ 路由冒烟截图、feature_map。
- `procm-commands.json`：procm 进程管理入口。
