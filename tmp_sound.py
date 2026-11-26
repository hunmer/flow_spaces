# -*- coding: utf-8 -*-
import io,json
P='packages/server/flow-spaces-data/mini-apps/game-asset-canvas/src/components/nodes/VideoGeneratorNode.jsx'
s=io.open(P,encoding='utf-8',newline='').read()
nl='\r\n' if '\r\n' in s else '\n'
s=s.replace('\r\n','\n')
# 1) 删除节点内嵌产出预览块（NodeShell 已有统一输出预览）
a=s.index("      {videos.length > 0 && (\n        <div className=\"flex flex-col gap-1.5\">\n          <span className=\"text-xs font-medium text-muted-foreground\">\n            产出")
b=s.index("    </NodeShell>",a)
s=s[:a].rstrip('\n')+'\n'+s[b:]
a=s[s.index("  // 产出优先取 videos 数组"):s.index("  const status = data?.status || 'idle';")]
s=s.replace(a,'',1)
# 2) 声音参数
a="        mode: modeValue,\n"
assert a in s
s=s.replace(a,a+"        enableSound: soundValue,\n",1)
a="modeValue, pluginValue, extraInput])"
assert a in s
s=s.replace(a,"modeValue, soundValue, pluginValue, extraInput])",1)
a="      {/* 时长：按模型约束调整范围"
assert a in s
s=s.replace(a,"""      {/* 声音：libtv 支持音频的模型生效（如 Wan 3.0 / Seedance），不支持的模型由插件自动忽略 */}
      <LabeledSelect label="声音" value={soundValue} options={VIDEO_SOUND_OPTIONS} onChange={(v) => set({ enableSound: v })} />
"""+a,1)
io.open(P,'w',encoding='utf-8',newline='').write(s.replace('\n',nl))

P='packages/server/flow-spaces-data/mini-apps/game-asset-canvas/src/utils/constants.js'
s=io.open(P,encoding='utf-8',newline='').read()
nl='\r\n' if '\r\n' in s else '\n'
a="export const VIDEO_MODE_MODEL_WHITELIST"
assert a in s
s=s.replace(a,"/** 视频声音开关（libtv enableSound；值 off/on，默认关闭以省成本） */\nexport const VIDEO_SOUND_OPTIONS = [\n  { value: 'off', label: '关' },\n  { value: 'on', label: '开' },\n];\n\n"+a,1)
io.open(P,'w',encoding='utf-8',newline='').write(s.replace('\r\n','\n').replace('\n',nl))

P='packages/server/flow-spaces-data/workflows/5130958f-a78e-4c36-8f03-1f2f733b87d7/workflow.json'
d=json.load(open(P,encoding='utf-8'))
st=next(n for n in d['nodes'] if n['id']=='node_1781681576137_start')
if not any(f['key']=='enableSound' for f in st['inputFields']):
    i=next(i for i,f in enumerate(st['inputFields']) if f['key']=='plugin')
    st['inputFields'].insert(i,{"key":"enableSound","type":"select","value":"off","description":"是否开启声音（仅 libtv 支持音频的模型生效）","required":False,"children":[],"inputMode":"native","options":["off","on"]})
n=next(n for n in d['nodes'] if n['id']=='node_1794936170449_a961b1')
n['data']['enableSound']='{{ __data__["node_1781681576137_start"].enableSound }}'
json.dump(d,open(P,'w',encoding='utf-8'),ensure_ascii=False,indent=2)
print('ok')
