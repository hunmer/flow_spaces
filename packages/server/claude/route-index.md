# 路由索引

25 个路由文件（2026-11-27 实测 `ls routes/` + app.ts 挂载核对；issue/task/git/kanban/worktree/database/command/code-favorites/hooks 等旧路由已随历史死代码清理删除）。

| 路由文件 | 端点前缀 | 说明 |
|----------|----------|------|
| auth.ts | /api/auth | 认证 login |
| account.ts | /api/account | 用户资料（web 经 lib/account-api.ts 直调） |
| workspace.ts | /api/workspaces | 工作空间（仅 GET list；clone/git.ts 已随死代码清理删除） |
| channel.ts | /api/workspaces/:id/channels | 频道与消息（聊天 B 套底座） |
| agent.ts | /api/workspaces/:id/agents、/api/agents | Agent 会话 + 预设（双挂载） |
| agent-sse.ts | /api/agent-sse | Agent SSE 流式调用（auth 前） |
| agent-commands.ts | /api/agent-commands | Agent 命令配置 |
| chat.ts | /api/chat | Chat 会话/Agent/B 套 ChatWorkspace CRUD |
| chat-run.ts | /api/chat | Chat SSE 执行（同 /api/chat 前缀） |
| workflow.ts | /api/workflows | Workflow 模板 CRUD |
| workflow-hook.ts | /api/workflows | Workflow Webhook Hook（SSE） |
| mini-apps.ts | /api/mini-apps | Mini App 管理/文件/安装 |
| plugin.ts | /api/plugins | Plugin 插件管理 |
| mcp.ts | /api/mcps | MCP 服务器 |
| mcp-server.ts | —（对外 MCP server 协议） | 本机 MCP server 端点 |
| skill.ts | /api/skills | Skill 技能 |
| search.ts | /api/workspaces/:id/search | 代码搜索 |
| knowledge-base.ts | /api/workspaces/:id/knowledge-bases | 知识库 |
| notification.ts | /api/workspaces/:id/notifications | 通知中心（mini-app host api sendNotification 消费） |
| llm.ts | /api/models、/api/providers | LLM 模型与供应商 |
| model-catalog.ts | /api/model-catalog | 模型目录 |
| sqlite.ts | /api/sqlite | SQLite 适配 |
| file.ts | /api/workspaces/:id/files | 文件系统（chat:/chat-workspace: 前缀分流） |
| folder.ts | /api/folder | 文件夹浏览器 |
| external-import.ts | /api/external-import | 外部内容导入 |
