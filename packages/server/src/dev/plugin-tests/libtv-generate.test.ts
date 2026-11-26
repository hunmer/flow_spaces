import assert from 'node:assert/strict';
import type { LoadedPlugin } from '../plugin-test-harness.js';

/**
 * libtv 插件生成动作测试（消耗积分，使用最低消耗默认配置）：
 * create canvas -> use -> generate_text (GVLM 3.1 Flash) -> generate_image (z-image 1K x1)
 */
export default async function run(plugin: LoadedPlugin) {
  // 0. 前置：已登录
  const status = (await plugin.runAction('libtv_status', {})) as {
    success: boolean;
    data: { loggedIn: boolean };
  };
  assert.equal(status.success && status.data.loggedIn, true, 'libtv not logged in');

  // 1. 新建隔离测试画布（免费）
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const created = (await plugin.runAction('libtv_project_create', {
    name: `libtv-plugin-test-${stamp}`,
    description: 'libtv plugin local test canvas',
  })) as { success: boolean; message: string; data: { uuid?: string; projectUuid?: string } };
  assert.equal(created.success, true, `project_create failed: ${created.message}`);
  const uuid = created.data.uuid || created.data.projectUuid;
  assert.ok(uuid, 'canvas uuid missing in project_create result');
  console.log('[libtv-generate] canvas created:', uuid);

  // 2. 绑定工作目录（免费）
  const bound = (await plugin.runAction('libtv_project_use', { projectUuid: uuid })) as {
    success: boolean;
    message: string;
  };
  assert.equal(bound.success, true, `project_use failed: ${bound.message}`);

  // 3. 文本生成（最低消耗档：GVLM 3.1 Flash）
  const text = (await plugin.runAction('libtv_generate_text', {
    nodeName: '旁白',
    prompt: '用一句话描述清晨海边城市的日出景象，30字以内。',
  })) as { success: boolean; message: string; data: unknown; text: string };
  console.log('[libtv-generate] text:', text.message, '| sample:', (text.text || '').slice(0, 60));
  assert.equal(text.success, true, `generate_text failed: ${text.message}`);

  // 4. 图片生成（最低消耗档：z-image + 1K + count=1）
  const image = (await plugin.runAction('libtv_generate_image', {
    nodeName: '主视觉',
    prompt: '极简扁平插画风格，一只橘猫坐在窗台晒太阳，暖色调',
    model: 'z-image',
    quality: '1K',
    ratio: '1:1',
    count: 1,
  })) as { success: boolean; message: string; data: unknown; urls: string[] };
  console.log('[libtv-generate] image:', image.message, '| urls:', image.urls);
  assert.equal(image.success, true, `generate_image failed: ${image.message}`);
  assert.ok(image.urls.length > 0, 'no image url extracted from generation result');

  return {
    success: true,
    canvasUrl: `https://www.liblib.tv/canvas?projectId=${uuid}`,
    projectUuid: uuid,
    textPreview: (text.text || '').slice(0, 120),
    imageUrls: image.urls,
  };
}
