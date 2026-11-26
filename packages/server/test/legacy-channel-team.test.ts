import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createChannel, getChannel, listChannels, updateChannel } from '../src/services/channel.js';
import { listMessages } from '../src/services/message.js';
import type { Channel, Message } from '@flow-spaces/shared';

// Team 功能移除后的存量数据兼容回归：
// 旧 channel JSON 带 teamIds、旧 team 消息带 metadata.teamId，读写都必须安全降级。

function useTempDataDir(): string {
  const dataDir = mkdtempSync(join(tmpdir(), 'flow-spaces-legacy-channel-'));
  process.env.FLOW_SPACES_DATA_DIR = dataDir;
  return dataDir;
}

function writeLegacyStorage(dataDir: string) {
  const channelsDir = join(dataDir, 'workspaces', 'ws-legacy', 'channels');
  mkdirSync(channelsDir, { recursive: true });
  const legacyChannel = {
    id: 'legacy-1',
    workspaceId: 'ws-legacy',
    name: '旧团队频道',
    type: 'general',
    members: ['agent-a', 'agent-b'],
    teamIds: ['team-1'],
    createdAt: '2025-01-01T00:00:00.000Z',
  } as unknown as Channel;
  writeFileSync(join(channelsDir, 'index.json'), JSON.stringify([legacyChannel], null, 2), 'utf8');

  const legacyChannelDir = join(channelsDir, 'legacy-1');
  mkdirSync(legacyChannelDir, { recursive: true });
  const legacyTeamMessage = {
    id: 'msg-team-1',
    channelId: 'legacy-1',
    senderId: 'team:team-1',
    senderRole: 'team',
    content: '旧团队消息',
    status: 'completed',
    createdAt: '2025-01-01T00:01:00.000Z',
    metadata: { teamId: 'team-1', teamName: '旧团队', sessionId: 'session-1' },
  } as unknown as Message;
  writeFileSync(join(legacyChannelDir, 'messages.json'), JSON.stringify([legacyTeamMessage], null, 2), 'utf8');
}

test('legacy channel with teamIds and team messages loads safely', () => {
  const dataDir = useTempDataDir();
  try {
    writeLegacyStorage(dataDir);

    const channels = listChannels('ws-legacy');
    assert.equal(channels.length, 1);

    const legacy = getChannel('ws-legacy', 'legacy-1');
    assert.ok(legacy);
    // 普通成员保留，不受 team 移除影响
    assert.deepEqual(legacy.members, ['agent-a', 'agent-b']);
    // 存量 teamIds 字段被安全忽略（类型已删，运行时原样带过不崩）
    assert.deepEqual((legacy as unknown as { teamIds?: string[] }).teamIds, ['team-1']);

    // 旧 team 消息降级为普通消息：可读、不崩、metadata 原样保留
    const messages = listMessages('ws-legacy', 'legacy-1');
    assert.equal(messages.length, 1);
    assert.equal(messages[0].content, '旧团队消息');
    assert.equal((messages[0].metadata as Record<string, unknown> | undefined)?.teamId, 'team-1');
  } finally {
    delete process.env.FLOW_SPACES_DATA_DIR;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('createChannel ignores legacy teamIds request without touching team services', () => {
  const dataDir = useTempDataDir();
  try {
    writeLegacyStorage(dataDir);

    // 旧客户端仍传 teamIds：不崩、被忽略，且不会触发任何 team 服务调用（服务已删除）
    const { channel, created } = createChannel('ws-legacy', {
      name: '新频道',
      type: 'general',
      members: [],
      teamIds: ['team-1'],
    } as Parameters<typeof createChannel>[1] & { teamIds: string[] });
    assert.equal(created, true);
    assert.equal(!('teamIds' in channel), true);

    // 写回的 channels/index.json 中新条目无 teamIds，旧条目的 teamIds 原样保留（读写安全）
    const channels = listChannels('ws-legacy');
    assert.equal(channels.length, 2);
    const legacy = channels.find((c) => c.id === 'legacy-1') as unknown as { teamIds?: string[] };
    assert.deepEqual(legacy.teamIds, ['team-1']);
    const fresh = channels.find((c) => c.id === channel.id) as unknown as { teamIds?: string[] };
    assert.equal(fresh.teamIds, undefined);
  } finally {
    delete process.env.FLOW_SPACES_DATA_DIR;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('updateChannel ignores legacy teamIds patch and preserves other fields', () => {
  const dataDir = useTempDataDir();
  try {
    writeLegacyStorage(dataDir);

    const updated = updateChannel('ws-legacy', 'legacy-1', {
      name: '改名后',
      teamIds: [],
    } as Parameters<typeof updateChannel>[2] & { teamIds: string[] });
    assert.ok(updated);
    assert.equal(updated.name, '改名后');
    // members 不受影响；teamIds 被忽略——既不清洗也不崩溃
    assert.deepEqual(updated.members, ['agent-a', 'agent-b']);
    assert.deepEqual((updated as unknown as { teamIds?: string[] }).teamIds, ['team-1']);
  } finally {
    delete process.env.FLOW_SPACES_DATA_DIR;
    rmSync(dataDir, { recursive: true, force: true });
  }
});
