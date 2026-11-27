# packages/templates (`@flow-spaces/agents`)

Agent Store 内容源（本地部分）：`agents/`（14 类 186 文件）、`mcps/`（10 个 JSON）、`skills/`（9 目录 86 文件）、`output-styles/`（8 个 md）、`prompt/`（3 个）、`skillspackage/`（技能包 zip + 索引）。`generate-index.mjs` 生成各子目录 `index.json`。

**2026-11 商店拆仓**：插件模板（plugins/）、内置 Mini App（mini-app/）、工作流模板（workflows/）已迁出至独立 GitHub 仓库（hunmer/flow-spaces-plugins / flow-spaces-mini-apps / flow-spaces-workflows），本包不再持有，`pack-mini-apps.mjs` 已删除。

## 约定

- 新增 agent/mcp/skill 模板：放对应子目录，跑 `pnpm build`（= generate-index.mjs）重生成索引；`index.json` 勿手改。
- plugins/mini-app/workflows 内容**不要**加回本包——去对应独立商店仓库维护。
- 分发：server `/agents-store` 静态路由（`resolveRuntimeDir('../templates')`）或 GitHub raw（hunmer/flow_spaces master 本目录）；本地预览 `pnpm serve`（http-server 3101）。

## 文件索引

| 文件 | 用途 | 何时阅读 |
|---|---|---|
| [概述](claude/overview.md) | 组成、构建/服务流程、拆仓背景 | 首次接触 |
| [文件索引](claude/file-map.md) | 目录速查 | 找文件 |
| [变更记录](claude/changelog.md) | 更新历史 | 了解变更 |

## 扫描状态

- **更新时间**: 2026-11-27（init-project 增量更新：商店拆仓）
- **已扫描**: package.json、generate-index.mjs、agents/（14 类目）、mcps/（10）、skills/（9 目录）、output-styles/（8）、prompt/（3）、skillspackage/（zip 3 + 索引）、文件计数（316 tracked）
- **未深挖**: 各 agent/skill 模板内部内容（多为第三方收集的 prompt/技能文本）
