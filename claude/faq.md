# FAQ（根）

**Q: 改了 shared/sdk 代码，web 还报旧类型错？**
必须 `pnpm build:packages` 刷新 dist；下游（web/server）引用的是产物而非源码。

**Q: web 里 import 'next/...' 为什么能编译？**
vite alias 把 `next/*`、`next-intl`、`styled-jsx` 重写到 `apps/web/src/shims/`（迁移兼容层），tsconfig paths 同步映射。新增 next API 需扩 shim。

**Q: 插件/工作流模板/Mini App 从哪来？本地 `/agents-store` 为什么找不到？**
2026-11 起商店内容拆分到独立 GitHub 仓库（flow-spaces-plugins / flow-spaces-workflows / flow-spaces-mini-apps），web 端 `apps/web/src/lib/agent-store.ts` 的 `resolveStoreUrl` 按索引 path 前缀路由到对应仓库 raw（默认经 gh-proxy）。本地 `/agents-store` 只分发 `packages/templates` 里剩下的 agents/mcps/skills 等内容。要换镜像：localStorage `flow-spaces:store-api-base`；旧同源 `/agents-store` base 会被自动清除。

**Q: flow-spaces-data 下的文件哪些能提交？**
只提交种子数据：agent-templates、llm/catalog.json、models.json、workspace 注册表、uploads、sqlite 库。`plugins/`、`workflows/`、`mini-apps/` 整目录不入库（拆仓去向见 `.gitignore` 顶部注释）；`llm/providers.json` 含凭据不入库。

**Q: server 起不来/端口占用？**
3110 被占时先查 procm（`procm-commands.json` 的 dev:server）；web 代理目标可用 SERVER_URL 覆盖；server 端口由 `packages/server/.env` 的 PORT 控制。

**Q: 找某功能代码从哪入手？**
rg/grep 搜符号；各模块入口见各 CLAUDE.md。CodeGraph 索引未建（`.codegraph` 不存在），需要时先 `codegraph init`。

**Q: 前端如何调后端接口？**
统一走 `@flow-spaces/sdk`（web/src/lib/sdk.ts 单例），不直接 fetch；商店索引是唯一例外（`lib/agent-store.ts` 直接 fetch 远端 raw）。新增接口先在 shared 定义类型 → sdk 加模块 → server 加路由。

**Q: i18n key 改了页面还是英文？**
key 需 en/zh 双语同步；跑 `node scripts/check-locale-parity.mjs` 校验。

**Q: docs 里的旧引用还作数吗？**
`MIGRATION-NOTES.md`、`docs/smoke/` 已不随仓分发（相关失效链接已于 2026-11-27 清理：README、docs/workflow/README、plugin-guide 参考实现路径已改指 flow-spaces-plugins 仓库）；`docs/feature_map.json/html` 已于 2026-11-27 重新本地生成（未入库）。
