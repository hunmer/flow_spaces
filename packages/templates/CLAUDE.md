# packages/templates (`@flow-spaces/agents`)

模板/资源分发包：42 个插件模板（plugins/）、10 个内置 Mini App 打包产物（mini-app/）、Workflow 模板（workflows/）。`generate-index.mjs` + `pack-mini-apps.mjs` 构建，产物经 Server `/agents-store` 静态路由分发（Agent Store 内容源）。

## 约定

- 新插件模板：在 `plugins/` 建目录（结构对齐运行时插件 flow-spaces-data/plugins），跑 `pnpm build` 重生成索引。
- Mini App 打包与索引由脚本自动生成，勿手改 `mini-app/*.zip` 与各 `index.json`。
- 本地预览：`pnpm serve`（http-server 3101）。

## 文件索引

| 文件 | 用途 | 何时阅读 |
|---|---|---|
| [概述](claude/overview.md) | 组成、构建/服务流程 | 首次接触 |
| [文件索引](claude/file-map.md) | 目录速查 | 找文件 |
| [变更记录](claude/changelog.md) | 更新历史 | 了解变更 |

## 扫描状态

- **更新时间**: 2026-11-15
- **已扫描**: package.json、generate-index.mjs/pack-mini-apps.mjs、plugins/（42 项）、mini-app/（10 zip + icons/intro/index）、workflows/ 清单
- **未深挖**: 各插件模板内部实现（插件开发指南见根 `docs/workflow/plugin-guide.md`）
