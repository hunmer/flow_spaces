# 进度
- 本地页增加检查更新按钮和逐项更新入口；商店状态优先比较 MD5。
- 独立 GitHub 仓库从已保存 app.json 来源检查 checksums.json；商店按来源共享一次请求。
- 更新保留开发版模式；安装成功后提交 MD5，重启重建索引保留来源和 MD5。
- game-asset-canvas pack.mjs 已生成 app.json、checksums.json；商店 generate-index.mjs 已生成 checksums.json（12 项），通过临时目录生成，保留原有本地 index.json。
- SDK 构建、web/server 类型检查、8 项定向测试、源码与路径改动的生成器测试均通过。
- 发布时需要同步提交远端 checksum 与安装清单；使用说明见 docs/mini-app-updates.md。
