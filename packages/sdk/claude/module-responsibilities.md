# 模块职责

SDK 由 24 个 API 模块适配器组成，按业务域划分。以下是各模块的职责说明。（2026-11-15 全量核对，Team/issue/git/看板/订阅等旧模块已随产品收敛移除）

## 核心 API 模块

### workspace（工作空间）
- 工作空间 CRUD
- 通知设置（获取/更新/启动/停止/测试）
- 文件夹浏览与权限检查、Reveal 目录、创建文件夹、读取文件

### agent（Agent 预设）
- Agent 预设 CRUD
- AI 生成 Agent 配置、Prompt 优化
- 连接测试、同步到所有工作空间

### channel（频道）
- 频道 CRUD、消息管理、频道状态、附件上传、工具调用详情

### editor（编辑器）
- 文件树与文件内容读写
- 编辑器状态持久化
- 代码搜索、文件操作、导入（URL/本地/上传）

### llm（LLM 模型/供应商）
- 模型 CRUD、供应商 CRUD

### workflow（Workflow）
- Workflow CRUD + duplicate、SSE 流式执行
- 文件夹、版本、执行日志、操作历史、暂存区、Workflow Agent 聊天

### workflow-plugin（Workflow 插件）
- 插件列表（全部/仅工作流插件）、启用/禁用/卸载/商店安装
- 工作流节点定义、插件配置读写、插件方案管理

### mini-apps（Mini App）
- 项目 CRUD、文件树与内容读写、配置/数据文件写入
- ZIP 导入导出、头像上传

### chat（Chat 独立聊天）
- Chat Agent CRUD、消息管理
- 工作空间/工作目录文件树、Chat Workspace/Session CRUD
- 工作空间状态持久化

## 数据与检索模块

### knowledge-base（知识库）
- 知识库 CRUD（workspace 级嵌套路由 `/api/workspaces/:id/knowledge-bases`）
- 文件管理：列表/添加/上传/获取/删除/reindex
- 绑定 embedding 模型、stats、向量查询 query

### sqlite（SQLite 数据库）
- 数据库 CRUD（可绑定 workflowIds）、表列表/表结构 describe
- 只读查询与 exec（shared 类型 SqliteQueryResult/SqliteExecResult）

### search（搜索）
- 代码搜索、文件搜索

## 配置与工具模块

### notification（通知）
- 通知列表、标记已读/清除全部

### skills（Skills）
- Skills 列表/保存/删除、收藏切换
- 批量导入（store/Git/批量）、同步检查与执行、Skill 文件管理

### mcps（MCP 服务器）
- MCP 服务器列表/保存/删除、收藏切换、JSON 导入

### tools（内置工具）
- 工具列表、启用/禁用

### external-import（外部导入）
- 扫描 codex/claude/gemini 来源的 skills/commands/mcps/output-styles/agents
- 按 copy/symlink 模式批量导入

### account（用户账号）
- 用户资料读写（name ≤32 字符校验）
- 头像上传（≤5MB）/删除

### auth（认证）
- 登录（secretKey）、Token 验证、修改密钥

### avatar（头像）
- 获取/上传头像

### font（字体）
- 字体列表/上传/删除、Base64 上传

### inspector（DOM Inspector）
- Inspector 跟踪上报（免认证）

### agent-store（Agent 商店）
- 从外部 URL 获取 Agent/插件索引

### agent-commands（Agent 命令）
- 跨 Agent 命令列表、Agent 命令 CRUD、应用到多个 Agent
