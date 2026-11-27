import type { MiniAppProject } from '@flow-spaces/sdk';

export interface MiniAppUpdate {
  id: string;
  name: string;
  md5: string;
  baseUrl: string;
  manifestUrl: string;
  storeUrl: string;
}

export interface MiniAppRemoteManifest {
  id?: string;
  name: string;
  type?: 'react' | 'html';
  description?: string;
  version?: string;
  tags?: string[];
  icon?: string;
  mainFile?: string;
  enabledPlugins?: string[];
  enabledWorkflows?: string[];
  md5: string;
  files: Array<{ path: string; md5: string }>;
  development?: Array<{ path: string; md5: string }>;
}

async function fetchJson(url: string, request: typeof fetch): Promise<unknown> {
  const response = await request(url, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`fetch ${url} failed: ${response.status}`);
  return response.json();
}

/** 每个来源只下载一次轻量 checksums.json；本地创建且不在商店的项目跳过。 */
export async function checkMiniAppUpdates(projects: MiniAppProject[], storeBase: string, request = fetch) {
  const requests = new Map<string, Promise<Record<string, string>>>();
  const updates: MiniAppUpdate[] = [];
  let checked = 0;
  let failed = 0;
  let skipped = 0;
  await Promise.all(projects.map(async (project) => {
    if (project.localPath) { skipped++; return; }
    // 旧 ZIP 商店地址已退役，改从当前商店来源检查。
    const savedUrl = project.storeUrl?.endsWith('.zip') ? undefined : project.storeUrl?.replace(/\/+$/, '');
    const standalone = savedUrl?.endsWith('/app.json') || /\/raw\/refs\/heads\/[^/]+$/.test(savedUrl ?? '');
    const baseUrl = standalone
      ? savedUrl!.replace(/\/app\.json$/, '')
      : savedUrl ?? `${storeBase.replace(/\/+$/, '')}/${project.id}`;
    const rootUrl = standalone ? baseUrl : baseUrl.slice(0, baseUrl.lastIndexOf('/'));
    const checksumUrl = `${rootUrl}/checksums.json`;
    try {
      let pending = requests.get(checksumUrl);
      if (!pending) {
        pending = fetchJson(checksumUrl, request).then((data) => {
          if (!data || typeof data !== 'object' || Array.isArray(data)
            || Object.values(data).some(value => typeof value !== 'string' || !/^[a-f0-9]{32}$/i.test(value))) {
            throw new Error(`Invalid checksum list: ${checksumUrl}`);
          }
          return data as Record<string, string>;
        });
        requests.set(checksumUrl, pending);
      }
      const checksums = await pending;
      const md5 = Object.hasOwn(checksums, project.id) ? checksums[project.id] : undefined;
      if (!md5) {
        if (savedUrl) failed++;
        else skipped++;
        return;
      }
      checked++;
      if (md5.toLowerCase() !== project.storeChecksum?.toLowerCase()) {
        updates.push({
          id: project.id, name: project.name, md5, baseUrl,
          manifestUrl: `${rootUrl}/${standalone ? 'app.json' : 'index.json'}`,
          storeUrl: standalone ? `${baseUrl}/app.json` : baseUrl,
        });
      }
    } catch {
      failed++;
    }
  }));
  return { updates, checked, failed, skipped };
}

/** 点更新才加载完整文件清单，确认它与刚检查的 MD5 一致。 */
export async function loadMiniAppUpdate(update: MiniAppUpdate, request = fetch): Promise<MiniAppRemoteManifest> {
  const data = await fetchJson(update.manifestUrl, request);
  const manifest = (Array.isArray(data) ? data.find(item => item?.id === update.id) : data) as MiniAppRemoteManifest | undefined;
  if (!manifest || manifest.md5?.toLowerCase() !== update.md5.toLowerCase() || !Array.isArray(manifest.files) || !manifest.files.length) {
    throw new Error(`Invalid or changed update manifest: ${update.id}`);
  }
  return manifest;
}
