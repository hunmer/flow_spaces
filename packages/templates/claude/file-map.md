# packages/templates 文件索引

```
packages/templates/
├── package.json            # @flow-spaces/agents；build/serve/generate-index 脚本
├── generate-index.mjs      # 生成 plugins/mini-app/workflows 各 index.json
├── pack-mini-apps.mjs      # 打包 mini-app/*.zip
├── CLAUDE.md               # 索引（本目录）
├── claude/                 # 详情文档
├── plugins/                # 42 个插件模板（ai-image, aliyun-ai, aliyun_oss, audio-separator,
│                           #  baidu-image, comfyui, custom-view-demo, depth-anything,
│                           #  desktop-native, dingtalk, eagle, epub-parser, feed-parser,
│                           #  feishu, fetch, ffmpeg, file-system, fish-audio, index.json,
│                           #  jianying-draft, jimeng, libtv, lumimatte, mail, mcp-bridge,
│                           #  minimax, mira-sdk, nano-banana, notion, obsidian, openai,
│                           #  qianyin, rembg, …）
├── mini-app/               # 10 个内置 Mini App zip + icons/ + index.json + intro/
└── workflows/              # 内置工作流模板（code-writing.json 等）+ index.json
```

文件级映射见根 `docs/feature_map.html`（templates.* 节点）。
