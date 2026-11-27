# packages/shared (`@flow-spaces/shared`)

跨前后端共享 TypeScript 类型定义（v0.2.6）。纯类型包，无运行时代码；`src/types/` 25 个域文件 + `src/index.ts` 桶导出，workflow 契约细分 8 个文件。被 `@flow-spaces/server`、`@flow-spaces/sdk`、web 依赖。

## 约定

- 新增类型：在 `src/types/` 建 kebab-case 域文件，经 `src/index.ts` 桶导出；跨域引用走 index，不深路径。
- 仅类型与常量，禁止运行时逻辑与外部依赖（devDependencies 只有 typescript）。
- 改类型后必须 `pnpm build:packages` 刷新 dist，消费方才能拿到新契约。
- Team 产品类型已移除；外部 runtime 的 TeammateIdle hook 协议保留。

## 文件索引

| 文件 | 用途 | 何时阅读 |
|---|---|---|
| [概述](claude/overview.md) | 结构、构建形态、边界 | 首次接触 |
| [开发约定](claude/conventions.md) | 新增类型流程 | 改类型前 |
| [模块职责](claude/module-responsibilities.md) | 25 个类型域清单 | 找类型 |
| [入口与启动](claude/entrypoints.md) | 构建/导出链 | 构建问题 |
| [对外接口](claude/public-interfaces.md) | 包导出面 | 消费方接入 |
| [依赖与配置](claude/dependencies-and-config.md) | package.json/tsconfig | 升级 |
| [数据模型](claude/data-model.md) | 核心实体形状 | 建模参考 |
| [测试与质量](claude/testing-and-quality.md) | tsc 即校验 | 提交前 |
| [文件索引](claude/file-map.md) | 目录速查 | 找文件 |
| [FAQ](claude/faq.md) | 常见问题 | 排错 |
| [变更记录](claude/changelog.md) | 更新历史 | 了解变更 |

## 扫描状态

- **更新时间**: 2026-11-27
- **已扫描**: package.json、src/index.ts、src/types/ 域文件清点（team.ts 已移除；2026-11-27 死代码清理删 command.ts/git.ts/worktree.ts，现状 25 个）
- **未深挖**: 各域文件逐接口展开（类型清单见 module-responsibilities.md）
