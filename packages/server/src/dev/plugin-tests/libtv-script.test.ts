import assert from 'node:assert/strict';
import type { LoadedPlugin } from '../plugin-test-harness.js';

/**
 * libtv script/storyboard 真实生成测试（消耗积分，最低档配置）：
 * project_create 新画布 → generate_script（aurora-3-lite）→ script_storyboard（z-image/1K）
 * prompt 明确限定 2 个镜头，把分镜图积分消耗压到最低。
 */
export default async function run(plugin: LoadedPlugin) {
  const stamp = Date.now().toString(36);
  const canvasName = `libtv-plugin-script-test-${stamp}`;

  // 1. 新建画布并绑定
  const created = (await plugin.runAction('libtv_project_create', {
    name: canvasName,
    description: 'libtv plugin script/storyboard test (auto-cleanup candidate)',
  })) as { success: boolean; message: string; data: { uuid: string; canvasUrl: string } };
  assert.equal(created.success, true, `project_create failed: ${created.message}`);
  const uuid = created.data.uuid;
  console.log('[libtv-script] canvas:', uuid, created.data.canvasUrl);

  const used = (await plugin.runAction('libtv_project_use', { projectUuid: uuid })) as {
    success: boolean;
    message: string;
  };
  assert.equal(used.success, true, `project_use failed: ${used.message}`);

  // 2. 生成分镜脚本（aurora-3-lite 低消耗档；限定 2 镜头）
  const scriptNode = `脚本-${stamp}`;
  const script = (await plugin.runAction('libtv_generate_script', {
    nodeName: scriptNode,
    prompt: '一只橘猫在窗台晒太阳，打了个哈欠。请只分 2 个镜头，每镜 2 秒。',
    count: 1,
  })) as { success: boolean; message: string; rowsCount: number };
  console.log('[libtv-script] generate_script:', script.message, 'rows =', script.rowsCount);
  assert.equal(script.success, true, `generate_script failed: ${script.message}`);
  assert.ok(script.rowsCount > 0, 'script generated no storyboard rows');

  // 3. 渲染分镜图（seedream-5 + 1K 最低消耗档；z-image 会被 CLI 分镜校验拒绝）
  const board = (await plugin.runAction('libtv_script_storyboard', {
    nodeName: scriptNode,
    imageModel: 'seedream-5',
    quality: '1K',
    ratio: '1:1',
  })) as {
    success: boolean;
    message: string;
    groupNodeKey: string;
    imagesOk: number;
    imagesTotal: number;
  };
  console.log(
    '[libtv-script] storyboard:',
    board.message,
    `group=${board.groupNodeKey} ok=${board.imagesOk}/${board.imagesTotal}`,
  );
  assert.equal(board.success, true, `script_storyboard failed: ${board.message}`);
  assert.ok(board.imagesOk > 0, 'storyboard rendered no images');

  return {
    success: true,
    canvas: uuid,
    canvasUrl: created.data.canvasUrl,
    rows: script.rowsCount,
    imagesOk: board.imagesOk,
    imagesTotal: board.imagesTotal,
  };
}
