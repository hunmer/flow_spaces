/**
 * Editor 演示 —— editor（tree/content/save/CRUD/state/import）
 */
import { sdk, $, run, loadWorkspaceOptions, escapeHtml } from './sdk-config.js';

const wsSelect = $('#ws-select');
loadWorkspaceOptions(wsSelect);

function wsId() {
  const id = wsSelect.value;
  if (!id) throw new Error('请先选择工作区');
  return id;
}

function parseJSON(text, hint) {
  if (!text.trim()) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`JSON 解析失败：${hint}`);
  }
}

// ---- 文件树 ----
$('#btn-tree').addEventListener('click', (e) =>
  run(e.target, $('#out-tree'), () => sdk().editor.tree(wsId())),
);
$('#btn-exists').addEventListener('click', (e) =>
  run(e.target, $('#out-tree'), () => sdk().editor.exists(wsId(), $('#in-path').value.trim())),
);
$('#btn-reveal').addEventListener('click', (e) =>
  run(e.target, $('#out-tree'), () => sdk().editor.reveal(wsId(), $('#in-path').value.trim())),
);

// ---- 读写 ----
const rwPath = () => $('#in-rw-path').value.trim();
$('#btn-content').addEventListener('click', (e) =>
  run(e.target, $('#out-rw'), () => sdk().editor.content(wsId(), rwPath())),
);
$('#btn-save').addEventListener('click', (e) =>
  run(e.target, $('#out-rw'), async () => {
    const content = $('#in-rw-content').value;
    await sdk().editor.save(wsId(), rwPath(), content);
    return { message: '已保存', path: rwPath() };
  }),
);

// ---- 文件操作 ----
$('#btn-copy').addEventListener('click', (e) =>
  run(e.target, $('#out-op'), () => sdk().editor.copy(wsId(), $('#in-src').value.trim(), $('#in-dest').value.trim())),
);
$('#btn-rename').addEventListener('click', (e) =>
  run(e.target, $('#out-op'), () => sdk().editor.rename(wsId(), $('#in-src').value.trim(), $('#in-dest').value.trim())),
);
$('#btn-delete').addEventListener('click', (e) =>
  run(e.target, $('#out-op'), () => sdk().editor.deleteFile(wsId(), $('#in-src').value.trim())),
);
$('#btn-search').addEventListener('click', (e) =>
  run(e.target, $('#out-op'), () => sdk().editor.search(wsId(), { query: $('#in-search').value.trim() })),
);

// ---- 编辑器状态 ----
$('#btn-state-get').addEventListener('click', (e) =>
  run(e.target, $('#out-state'), () => sdk().editor.editorState(wsId())),
);
$('#btn-state-save').addEventListener('click', (e) =>
  run(e.target, $('#out-state'), async () => {
    const state = parseJSON($('#in-state').value, 'state');
    await sdk().editor.saveEditorState(wsId(), state);
    return { message: '已保存编辑器状态' };
  }),
);

// ---- 导入 ----
const target = () => $('#in-target').value.trim();
$('#btn-import-url').addEventListener('click', (e) =>
  run(e.target, $('#out-import'), () => sdk().editor.importUrl(wsId(), $('#in-url').value.trim(), target())),
);
$('#btn-import-path').addEventListener('click', (e) =>
  run(e.target, $('#out-import'), () => sdk().editor.importPath(wsId(), $('#in-abspath').value.trim(), target())),
);
$('#btn-upload').addEventListener('click', (e) =>
  run(e.target, $('#out-import'), async () => {
    const files = Array.from($('#in-files').files);
    if (files.length === 0) throw new Error('请选择文件');
    return sdk().editor.uploadFiles(wsId(), target(), files);
  }),
);
