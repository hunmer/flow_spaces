# 依赖与配置（根）

## 工具链

- Node + pnpm workspace（`pnpm-workspace.yaml`：packages/* + apps/*）。
- TypeScript 5.8 strict / ES2022 / moduleResolution bundler（`tsconfig.base.json`，各模块继承覆写）。
- 原生构建白名单（`pnpm.onlyBuiltDependencies` + workspace `allowBuilds`）：better-sqlite3、esbuild、koffi、node-pty、protobufjs、sharp、@google/genai。

## 模块依赖图

- web → sdk → shared；web/server → shared；server → templates（`/agents-store` 静态分发）。
- web 还直接 fetch 外部商店仓库（gh-proxy GitHub raw）：flow-spaces-plugins / flow-spaces-workflows / flow-spaces-mini-apps（见 `apps/web/src/lib/agent-store.ts`），不依赖本地包。
- server 重依赖：@ai-sdk/*、@langchain/*（langgraph、mcp-adapters）、@modelcontextprotocol/sdk、better-sqlite3、node-pty、adm-zip 等。
- web 重依赖：@xyflow/react、monaco、@tiptap/*、mermaid、react-aria、tailwindcss v4、@babel/standalone（mini-app 沙箱）。

## 根级配置文件

| 文件 | 作用 |
|---|---|
| `pnpm-workspace.yaml` | workspace 范围 + allowBuilds |
| `tsconfig.base.json` | 共享编译选项 |
| `procm-commands.json` | procm 长期进程命令表 |
| `.gitignore` | dist/logs/运行时数据/商店拆仓目录排除（顶部注释记录拆仓去向） |
| `AGENTS.md` | 工程师行为规则（简体中文输出、最小改动等） |

## 环境变量

- `SERVER_URL`：vite 代理目标（默认 127.0.0.1:3110）。
- `NEXT_PUBLIC_SERVER_URL`：web 运行时 server 地址（空 → window.location.hostname）。
- `FLOW_SPACES_DATA_DIR` / `AGENT_SPACES_DATA_DIR`（旧名回退）：server 运行时数据目录，默认 `~/.flow-spaces-data/`；本仓 `.env` 指向 `./flow-spaces-data`（packages/server 下）。
- `PORT`：server 端口（`.env` 设 3110，默认 3100）。
- server 侧 `.env` / `.env.example`（packages/server/，dotenv 由 app.ts 顶部加载，cwd=packages/server；`.env` 当前已入库，勿写密钥）。
