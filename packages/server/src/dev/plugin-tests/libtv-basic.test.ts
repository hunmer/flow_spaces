import assert from 'node:assert/strict';
import type { LoadedPlugin } from '../plugin-test-harness.js';

/**
 * libtv 插件免费动作测试（不消耗积分）：
 * status / model_search / project_list / node_list
 */
export default async function run(plugin: LoadedPlugin) {
  const names = plugin.listActions();
  console.log('[libtv-basic] actions:', names.join(', '));
  assert.equal(names.length, 13, `expected 13 actions, got ${names.length}`);
  assert.ok(names.includes('libtv_status'), 'libtv_status action missing');
  assert.ok(names.includes('libtv_generate_image'), 'libtv_generate_image action missing');
  assert.ok(names.includes('libtv_generate_text'), 'libtv_generate_text action missing');
  assert.ok(names.includes('libtv_generate_video'), 'libtv_generate_video action missing');
  assert.ok(names.includes('libtv_generate_audio'), 'libtv_generate_audio action missing');
  assert.ok(names.includes('libtv_generate_script'), 'libtv_generate_script action missing');
  assert.ok(names.includes('libtv_script_storyboard'), 'libtv_script_storyboard action missing');

  // 1. status：CLI 存在 + 已登录
  const status = (await plugin.runAction('libtv_status', {})) as {
    success: boolean;
    message: string;
    data: { loggedIn: boolean; cliVersion: string };
  };
  console.log('[libtv-basic] status:', status.message);
  assert.equal(status.success, true, `status failed: ${status.message}`);
  assert.equal(status.data.loggedIn, true, 'libtv not logged in; run `libtv login web` first');

  // 2. model search image（免费）
  const imageModels = (await plugin.runAction('libtv_model_search', {
    nodeType: 'image',
  })) as { success: boolean; data: { matches: Array<{ modelKey: string }> } };
  assert.equal(imageModels.success, true, 'model_search image failed');
  assert.ok(imageModels.data.matches.length > 0, 'no image models returned');
  assert.ok(
    imageModels.data.matches.some((m) => m.modelKey === 'z-image'),
    'default cheap model z-image not available',
  );

  // 3. model search text（免费）
  const textModels = (await plugin.runAction('libtv_model_search', {
    nodeType: 'text',
  })) as { success: boolean; data: { matches: Array<{ modelKey: string }> } };
  assert.equal(textModels.success, true, 'model_search text failed');
  assert.ok(
    textModels.data.matches.some((m) => m.modelKey === 'aurora-3-lite'),
    'default cheap text model aurora-3-lite not available',
  );

  // 3b. model search video / audio（免费）：默认便宜档模型可用
  const videoModels = (await plugin.runAction('libtv_model_search', {
    nodeType: 'video',
  })) as { success: boolean; data: { matches: Array<{ modelKey: string }> } };
  assert.equal(videoModels.success, true, 'model_search video failed');
  assert.ok(
    videoModels.data.matches.some((m) => m.modelKey === 'star-video2.5-draft'),
    'default cheap video model star-video2.5-draft not available',
  );
  const audioModels = (await plugin.runAction('libtv_model_search', {
    nodeType: 'audio',
  })) as { success: boolean; data: { matches: Array<{ modelKey: string }> } };
  assert.equal(audioModels.success, true, 'model_search audio failed');
  assert.ok(
    audioModels.data.matches.some((m) => m.modelKey === 'speech-2.8-turbo'),
    'default cheap audio model speech-2.8-turbo not available',
  );

  // 3c. model search script（免费）：scriptText/scriptImage 混合维度，两个默认模型都应在列
  const scriptModels = (await plugin.runAction('libtv_model_search', {
    nodeType: 'script',
  })) as { success: boolean; data: { matches: Array<{ modelKey: string }> } };
  assert.equal(scriptModels.success, true, 'model_search script failed');
  assert.ok(
    scriptModels.data.matches.some((m) => m.modelKey === 'aurora-3-lite'),
    'default scriptText model aurora-3-lite not available',
  );
  assert.ok(
    scriptModels.data.matches.some((m) => m.modelKey === 'z-image'),
    'default scriptImage model z-image not available',
  );

  // 4. project list（免费）
  const projects = (await plugin.runAction('libtv_project_list', { pageSize: 5 })) as {
    success: boolean;
    message: string;
  };
  assert.equal(projects.success, true, `project_list failed: ${projects.message}`);
  console.log('[libtv-basic] project_list:', projects.message);

  // 5. node list：未绑定画布时应失败并给出可读错误（目录绑定不存在）
  const nodes = (await plugin.runAction('libtv_node_list', {
    workDir: `/tmp/libtv-plugin-test-unbound-${Date.now()}`,
  })) as { success: boolean; message: string };
  assert.equal(nodes.success, false, 'node_list should fail without canvas binding');
  assert.ok(nodes.message.length > 0, 'node_list failure should carry a readable message');

  return {
    success: true,
    actions: names.length,
    imageModels: imageModels.data.matches.length,
    textModels: textModels.data.matches.length,
  };
}
