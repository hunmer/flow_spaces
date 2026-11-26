import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { getToolDetail, saveToolDetails, type ToolDetail } from '../src/services/tool-detail.js';

test('tool details match by exact messageId only', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'flow-spaces-tool-detail-'));
  const previousDataDir = process.env.FLOW_SPACES_DATA_DIR;
  process.env.FLOW_SPACES_DATA_DIR = dataDir;

  try {
    const detail: ToolDetail = {
      id: 'tool-1',
      workspaceId: 'workspace-1',
      channelId: 'channel-1',
      messageId: 'source-message',
      title: 'search',
      raw: 'Tool: search',
      createdAt: new Date().toISOString(),
    };
    saveToolDetails(detail.workspaceId, detail.channelId, [detail]);

    assert.equal(getToolDetail('workspace-1', 'channel-1', 'source-message', detail.id)?.id, detail.id);
    assert.equal(getToolDetail('workspace-1', 'channel-1', 'other-message', detail.id), null);
    assert.equal(getToolDetail('workspace-1', 'other-channel', 'source-message', detail.id), null);
  } finally {
    if (previousDataDir === undefined) delete process.env.FLOW_SPACES_DATA_DIR;
    else process.env.FLOW_SPACES_DATA_DIR = previousDataDir;
    rmSync(dataDir, { recursive: true, force: true });
  }
});
