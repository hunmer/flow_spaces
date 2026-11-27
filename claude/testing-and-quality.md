# 测试与质量（根）

## 现状

- 无统一测试运行器：server `src/test/` 38 个 `*.test.ts`（vitest 风格但无 vitest 配置，多为手动/CI 脚本运行）；web 有零星 `*.test.mjs`（如 `components/workflow/group-execution-order.test.mjs` 等 3 个工作流组件测试）。
- 类型即测试：`pnpm typecheck`（web）+ tsc 编译 shared/sdk/server。

## 质量关卡（提交前）

1. `pnpm build:packages` 通过（shared/sdk 编译）。
2. `pnpm typecheck` 通过。
3. i18n：`node scripts/check-locale-parity.mjs`（en/zh key 对齐）+ 按需 `audit-i18n-hardcode.mjs`。
4. 涉及路由/页面改动：浏览器人工核对（历史冒烟截图先例在 `docs/boardui-migration/`；`docs/smoke/` 已不随仓分发）。

## 冒烟路径（人工）

- dev:all 起服务 → /home 渲染 → /workflows 列表（模板需访问外部商店仓库）→ 打开工作流编辑器 → 聊天发送一条消息 → /mini-apps 从商店安装一个 app（需网络可达 gh-proxy/GitHub）。

## 静态审计

- `scripts/gen-feature-map.py` 可重跑生成功能图谱：2026-11-27 已生成 `docs/feature_map.json/html`（33 功能节点 / 2947 文件 / 覆盖率 100%，本地未入库）。
