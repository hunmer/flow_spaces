# 测试与质量（根）

## 现状

- 无统一测试运行器：server `src/test/` 38 个 `*.test.ts`（vitest 风格但无 vitest 配置，多为手动/CI 脚本运行）；web 无单测。
- 类型即测试：`pnpm typecheck`（web）+ tsc 编译 shared/sdk/server。

## 质量关卡（提交前）

1. `pnpm build:packages` 通过（shared/sdk 编译）。
2. `pnpm typecheck` 通过。
3. i18n：`node scripts/check-locale-parity.mjs`（en/zh key 对齐）+ 按需 `audit-i18n-hardcode.mjs`。
4. 涉及路由/页面改动：`docs/smoke/` 有路由冒烟截图先例（smoke 脚本 + 浏览器核对）。

## 冒烟路径（人工）

- dev:all 起服务 → /home 渲染 → /workflows 列表 → 打开工作流编辑器 → 聊天发送一条消息 → /mini-apps 打开内置 app。

## 静态审计

- `docs/feature_map.json`：文件→功能节点 100% 覆盖映射（`scripts/gen-feature-map.py` 生成，重跑即校验）。
