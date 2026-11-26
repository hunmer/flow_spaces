# FAQ（根）

**Q: 改了 shared/sdk 代码，web 还报旧类型错？**
必须 `pnpm build:packages` 刷新 dist；下游（web/server）引用的是产物而非源码。

**Q: web 里 import 'next/...' 为什么能编译？**
vite alias 把 `next/*`、`next-intl`、`styled-jsx` 重写到 `apps/web/src/shims/`（迁移兼容层），tsconfig paths 同步映射。新增 next API 需扩 shim。

**Q: vite build 报 mermaid TDZ / chunk 顺序错误？**
`manualChunks` 里 mermaid 有闭包 BFS 防环逻辑，勿动；新加大依赖时参考 vite.config.ts 注释。

**Q: flow-spaces-data 下的文件哪些能提交？**
manifest、src、模板、catalog 等本体入库；`workflows/*/execution_history|versions/`、`mini-apps/*/data|configs/` 被 .gitignore 排除——不要强制添加。

**Q: server 起不来/端口占用？**
3110 被占时先查 procm（`procm-commands.json` 的 dev:server）；web 代理目标可用 SERVER_URL 覆盖。

**Q: 找某功能代码从哪入手？**
先查 `docs/feature_map.html`（功能→文件映射），或用 CodeGraph（索引已建）搜符号；各模块入口见模块 CLAUDE.md。

**Q: 前端如何调后端接口？**
统一走 `@flow-spaces/sdk`（web/src/lib/sdk.ts 单例），不直接 fetch；新增接口先在 shared 定义类型 → sdk 加模块 → server 加路由。

**Q: i18n key 改了页面还是英文？**
key 需 en/zh 双语同步；跑 `node scripts/check-locale-parity.mjs` 校验。
