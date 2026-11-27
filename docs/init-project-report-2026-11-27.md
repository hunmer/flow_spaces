# init-project 执行报告 — 2026-11-27

> 触发请求：/init-project 近期大改动：一些内置的 plugins / workflows / miniapp 已迁移到独立 git 仓库（flow-spaces-plugins、flow-spaces-mini-apps、game-asset-canvas、flow-spaces-workflows）。
> 本轮性质：增量更新（上次全量扫描 2026-11-15）。只写文档与本地生成物，未改源码。

## 一、核心变更（侦察结论）

**商店拆仓 + 编辑器迁移**：`packages/templates` 中的 plugins/、workflows/、mini-app/ 三类内容整体迁出至独立 GitHub 仓库，且 Monaco 编辑器被替换为 CodeMirror 6；本仓缩容 4072 → **2750 tracked 文件**（templates 包 393 → 316，apps/web 2011 → 1827）。

| 索引前缀 | 仓库（main 分支 raw） |
|---|---|
| `plugins/` | github.com/hunmer/flow-spaces-plugins |
| `workflows/` | github.com/hunmer/flow-spaces-workflows |
| `mini-app/` | github.com/hunmer/flow-spaces-mini-apps |
| 其余 | hunmer/flow_spaces master `packages/templates/` |

- 路由实现：`apps/web/src/lib/agent-store.ts` 的 `REPO_ROUTES` + `resolveStoreUrl()`；默认经 gh-proxy 拉取 raw；自定义镜像走 localStorage `flow-spaces:store-api-base`；旧同源 `/agents-store` base 自动清除。
- Mini App 安装改为清单增量模式：仓库根 `app.json`（元数据 + 文件级 md5 清单）→ server `services/mini-apps.ts:463 installFromStore()` 按 md5 差异拉取；支持从任意 GitHub 仓库 URL 安装（`parseGithubRepoUrl`）。`MANIFEST_SKIP_DIRS` 排除 node_modules/vendor 等（game-asset-canvas ~9 万文件教训，vendor 只经 `/src/file/*` 按需加载）。
- 本地 `/agents-store` 静态路由仍在，但**只分发 `packages/templates` 包内剩余内容**（agents/mcps/skills/output-styles/prompt/skillspackage）。
- 运行时数据：`getDataDir()` = `FLOW_SPACES_DATA_DIR`（`.env` → `packages/server/flow-spaces-data/`）或 `~/.flow-spaces-data/`；数据目录中 plugins/workflows/mini-apps 整目录不入库（`.gitignore` 顶部注明去向），入库种子 25 文件。

## 二、文档更新清单（30+ 文件）

**根级（12）**：`CLAUDE.md`（拆仓说明 + 4 仓库链接、架构图加 STORES 节点、扫描状态 2026-11-27）；`claude/` 全套 11 文件（overview / conventions / module-responsibilities / entrypoints / public-interfaces / dependencies-and-config / data-model / testing-and-quality / file-map / faq / changangelog）。

**packages/templates（4）**：`CLAUDE.md` + `claude/overview.md`、`claude/file-map.md`、`claude/changelog.md`（6 类内容清单、拆仓背景、generate-index 流程、393→316 缩容记录）。

**packages/server / apps/web（定点）**：两模块 CLAUDE.md 扫描状态加 2026-11-27 行；claude/changelog 加条目；server `claude/public-interfaces.md` /agents-store 行补注（只含本地 templates）；web `claude/data-model.md` mini-app 数据流改商店安装口径、`claude/file-map.md` lib/ 补 agent-store.ts、`claude/module-responsibilities.md` workflows 行补商店模板说明。

## 三、失效引用清理（追加请求 1）

- `README.md`：删旧机器路径、MIGRATION-NOTES.md 与 docs/smoke/ 失效链接；「更多」节改 CLAUDE.md 入口 + 4 商店仓库链接。
- `docs/workflow/README.md`：3 处 MIGRATION-NOTES 引用删除；miniapp/resources-plugins 说明改指对应商店仓库。
- `docs/workflow/plugin-guide.md:795-812`：9 处 `resources/plugins/*` 参考路径改为 flow-spaces-plugins 仓库相对路径（改前经 GitHub API 验证目录存在）。
- `apps/web/claude/overview.md` 迁移对照引用删除。

## 四、功能依赖图谱（追加请求 2）

重新生成 `docs/feature_map.json` + `docs/feature_map.html`（vis-network，751KB，可交互）：

| 指标 | 值 |
|---|---|
| 功能节点 | **33**（6 大类；上次 38，商店内容迁出后对应节点消失） |
| 收录文件 | **2748 / 2748**（files 2679 + tests 69；另图谱产物 2 文件不自引用），覆盖率 **100%** |
| vendored / unmapped / ghost | 0 / 0 / 0 |
| 生成方式 | `scripts/gen-feature-map.py` 重建 JSON（PFX_RULES 语义规则）+ skill 脚本 render |
| 校验 | JSON 引用文件 2748、ghost=0 missing=0 unmapped=0；HTML `node --check` 通过、占位符 0、seed 与 JSON 同步 |
| git 状态 | 已入库（8ca398b；Monaco→CodeMirror 迁移后重建，`gen-feature-map.py` 规则同步更新） |

已登记：根 `CLAUDE.md`（找功能代码行）、`claude/` file-map / changelog / conventions / testing-and-quality / faq。

## 五、编辑器 Monaco → CodeMirror 6（追加请求 3）

迁移于 2026-11-27 16:32 完成（提交 6825f83 删文件 + 8ca398b 换依赖），文档同步更新：

- 实现：`apps/web/src/components/editor/code-editor.tsx` 为 CodeMirror 6（@uiw/react-codemirror + 24 个 `@codemirror/*` 包），**兼容旧 Monaco props**（value/language/height/theme/options/onChange）；深层 Monaco API（模型缓存/动作注册/goto-definition）不再提供。
- 删除：monaco-loader / monaco-models / monaco-action-registry 等旧文件与 `apps/web/public/monaco-themes/`（21 个主题 json）；全部走 bundle（vite manualChunks 拆 vendor-codemirror chunk），无 public 静态分发。
- 历史命名兼容（非 Monaco）：消费方以 `CodeEditor as MonacoEditor` 别名导入（mcps-dialog / skill-edit-dialog / workflow-code-fullscreen-dialog）；`lib/ui-exports.ts` 保留 `MonacoCodeEditor` 导出名。
- 图谱 `web.editor` 节点已由用户更新为 "CodeMirror 编辑器" 口径；本报告更新后图谱重建（2748 文件/33 节点/100%）。

## 六、覆盖率与缺口

- 模块 5/5 已扫描（web 1827 / server 440 / sdk 83 / shared 44 / templates 316 文件）；tracked 2750/2750 清点完毕。
- 清单级未深挖：server services（74 文件）、web components（522 文件）内部细节维持各模块 claude/ 现状。
- 未核对：`packages/sdk/demo/` 41 个 HTML 演示页。
- CodeGraph 索引未建（`.codegraph` 不存在）；当前用 feature_map.html 或 rg/grep 定位代码。

## 七、遗留事项与建议

1. ~~图谱入库决策~~ 已完成（8ca398b 入库）。
2. 模块级 CodeGraph 索引（`codegraph init`）可补代码级符号导航。
3. README.md 历史性叙述（Next.js 迁移背景）如需对外版可再整理。
4. `packages/server/.env` 当前入库且免鉴权——仅限本地开发环境，勿写入生产密钥。
