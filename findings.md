# 发现
- 检查更新读取 checksums.json（id -> MD5），独立 GitHub 仓库从已记录 app.json 所在目录读取。
- MD5 包含文件路径、运行文件和 development 文件，源码变化与改名均会更新。
- 安装成功后才保存 checksum；启动重建索引保留来源、checksum 和开发版模式。
- 商店仓库现有 index.json 是本地运行注册表，有未提交配置；生成 checksums 时通过临时目录保留它。

## Mini App 快速加载
- 当前预览页和编辑器均先逐个读取源码，再由 react-renderer 动态加载 Babel 编译。
- settings-dialog 的通用内容委托 general-panel；已有 BoardUI Switch 可复用。
- 单应用覆盖总开关，未覆盖时随全局变化；生产默认开启，开发默认关闭。
- 商店现有应用没有统一 dist；新增根目录 dist/index.cjs（可选 index.css）约定与 pnpm mini-app:build 命令，不采用 iframe，直接复用宿主 React。
- 快速模式缺失 bundle 时回退源码；HTML 保留现有链路。编辑页只补读入口源码作为 Agent 上下文。
- 已加入加载请求版本保护，防止快速切换时旧请求覆盖新模式。
