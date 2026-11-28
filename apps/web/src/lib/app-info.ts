import { fetchWithAuth } from './auth';

export interface AppInfo {
  name: string;
  version: string;
  platform: string;
  runtime: 'electron' | 'npm';
  packageName?: string;
  packaged?: boolean;
}
export interface AppUpdate extends AppInfo {
  latestVersion?: string;
  updateAvailable?: boolean;
  disabled?: boolean;
}
interface AppInfoApi {
  getInfo(): Promise<AppInfo>;
  checkUpdate(): Promise<AppUpdate>;
}

export function createAppInfoClient(
  desktop?: AppInfoApi,
  request: typeof fetchWithAuth = fetchWithAuth,
): AppInfoApi {
  async function load<T>(path: string, method = 'GET'): Promise<T> {
    const response = await request(`/api/app-info${path}`, { method });
    if (!response.ok) throw new Error('App information request failed');
    return response.json();
  }
  return desktop ?? {
    getInfo: () => load<AppInfo>(''),
    checkUpdate: () => load<AppUpdate>('/check-update', 'POST'),
  };
}

export function getAppInfoClient() {
  const api = (window as typeof window & { electronAPI?: { isElectron?: boolean; appInfo?: AppInfoApi } }).electronAPI;
  if (api?.isElectron && !api.appInfo) throw new Error('Electron updater bridge unavailable');
  return createAppInfoClient(api?.isElectron ? api.appInfo : undefined);
}
