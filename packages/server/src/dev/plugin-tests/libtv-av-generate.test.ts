import assert from 'node:assert/strict';
import type { LoadedPlugin } from '../plugin-test-harness.js';

/**
 * libtv 插件视频/音频生成测试（消耗积分，最低成本配置）：
 * video: star-video2.5-draft（样片 480P）+ 4s + 无声 + 1 条 —— 平台最低成本视频档
 * audio: speech-2.8-turbo（TTS 快速档）+ 短文案 + 1 条
 */
export default async function run(plugin: LoadedPlugin) {
  const stamp = Date.now().toString(36);

  // 0. 前置：CLI 可用且已登录
  const status = (await plugin.runAction('libtv_status', {})) as {
    success: boolean;
    data: { loggedIn: boolean };
  };
  assert.equal(status.data.loggedIn, true, 'libtv not logged in');

  // 1. 新建测试画布（免费）并绑定
  const created = (await plugin.runAction('libtv_project_create', {
    name: `libtv-plugin-av-test-${stamp}`,
    description: 'plugin av-generation test (cheapest tier)',
  })) as { success: boolean; message: string; data: { uuid: string } };
  assert.equal(created.success, true, `project_create failed: ${created.message}`);
  const projectUuid = created.data.uuid;
  console.log('[libtv-av] canvas:', projectUuid);

  const bound = (await plugin.runAction('libtv_project_use', { projectUuid })) as {
    success: boolean;
  };
  assert.equal(bound.success, true, 'project_use failed');

  try {
    // 2. 音频（TTS 快速档，低积分）：短文案
    const audio = (await plugin.runAction('libtv_generate_audio', {
      nodeName: '测试配音',
      prompt: '这是通过 libtv 插件生成的测试配音。',
      projectUuid,
    })) as { success: boolean; message: string; urls: string[] };
    console.log('[libtv-av] audio:', audio.message, 'urls:', (audio.urls || []).length);
    assert.equal(audio.success, true, `generate_audio failed: ${audio.message}`);
    assert.ok(audio.urls.length > 0, 'audio urls empty');

    // 3. 视频（样片 480P + 4s + 无声 + 1 条，最低成本档）
    const video = (await plugin.runAction('libtv_generate_video', {
      nodeName: '测试视频',
      prompt: '一只橘猫在窗台上打哈欠，镜头缓慢拉近',
      projectUuid,
    })) as { success: boolean; message: string; urls: string[]; poster: string };
    console.log(
      '[libtv-av] video:', video.message,
      'urls:', (video.urls || []).length, 'poster:', video.poster ? 'yes' : 'no',
    );
    assert.equal(video.success, true, `generate_video failed: ${video.message}`);
    assert.ok(video.urls.length > 0, 'video urls empty');

    return { success: true, projectUuid, audioUrl: audio.urls[0], videoUrl: video.urls[0] };
  } finally {
    // 保留画布供人工查看；控制台输出 uuid
    console.log('[libtv-av] canvas kept for inspection:', projectUuid);
  }
}
