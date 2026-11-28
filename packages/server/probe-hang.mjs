// 挂点二分探针：逐个 import 启动链模块，打印耗时。仅诊断用，跑完即删。
console.log('[probe] start', new Date().toISOString());
process.env.FLOW_SPACES_PLUGINS_DIR = 'E:/flow-spaces-plugins';
process.env.FLOW_SPACES_WORKFLOWS_DIR = 'E:/flow-spaces-workflows';
process.env.FLOW_SPACES_MINI_APPS_DIR = 'E:/flow-spaces-mini-apps';

const t0 = Date.now();
for (const m of [
  './src/storage/json-store.ts',
  './src/storage/mini-app-store.ts',
  './src/services/mini-apps.ts',
  './src/services/mini-app-services.ts',
  './src/services/mini-app-agent.ts',
]) {
  console.log('[probe] importing', m);
  await import(m);
  console.log('[probe] ok', m, `+${Date.now() - t0}ms`);
}
console.log('[probe] all done, total', `${Date.now() - t0}ms`);
