#!/usr/bin/env python3
"""init-project 阶段 C：生成 docs/feature_map.json + feature_map.html（模板注入）。

硬性校验：
1. 覆盖率 100%：git ls-files 的项目自有文件（排除 vendored/生成物）全部出现在 JSON；
   JSON 中路径全部真实存在（幽灵路径清零）。
2. JSON 可被 json.load 解析。
3. HTML 注入后：seed 段重新解析通过、主脚本 node --check 0 错误、占位符残留 0。
"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # scripts/ -> repo root
DOCS = os.path.join(ROOT, "docs")
def _find_skill_tpl() -> str:
    """init-project 技能模板：兼容 .dsh 与 .skills-manager 两处安装（含 " (2)" 重复安装目录）。"""
    candidates = [
        os.path.expanduser("~/.dsh/skills/init-project/templates/feature_map.html"),
        os.path.expanduser("~/.dsh/skills/init-project (2)/templates/feature_map.html"),
        os.path.expanduser("~/.skills-manager/skills/init-project/templates/feature_map.html"),
        os.path.expanduser("~/.skills-manager/skills/init-project (2)/templates/feature_map.html"),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return candidates[0]

SKILL_TPL = _find_skill_tpl()

PROJECT = "flow-spaces"
HEAD = subprocess.run(["git", "-C", ROOT, "rev-parse", "--short", "HEAD"],
                      capture_output=True, text=True).stdout.strip()

# ---------- type 映射 ----------
def ftype(path: str) -> str:
    ext = path.rsplit(".", 1)[-1].lower() if "." in path else ""
    if ext in {"ts"}: return "ts"
    if ext in {"tsx"}: return "tsx"
    if ext in {"js", "cjs"}: return "js"
    if ext in {"jsx"}: return "jsx"
    if ext in {"mjs"}: return "mjs"
    if ext in {"sh"}: return "sh"
    if ext in {"py"}: return "py"
    if ext in {"md"}: return "md"
    if ext in {"css"}: return "css"
    if ext in {"html"}: return "html"
    if ext in {"json", "yaml", "yml", "toml", "lock", "npmignore", "example", "tsbuildinfo"}: return "config"
    return "data"  # svg png webp zip wasm sqlite txt 等

TEXT_TYPES = {"ts", "tsx", "js", "jsx", "mjs", "sh", "py", "md", "css", "html", "config"}

# ---------- 测试文件识别 ----------
TEST_PAT = re.compile(r"(\.test\.|\.spec\.|(^|/)tests?/|_test\.)", re.I)

def is_test(path: str) -> bool:
    return bool(TEST_PAT.search(path))

# ---------- 功能归属规则（顺序敏感，先命中先归属）----------
# 每条: (feature_id, path 前缀或正则)
PFX_RULES = [
    # --- docs / 工程基建（先于模块规则，处理跨模块文档）---
    ("infra.docs",  re.compile(r"^(docs/|claude/|CLAUDE\.md$|packages/[^/]+/claude/|packages/[^/]+/CLAUDE\.md$|apps/web/claude/|apps/web/CLAUDE\.md$|\.agentspace/claude\.md$|apps/web/src/locales/\.claude/)")),
    ("infra.scripts", re.compile(r"^(scripts/|procm-commands\.json$|package\.json$|pnpm-lock\.yaml$|pnpm-workspace\.yaml$|tsconfig\.base\.json$|\.gitignore$|MIGRATION-NOTES\.md$|README\.md$|AGENTS\.md$|\.flow-spaces-leftover-report\.md$|\.unused-report\.md$|\.review/)")),
    ("infra.logs",  re.compile(r"^packages/logs/")),
    # --- sdk / shared ---
    ("sdk.api",     re.compile(r"^packages/sdk/")),
    ("shared.types", re.compile(r"^packages/shared/")),
    # --- templates ---
    ("templates.plugins", re.compile(r"^packages/templates/plugins/")),
    ("templates.mini-app", re.compile(r"^packages/templates/mini-app/")),
    ("templates.workflows", re.compile(r"^packages/templates/workflows/")),
    ("templates.build", re.compile(r"^packages/templates/")),
    # --- server 源码 ---
    ("server.entry", re.compile(r"^packages/server/(src/app\.ts$|src/procm-logger\.ts$|src/middleware/|src/types/|package\.json$|tsconfig\.json$|\.env|\.npmignore$|test/)")),
    ("server.routes", re.compile(r"^packages/server/src/routes/")),
    ("server.services", re.compile(r"^packages/server/src/services/")),
    ("server.storage", re.compile(r"^packages/server/src/storage/")),
    ("server.adapters", re.compile(r"^packages/server/(src/adapters/|src/agents/)")),
    ("server.ws",    re.compile(r"^packages/server/src/ws/")),
    ("server.dev",   re.compile(r"^packages/server/src/dev/")),
    ("server.public", re.compile(r"^packages/server/public/")),
    # --- server 运行时数据 ---
    ("data.mini-apps", re.compile(r"^packages/server/flow-spaces-data/mini-apps/")),
    ("data.plugins", re.compile(r"^packages/server/flow-spaces-data/plugins/")),
    ("data.agent-templates", re.compile(r"^packages/server/flow-spaces-data/agent-templates/")),
    ("data.llm-catalog", re.compile(r"^packages/server/flow-spaces-data/llm/")),
    ("data.workspaces", re.compile(r"^packages/server/flow-spaces-data/")),
    # --- apps/web ---
    ("web.entry",   re.compile(r"^apps/web/(src/main\.tsx$|src/vite-env\.d\.ts$|src/app/|index\.html$|vite\.config\.ts$|tsconfig|package\.json$|AGENTS\.md$|boardui\.json$|\.claude/)")),
    ("web.workflow", re.compile(r"^apps/web/(src/components/workflow/|src/components/workflows/|src/lib/workflow-|src/stores/workflow|src/app/workflows/)")),
    ("web.mini-apps", re.compile(r"^apps/web/(src/components/mini-apps/|src/app/mini-apps|src/lib/mini-app-workflow-config\.ts$|src/lib/layout-templates\.ts$)")),
    ("web.chat",    re.compile(r"^apps/web/src/components/(chat|composer)/")),
    ("web.boardui", re.compile(r"^apps/web/(src/components/(base|application|foundations|reui)/|\.cursor/)")),
    ("web.ui",      re.compile(r"^apps/web/src/components/(ui|common|decorations|table|viewers)/")),
    ("web.ui",      re.compile(r"^apps/web/src/components/[^/]+\.(tsx|ts)$")),
    ("web.shell",   re.compile(r"^apps/web/src/components/(layout|sidebar|sidebar-rail|home|command-palette|metrics-dashboard|settings)/")),
    ("web.editor",  re.compile(r"^apps/web/src/components/editor/")),
    ("web.git-plugins", re.compile(r"^apps/web/src/components/(git|plugins)/")),
    ("web.stores",  re.compile(r"^apps/web/src/stores/")),
    ("web.lib",     re.compile(r"^apps/web/src/lib/")),
    ("web.hooks",   re.compile(r"^apps/web/src/hooks/")),
    ("web.i18n",    re.compile(r"^apps/web/src/locales/")),
    ("web.shims",   re.compile(r"^apps/web/src/shims/")),
    ("web.styles",  re.compile(r"^apps/web/src/(styles|utils)/")),
    ("web.electron", re.compile(r"^apps/web/electron/")),
    ("web.assets",  re.compile(r"^apps/web/public/")),
]

# 测试文件归属：按关键词路由到被测功能
def test_owner(path: str) -> str:
    p = path.lower()
    if "packages/server" in p:
        if any(k in p for k in ("runtime", "codex", "hermes", "agent-tools", "skill-template",
                                "function-tool", "harness", "adapters/", "/agents/")):
            return "server.adapters"
        if "/ws/" in p or "chat-handler" in p or "message-parts" in p:
            return "server.ws"
        if "storage" in p or "store" in p:
            return "server.storage"
        return "server.services"
    if p.startswith("apps/web/"):
        if "workflow" in p: return "web.workflow"
        if "mini-app" in p: return "web.mini-apps"
        if "/chat/" in p or "composer" in p: return "web.chat"
        return "web.lib"
    if p.startswith("packages/sdk/") or p.startswith("packages/shared/"):
        return "sdk.api"
    return "server.services"

# ---------- role 提取 ----------
def head_role(path: str) -> str:
    t = ftype(path)
    if t not in {"ts", "tsx", "js", "jsx", "mjs", "sh", "py", "css"}:
        return ""
    try:
        with open(path, "rb") as f:
            head_bytes = f.read(1500)
        text = head_bytes.decode("utf-8", errors="replace")
    except OSError:
        return ""
    lines = [l.rstrip() for l in text.splitlines() if l.strip()]
    for line in lines[:6]:
        s = line.strip()
        if s.startswith("/*"):
            s = s.lstrip("/*").strip()
        elif s.startswith("*"):
            s = s.lstrip("*").strip()
        elif s.startswith("//"):
            s = s[2:].strip()
        elif s.startswith("#") and not s.startswith("#!"):
            s = s[1:].strip()
        elif s.startswith("<!--"):
            s = s.lstrip("<!--").strip()
        else:
            break
        s = s.strip("*/").strip()
        if not s or s in {"*", "*/"} or s.startswith("@"):
            continue
        if len(s) < 3:
            continue
        return s[:200]
    return ""

# ---------- 描述表 ----------
FEATURES = [
    # (id, name, desc, icon, tests)
    ("infra.docs", "文档与上下文", "CLAUDE.md/claude 索引、docs 指南、迁移笔记、审查报告", "📚"),
    ("infra.scripts", "工程与脚本", "根配置、workspace 清单、i18n 审计与拷贝校验脚本", "🛠️"),
    ("infra.logs", "运行日志", "packages/logs 服务端滚动日志（数据，非代码）", "🧾"),
    ("sdk.api", "前端 SDK", "@flow-spaces/sdk：38 个 API 模块封装全部后端 HTTP 调用", "🧩"),
    ("shared.types", "共享类型", "@flow-spaces/shared：前后端共享 TS 类型（27 个域）", "🔤"),
    ("templates.plugins", "插件模板", "30+ 插件模板（openai/comfyui/feishu/notion/ffmpeg…）", "🏗️"),
    ("templates.mini-app", "Mini App 模板", "内置 Mini App 打包产物与索引（ai_image_video/kanban…）", "📦"),
    ("templates.workflows", "Workflow 模板", "内置工作流模板与索引", "🌀"),
    ("templates.build", "模板构建", "generate-index.mjs / pack-mini-apps.mjs 打包流水线", "⚙️"),
    ("server.entry", "服务入口", "Express 5 app.ts、中间件、类型注册", "🚪"),
    ("server.routes", "REST 路由", "25 个路由模块 /api/*（42+ 端点域）", "🛣️"),
    ("server.services", "业务服务", "74 个服务：workflow 引擎、issue、chat-run、团队协作、通知", "🔧"),
    ("server.storage", "存储层", "19 个 store：SQLite/JSON 持久化、SQL 安全", "🗄️"),
    ("server.adapters", "AI 运行时适配", "Claude Code/Codex/Grok/Gemini CLI/LangChain 等 20 runtime", "🤖"),
    ("server.ws", "WebSocket", "聊天/终端/语音/执行通道实时通信", "🔌"),
    ("server.dev", "开发工具", "插件测试运行器等 dev 辅助", "🧪"),
    ("server.public", "服务端静态资源", "provider-icons/cli-icons 等静态文件", "🖼️"),
    ("data.mini-apps", "运行时 Mini Apps", "flow-spaces-data/mini-apps：22 个已安装迷你应用", "🪄"),
    ("data.plugins", "运行时插件", "flow-spaces-data/plugins：14 个已安装插件", "🔌"),
    ("data.agent-templates", "Agent 模板", "agent-generator/commit-agent/title-generator", "🧠"),
    ("data.llm-catalog", "LLM 目录", "llm/catalog.json 模型目录", "📖"),
    ("data.workspaces", "工作区数据", "workflows/workspaces/user-profile/database/knowledge-bases", "🗃️"),
    ("web.entry", "入口与路由", "main.tsx SPA 入口、react-router 路由表、Vite 配置", "🌐"),
    ("web.workflow", "工作流编辑器", "126 文件：xyflow 画布、节点视图、自动布局、执行态", "🌀"),
    ("web.mini-apps", "Mini App 页面", "列表/编辑器/预览页与工作流配置", "🪄"),
    ("web.chat", "聊天与输入", "chat 会话流、composer 输入区、消息渲染", "💬"),
    ("web.boardui", "BoardUI 组件库", "base/application/foundations/reui 源码级组件", "🎨"),
    ("web.ui", "通用 UI", "ui/common/table/viewers/decorations 组件", "🧱"),
    ("web.shell", "壳与导航", "SidebarRail、首页、命令面板、设置、仪表盘", "🏠"),
    ("web.editor", "CodeMirror 编辑器", "CodeMirror 6 组件、语言映射、模型动作", "📝"),
    ("web.git-plugins", "Git 与插件 UI", "git 面板、workflow 插件面板", "🌿"),
    ("web.stores", "状态管理", "14 个 store：workspace/chat/agent/workflow/editor", "🧠"),
    ("web.lib", "基础库", "SDK 客户端、WS、主题、路由表、模型目录等 43 模块", "📚"),
    ("web.hooks", "Hooks", "9 个通用 hooks", "🪝"),
    ("web.i18n", "国际化", "en/zh 双语消息（next-intl shim）", "🌍"),
    ("web.shims", "Next 兼容层", "next/* → SPA shim（dynamic/image/navigation/next-intl）", "🌉"),
    ("web.styles", "样式与工具", "globals.css/typography.css、cx 等工具", "🖌️"),
    ("web.electron", "Electron 桌面", "main.mjs/preload.cjs", "🖥️"),
    ("web.assets", "静态资源", "public/icons 1085 个图标、CodeMirror 依赖打包等", "🖼️"),
]

CATEGORY_OF = {
    "infra.docs": ("infra", "工程与文档"), "infra.scripts": ("infra", "工程与文档"),
    "infra.logs": ("infra", "工程与文档"),
    "sdk.api": ("packages", "共享包"), "shared.types": ("packages", "共享包"),
    "templates.plugins": ("templates", "模板包"), "templates.mini-app": ("templates", "模板包"),
    "templates.workflows": ("templates", "模板包"), "templates.build": ("templates", "模板包"),
    "server.entry": ("server", "服务端"), "server.routes": ("server", "服务端"),
    "server.services": ("server", "服务端"), "server.storage": ("server", "服务端"),
    "server.adapters": ("server", "服务端"), "server.ws": ("server", "服务端"),
    "server.dev": ("server", "服务端"), "server.public": ("server", "服务端"),
    "data.mini-apps": ("runtime-data", "运行时数据"), "data.plugins": ("runtime-data", "运行时数据"),
    "data.agent-templates": ("runtime-data", "运行时数据"), "data.llm-catalog": ("runtime-data", "运行时数据"),
    "data.workspaces": ("runtime-data", "运行时数据"),
    "web.entry": ("web", "Web 前端"), "web.workflow": ("web", "Web 前端"),
    "web.mini-apps": ("web", "Web 前端"), "web.chat": ("web", "Web 前端"),
    "web.boardui": ("web", "Web 前端"), "web.ui": ("web", "Web 前端"),
    "web.shell": ("web", "Web 前端"), "web.editor": ("web", "Web 前端"),
    "web.git-plugins": ("web", "Web 前端"), "web.stores": ("web", "Web 前端"),
    "web.lib": ("web", "Web 前端"), "web.hooks": ("web", "Web 前端"),
    "web.i18n": ("web", "Web 前端"), "web.shims": ("web", "Web 前端"),
    ("web.styles"): ("web", "Web 前端"), ("web.electron"): ("web", "Web 前端"),
    ("web.assets"): ("web", "Web 前端"),
}

def main() -> int:
    files = subprocess.run(["git", "-C", ROOT, "ls-files", "-z"],
                           capture_output=True).stdout.decode().split("\0")
    files = [f for f in files if f.strip()]
    # 排除：索引自身产物（本次生成物）
    EXCLUDE = {"docs/feature_map.json", "docs/feature_map.html"}

    nodes = {fid: {"id": fid, "name": name, "desc": desc, "files": [], "tests": []}
             for fid, name, desc, _ in FEATURES}
    unmapped = []
    shared_count = 0
    file_owner_count = {}

    for path in files:
        if path in EXCLUDE:
            continue
        if not os.path.exists(os.path.join(ROOT, path)):
            unmapped.append({"path": path, "reason": "tracked 但文件系统不存在（幽灵路径）"})
            continue
        fid = None
        for rid, pat in PFX_RULES:
            if pat.match(path):
                fid = rid
                break
        if fid is None:
            unmapped.append({"path": path, "reason": "无归属规则命中"})
            continue
        t = ftype(path)
        entry = {"path": path, "type": t}
        if t in TEXT_TYPES or path.endswith((".svg", ".txt")):
            try:
                with open(os.path.join(ROOT, path), "rb") as f:
                    n = sum(1 for _ in f)
                entry["lines"] = n
            except OSError:
                pass
        role = head_role(path)
        if role:
            entry["role"] = role
        if is_test(path) and not path.startswith(("docs/", ".review/")):
            owner = test_owner(path)
            nodes[owner]["tests"].append({**entry, "note": role or "自动化测试"})
        else:
            nodes[fid]["files"].append(entry)
        file_owner_count[path] = file_owner_count.get(path, 0) + 1

    # 行数合计 & 文件计数
    def total_lines(node):
        return sum(e.get("lines") or 0 for e in node["files"]) + sum(e.get("lines") or 0 for e in node["tests"])

    tree_order = ["web", "server", "runtime-data", "packages", "templates", "infra"]
    tree = []
    for cat in tree_order:
        cat_name = next(name for (c, name), key in zip(CATEGORY_OF.values(), CATEGORY_OF.keys()) if c == cat) if False else None
        children = []
        for fid, name, desc, _ in FEATURES:
            if CATEGORY_OF[fid][0] == cat:
                nd = nodes[fid]
                if not nd["files"] and not nd["tests"]:
                    continue
                nd["desc"] += f"（{len(nd['files'])} 文件 / {total_lines(nd):,} 行）"
                children.append(nd)
        icon = {"web": "🌐", "server": "⚙️", "runtime-data": "🗃️", "packages": "📦", "templates": "🏗️", "infra": "📚"}[cat]
        tree.append({"id": cat, "name": {"web": "Web 前端", "server": "服务端", "runtime-data": "运行时数据",
                                         "packages": "共享包", "templates": "模板包", "infra": "工程与文档"}[cat],
                     "icon": icon, "children": children})

    data = {
        "project": PROJECT,
        "description": "flow-spaces 功能依赖图谱：功能 → 文件映射、行数排行、覆盖率报告",
        "generated": "2026-11-15",
        "head_commit": HEAD,
        "legend": {"types": "ts/tsx/js/jsx/mjs=代码 sh/py=脚本 md=文档 config=配置 data=资源(含svg/图片/二进制) css/html=样式页面 dir=目录",
                   "note": "一个文件可归属多个功能（shared）；tests 挂在被测功能的 tests[] 下"},
        "tree": tree,
        "vendored": [],
        "unmapped": unmapped,
    }

    os.makedirs(DOCS, exist_ok=True)
    out_json = os.path.join(DOCS, "feature_map.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)

    # ---------- 校验 1：双向 diff ----------
    with open(out_json, encoding="utf-8") as f:
        data2 = json.load(f)  # 校验 2：可解析
    json_paths = set()
    for cat in data2["tree"]:
        for ch in cat["children"]:
            for e in ch.get("files", []):
                json_paths.add(e["path"])
            for e in ch.get("tests", []):
                json_paths.add(e["path"])
    tracked = {p for p in files if p not in EXCLUDE}
    ghost = sorted(p for p in json_paths if not os.path.exists(os.path.join(ROOT, p)))
    missing = sorted(tracked - json_paths)
    print(f"[check] JSON 引用文件 {len(json_paths)}；ghost={len(ghost)} missing={len(missing)} unmapped={len(unmapped)}")
    for p in missing[:20]:
        print("  MISSING:", p)
    for u in unmapped[:20]:
        print("  UNMAPPED:", u)

    # ---------- 校验 3：模板注入 ----------
    with open(SKILL_TPL, encoding="utf-8") as f:
        tpl = f.read()
    payload = json.dumps(data2, ensure_ascii=False, separators=(",", ":"))
    assert tpl.count("__JSON_SEED__") == 1, f"占位符计数={tpl.count('__JSON_SEED__')}（应为 1）"
    assert "</script" not in payload, "payload 含 </script，需转义"
    html = tpl.replace("__JSON_SEED__", payload)
    html = html.replace("<title>Pixel World — 功能依赖图谱</title>", f"<title>{PROJECT} — 功能依赖图谱</title>")
    html = html.replace("<h1>Pixel <span class=\"px\">World</span>", f"<h1>flow <span class=\"px\">spaces</span>")
    assert "__JSON_SEED__" not in html, "占位符残留"
    out_html = os.path.join(DOCS, "feature_map.html")
    with open(out_html, "w", encoding="utf-8") as f:
        f.write(html)

    # seed 段重新解析
    m = re.search(r'<script type="application/json" id="seed">(.*?)</script>', html, re.S)
    assert m, "seed 段未找到"
    json.loads(m.group(1))
    # 主脚本抽出供 node --check
    scripts = re.findall(r"<script>(.*?)</script>", html, re.S)
    assert scripts, "主脚本未找到"
    js_path = "/tmp/feature_map_main.js"
    with open(js_path, "w", encoding="utf-8") as f:
        f.write(scripts[-1])
    r = subprocess.run(["node", "--check", js_path], capture_output=True, text=True)
    assert r.returncode == 0, f"node --check 失败:\n{r.stderr[:800]}"

    n_files = sum(len(ch["files"]) for cat in tree for ch in cat["children"])
    n_tests = sum(len(ch["tests"]) for cat in tree for ch in cat["children"])
    n_feats = sum(len(cat["children"]) for cat in tree)
    print(f"[ok] 功能节点 {n_feats}；文件 {n_files}（另测试 {n_tests}）；seed 解析 OK；node --check OK")
    print(f"[ok] 覆盖率: {len(json_paths & tracked)}/{len(tracked)} = {len(json_paths & tracked)/len(tracked)*100:.1f}%")
    return 0 if not ghost and not missing else 1

if __name__ == "__main__":
    sys.exit(main())
