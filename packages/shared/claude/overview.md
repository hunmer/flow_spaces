# packages/shared 架构总览

## 定位

`@flow-spaces/shared`（v0.2.6）是前后端共享的**纯类型包**：约 3400 行 TypeScript 类型/接口定义，无运行时逻辑。server 与 web/sdk 均以 `workspace:*` 依赖它，保证 REST/WS 数据契约单源。

## 结构与运行形态

- `src/index.ts` 桶文件重导出 `src/types/*` 全部 26 个域文件。
- 构建即 `tsc` 产 `dist/`（ESM only，`declaration` + `declarationMap`），web/sdk/server 引用其产物或经 workspace 直解析。
- 发布配置 `publishConfig.access: public`（npm 公开包）。

## 边界与取舍

- 只放类型与常量契约，禁止引入带运行时副作用的代码（保持三端安全复用）。
- workflow 契约拆得最细（7 个文件：workflow、workflow-composite、workflow-errors、workflow-execution、workflow-node-factory、workflow-plugin、workflow-shortcut、workflow-ws），对应编辑器/引擎两侧的复杂度。
