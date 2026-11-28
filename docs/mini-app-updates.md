# Mini App 更新检查

本地列表点击「检查更新」后读取安装来源的 `checksums.json`，与本地 `storeChecksum` 比较。无需修改版本号。发现变化后显示逐项更新按钮；点击后才获取完整安装清单，按文件 MD5 增量下载。

## 校验值文件

商店和独立仓库使用同一格式：

```json
{
  "miniapp_id": "0123456789abcdef0123456789abcdef"
}
```

- 商店仓库：运行 `node generate-index.mjs`，同时生成轻量 `index.json`、各应用 `files.json` 和 `checksums.json`。发布时一起提交。
- `game-asset-canvas` 独立仓库：运行 `node pack.mjs`，同时生成轻量 `app.json`、`files.json` 和 `checksums.json`。发布时一起提交。

整体 MD5 包含文件路径、运行文件和 `development` 文件的 MD5。源码内容变化、文件新增、删除、改名都会改变校验值；生成文件本身不参与校验。

## 安装来源

从商店安装时，`storeUrl` 保存应用目录，检查时读取其父目录的 `checksums.json`，安装或更新时读取应用目录的 `files.json`。

从独立 GitHub 仓库安装时，`storeUrl` 保存 `app.json` 的完整 raw 地址；检查时读取同目录下的 `checksums.json`，安装或更新时读取同目录下的 `files.json`。保留原地址的代理及分支。

没有安装来源的本地应用按 ID 尝试匹配当前商店，不存在则跳过。缺少旧版 `storeChecksum` 时提供一次更新，以建立校验基线。

更新成功后才保存新校验值，失败后仍可重新检查、继续下载。开发版安装模式会随更新和服务重启保留。
