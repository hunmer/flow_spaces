import type { MiniAppIndexItem } from '../components/mini-apps/mini-apps-store-card';

/** 独立维护在 mini-app 商店根目录的 external-apps.json。 */
export interface ExternalMiniApp {
  id: string;
  repository: string;
  branch?: string;
}

type LoadIndex = <T>(path: string, options?: { rememberSource?: boolean }) => Promise<T[]>;

export async function loadMiniAppStoreIndex(
  loadIndex: LoadIndex,
  githubBaseUrl: (owner: string, repo: string, branch?: string) => string,
  request = fetch,
): Promise<{ items: MiniAppIndexItem[]; failed: number }> {
  const [internal, external] = await Promise.allSettled([
    loadIndex<MiniAppIndexItem>('mini-app/index.json'),
    // 外部注册表可能来自另一个镜像，不能改变内部应用资源使用的源。
    loadIndex<ExternalMiniApp>('mini-app/external-apps.json', { rememberSource: false }),
  ]);
  let failed = [internal, external].filter(result => result.status === 'rejected' || !Array.isArray(result.value)).length;
  const internalItems = internal.status === 'fulfilled' && Array.isArray(internal.value) ? internal.value : [];
  const registrations = external.status === 'fulfilled' && Array.isArray(external.value) ? external.value : [];
  const remoteItems = await Promise.allSettled(registrations.map(async (entry): Promise<MiniAppIndexItem> => {
    const repository = new URL(entry.repository);
    const match = repository.pathname.replace(/\/+$/, '').match(/^\/([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (repository.protocol !== 'https:' || repository.hostname !== 'github.com' || !match || !entry.id) {
      throw new Error('Invalid external mini-app repository');
    }
    const baseUrl = githubBaseUrl(match[1], match[2], entry.branch ?? 'main');
    const storeUrl = `${baseUrl}/app.json`;
    const response = await request(storeUrl, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`fetch ${storeUrl} failed: ${response.status}`);
    const app = await response.json();
    if (!app || (app.id && app.id !== entry.id) || !app.name || !Array.isArray(app.files) || !app.files.length) {
      throw new Error(`Invalid external mini-app manifest: ${entry.id}`);
    }
    const paths = new Set(app.files.map((file: { path: string }) => file.path));
    const icon = [app.iconUrl, app.avatarUrl, app.icon, 'icon.png', 'avatar.png', 'icon.svg']
      .find(path => typeof path === 'string' && (/^https?:\/\//.test(path) || paths.has(path)));
    return {
      ...app,
      id: entry.id,
      baseUrl,
      storeUrl,
      iconUrl: icon ? (/^https?:\/\//.test(icon) ? icon : `${baseUrl}/${icon.replace(/^\/+/, '')}`) : undefined,
      hasIntro: paths.has('README.md'),
      introUrl: `${baseUrl}/README.md`,
    };
  }));
  const items = new Map(internalItems.map(item => [item.id, item]));
  // 同 ID 时显式维护的外部来源优先，避免重复卡片和错误安装来源。
  for (const result of remoteItems) {
    if (result.status === 'fulfilled') items.set(result.value.id, result.value);
    else failed++;
  }
  return { items: [...items.values()], failed };
}
