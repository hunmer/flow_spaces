# apps/web 测试与质量

## 命令

- 类型检查：`pnpm typecheck`（web + node 两套 tsconfig，均须零错误）。
- 构建：`pnpm build`（rollup 层面兜底模块图错误）。
- Lint：无独立 eslint 配置（仓库级未配置）；风格靠约定 + BoardUI 规则约束。

## 现有自动化测试

- 单测稀疏：`src/components/workflow/workflow-canvas-helpers.test.ts`（画布 helpers）为代表性样例；node 侧可用 `node --test`/tsx 运行（无统一 script）。
- 冒烟/回归：人工脚本与截图存于根 `docs/smoke/`（route 级冒烟记录、share WS 用例）、`docs/boardui-migration/`（迁移验收截图）。

## 质量风险与建议

- 大多数业务组件无测试；改 workflow 画布逻辑时优先补 `workflow-canvas-*.ts` 纯函数用例。
- i18n 双语一致性：提交前跑根 `scripts/check-locale-parity.mjs` 与 `scripts/audit-i18n-hardcode.mjs`（硬编码文案审计）。
- vendor chunk 分组改动必须本地 `pnpm build` 验证无 TDZ/circular chunk 警告（历史坑见 vite.config 注释）。
- 视觉回归无自动化；BoardUI 组件升级后重点回归暗色模式与 RTL（DirectionProvider）。
