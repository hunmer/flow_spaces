# T6 10 路由全量回归（2026-11-08 01:03-01:05，Chromium DOM 探测，dev 5173）

| # | 路由 | 结果 | 渲染证据 |
|---|---|---|---|
| 1 | / | ✅ 302→/workflows 重定向 | 落地后工作流列表正常 |
| 2 | /workflows | ✅ | 列表含「T6-smoke-验证用工作流 已发布/1 个节点」，9 按钮 |
| 3 | /workflows/share（无参） | ✅ | 「缺少 workflow_id 参数」（详见 t6-share-ws.md） |
| 4 | /workflows/:id（真实 id） | ✅ | 编辑器渲染：名称/编辑/画布/运行/预览/触发器设置/运行测试，12 按钮（t6-route-workflows-id.png） |
| 5 | /mini-apps | ✅ | 管理页空态，11 按钮 |
| 6 | /mini-apps/:id（无效 id） | ✅ | 业务提示「项目不存在」 |
| 7 | /mini-apps-preview（无 id） | ✅ | **T5 空态兜底生效**：「缺少项目 id：请从…预览入口进入…」+返回按钮（t6-route-preview-empty.png） |
| 8 | /mini-apps-preview/:id（无效 id） | ✅ | 业务提示「Project not found」 |
| 9 | /login | ✅ | **T5 真登录页**：「登录到你的账户/输入密钥以继续」密钥输入框+登录/管理服务器按钮+login-hero（t6-route-login.png） |
| 10 | /nonexistent（* 兜底） | ✅ | 「404 页面不存在/返回工作流列表」 |

- 全程 console error/warn：**0**（与 T4 基线一致，无新增）
- SDK：dev5173 /api/auth/check、/api/workflows、/api/mini-apps 全 200；workflows 返回 1 条（测试数据）
- 生产构建抽查（vite preview 4173）：6 路由 curl 全 200、/api 代理 200、/workflows DOM 真实渲染（含同一条工作流）
