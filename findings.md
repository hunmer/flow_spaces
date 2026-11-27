# 发现
- 检查更新读取 checksums.json（id -> MD5），独立 GitHub 仓库从已记录 app.json 所在目录读取。
- MD5 包含文件路径、运行文件和 development 文件，源码变化与改名均会更新。
- 安装成功后才保存 checksum；启动重建索引保留来源、checksum 和开发版模式。
- 商店仓库现有 index.json 是本地运行注册表，有未提交配置；生成 checksums 时通过临时目录保留它。
