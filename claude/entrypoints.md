# 入口与启动（全仓视角）

## 开发环境启动顺序

1. `pnpm install`（触发 better-sqlite3/esbuild/node-pty/protobufjs/sharp 构建白名单，见根 package.json `pnpm.onlyBuiltDependencies`；web postinstall 同步 monaco 到 public）。
2. `pnpm build:packages` — shared → sdk 产出 dist（下游类型/运行时依赖）。
3. `pnpm dev:server` — server 起在 3110（`tsx watch src/app.ts`，入口 `packages/server/src/app.ts`）。
4. `pnpm dev` — web 起在 5173，vite 代理 `/api` `/ws` `/public` `/static` → 3110。

一键：`pnpm dev:all`（等价 2+3+4）。procm：`dev` / `dev:server` 两条已登记。

## 各模块入口

| 模块 | 入口 | 说明 |
|---|---|---|
| web | `apps/web/src/main.tsx` → `src/app/router.tsx` | Provider 树 + 路由表 |
| server | `packages/server/src/app.ts` | Express 注册 36 处 `app.use`（25 路由文件 + 静态 + WS） |
| sdk | `packages/sdk/src/index.ts` | `createSDK()` 工厂 |
| shared | `packages/shared/src/index.ts` | 类型桶导出 |
| templates | `packages/templates/pack-mini-apps.mjs` → `generate-index.mjs` | 打包 + 索引 |

## 构建产物

- `packages/*/dist/`（tsc，gitignore）、`apps/web/dist/`（vite，gitignore）。
- server 发布为 npm 包 `@flow-spaces/server`（bin `flow-spaces-server`），files 含 dist+public。
