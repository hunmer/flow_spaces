# packages/shared 开发约定

- 新增类型：在 `src/types/` 建域文件（kebab-case），并在 `src/index.ts` 重导出；跨域引用走 index，不深路径引用。
- 改类型后需 `pnpm build:packages`（shared 先于 sdk 构建）刷新 dist，消费方（web/server）才能拿到新契约。
- 仅类型与常量；禁止运行时逻辑、禁止依赖除 typescript 外的包（当前 devDependencies 只有 typescript）。
- 命名风格沿用现有：接口直名（`Workflow`）、事件用 `*Event`、WS 消息按域前缀。
