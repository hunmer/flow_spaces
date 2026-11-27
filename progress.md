# 进度
- 本地页增加检查更新按钮和逐项更新入口；商店状态优先比较 MD5。
- 独立 GitHub 仓库从已保存 app.json 来源检查 checksums.json；商店按来源共享一次请求。
- 更新保留开发版模式；安装成功后提交 MD5，重启重建索引保留来源和 MD5。
- game-asset-canvas pack.mjs 已生成 app.json、checksums.json；商店 generate-index.mjs 已生成 checksums.json（12 项），通过临时目录生成，保留原有本地 index.json。
- SDK 构建、web/server 类型检查、8 项定向测试、源码与路径改动的生成器测试均通过。
- 发布时需要同步提交远端 checksum 与安装清单；使用说明见 docs/mini-app-updates.md。

## 安装更新按钮进度
- 服务端通过同一安装接口按 Accept 协商 SSE，发送真实文件处理进度；旧 JSON 调用保持兼容。
- SDK 增加可选进度回调，详情页普通安装、开发版安装及本地更新按钮显示百分比和完成数。
- SDK 构建、前后端类型检查、3 项定向测试通过，覆盖实时到达、增量跳过、开发版文件数、流分片、断流及错误恢复。

## 外部 Mini App 注册列表
- 在 flow-spaces-mini-apps/external-apps.json 登记固定 GitHub 地址，已加入 game-asset-canvas。
- 商店并行加载两份列表，拉取外部 app.json 后按 ID 合并，外部配置优先；外部注册表的镜像选择不会改变内部安装源。
- 外部条目保留独立安装来源及插件、入口、开发版文件；README 和图标从独立仓库加载。
- 12 项合并/更新测试、前端类型检查通过；实际本地 game-asset-canvas 清单适配验证通过。

## 添加本地应用
- 导入菜单在桌面和移动端增加本地目录选择对话框，复用 FolderPicker。
- 注册 localPath 并直接在原目录预览、读写源码和数据库；注册不会改写 manifest 或复制文件，重启保留关联。
- 本地应用移除只解除关联；自动检查更新跳过本地应用，商店与 ZIP 覆盖安装会拒绝写入本地目录。
- SDK 构建、web/server 类型检查、15 项定向测试通过（数据库测试使用与原生模块 ABI 一致的 Homebrew Node 25）。
