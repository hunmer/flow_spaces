import { join } from 'node:path';
import { existsSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { readJsonFile, writeJsonFile, getDataDir, ensureDir } from '../storage/json-store.js';

export interface UserProfile {
  name: string;
  avatarUrl: string | null;
}

const PROFILE_FILE = () => join(getDataDir(), 'user-profile.json');
const AVATAR_DIR = () => join(getDataDir(), 'user-profile');
const AVATAR_RE = /^avatar\.(png|jpg|jpeg|webp|gif)$/;

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

const DEFAULT_NAME = 'Flow Spaces';

export function getProfile(): UserProfile {
  const data = readJsonFile<Partial<UserProfile>>(PROFILE_FILE());
  return {
    name: typeof data?.name === 'string' && data.name.trim() !== '' ? data.name : DEFAULT_NAME,
    avatarUrl: typeof data?.avatarUrl === 'string' ? data.avatarUrl : null,
  };
}

export function updateName(name: string): UserProfile {
  const profile = getProfile();
  profile.name = name;
  writeJsonFile(PROFILE_FILE(), profile);
  return profile;
}

/** 删除旧头像文件（存在时） */
function deleteOldAvatar(): void {
  try {
    if (!existsSync(AVATAR_DIR())) return;
    for (const f of readdirSync(AVATAR_DIR())) {
      if (AVATAR_RE.test(f)) unlinkSync(join(AVATAR_DIR(), f));
    }
  } catch {
    // 删除失败不阻断主流程
  }
}

/** 写入头像二进制（<dataDir>/user-profile/avatar.<ext>），替换旧文件并更新 profile，返回带 cache-bust 的 url */
export function setAvatarFromBuffer(buffer: Buffer, ext: string): string {
  const safeExt = ext.replace(/^\./, '').toLowerCase();
  deleteOldAvatar();
  ensureDir(AVATAR_DIR());
  writeFileSync(join(AVATAR_DIR(), `avatar.${safeExt}`), buffer);

  const url = `/api/account/avatar?v=${Date.now()}`;
  const profile = getProfile();
  profile.avatarUrl = url;
  writeJsonFile(PROFILE_FILE(), profile);
  return url;
}

export function removeAvatar(): void {
  deleteOldAvatar();
  const profile = getProfile();
  profile.avatarUrl = null;
  writeJsonFile(PROFILE_FILE(), profile);
}

/** 读取当前头像文件；无头像返回 null */
export function readAvatarFile(): { data: Buffer; contentType: string } | null {
  try {
    if (!existsSync(AVATAR_DIR())) return null;
    const fileName = readdirSync(AVATAR_DIR()).find(f => AVATAR_RE.test(f));
    if (!fileName) return null;
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream';
    return { data: readFileSync(join(AVATAR_DIR(), fileName)), contentType };
  } catch {
    return null;
  }
}
