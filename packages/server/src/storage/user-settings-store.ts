import { join } from 'node:path';
import { readJsonFile, writeJsonFile, getDataDir } from './json-store.js';

/** 商店源：三类商店（plugins / workflows / mini-app）的可配置源地址。 */
export interface StoreSourceEntry {
  id: string;
  name: string;
  url: string;
  /** 该类别默认源（拉取时优先尝试）；归一后每类非空列表恰有一个默认。 */
  default?: boolean;
}

export type StoreSourcesConfig = Record<'plugins' | 'workflows' | 'mini-app', StoreSourceEntry[]>;

interface UserSettings {
  avatarUrl?: string;
  /** 用户自定义商店源；null/缺省 = 使用前端内置默认源（GitHub + 本地端口）。 */
  storeSources?: StoreSourcesConfig;
}

const FILE = () => join(getDataDir(), 'user-settings.json');

export function getUserSettings(): UserSettings {
  return readJsonFile<UserSettings>(FILE()) ?? {};
}

export function setUserAvatarUrl(url: string): void {
  const settings = getUserSettings();
  settings.avatarUrl = url;
  writeJsonFile(FILE(), settings);
}

export function removeUserAvatarUrl(): void {
  const settings = getUserSettings();
  delete settings.avatarUrl;
  writeJsonFile(FILE(), settings);
}

export function getStoreSources(): StoreSourcesConfig | null {
  return getUserSettings().storeSources ?? null;
}

export function setStoreSources(value: StoreSourcesConfig | null): void {
  const settings = getUserSettings();
  if (value === null) delete settings.storeSources;
  else settings.storeSources = value;
  writeJsonFile(FILE(), settings);
}
