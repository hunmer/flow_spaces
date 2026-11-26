'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Download, Store, Check, RefreshCw, Globe } from 'lucide-react';
import { fetchStoreIndex, resolveStoreUrl, parseGithubRepoUrl, githubRepoRawUrl, githubAppManifestUrl } from '@/lib/agent-store';
import { AgentIcon } from '@/components/common/agent-icon';
import { sdk } from '@/lib/sdk';
import { MiniAppDetail } from './mini-apps-store-detail';

interface MiniAppStoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export interface MiniAppIndexItem {
  id: string;
  name: string;
  type?: 'react' | 'html';
  icon?: string;
  iconUrl?: string;
  description?: string;
  md5?: string;
  updatedAt?: string;
  hasIntro?: boolean;
  version?: string;
  tags?: string[];
  /** 文件级 md5 清单：server 对比本地按需下载（增量安装） */
  files?: Array<{ path: string; md5: string }>;
}

type InstallStatus = 'not-installed' | 'updatable' | 'installed';

export function MiniAppStoreDialog({ open, onOpenChange, onImported }: MiniAppStoreDialogProps) {
  const t = useTranslations('mini-apps');
  const [templates, setTemplates] = useState<MiniAppIndexItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  // 已安装项目：id -> version（版本号字符串）。用于判断「已导入 / 有更新」
  const [installedMap, setInstalledMap] = useState<Record<string, string>>({});
  // 当前查看详情的插件；null = 列表视图，非 null = 详情视图
  const [selected, setSelected] = useState<MiniAppIndexItem | null>(null);
  // 从 GitHub 地址安装独立 mini-app 仓库
  const [githubUrl, setGithubUrl] = useState('');
  const [githubImporting, setGithubImporting] = useState(false);
  const [githubError, setGithubError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const index = await fetchStoreIndex<MiniAppIndexItem>('mini-app/index.json');
      setTemplates(index);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  // 拉取本地已安装清单，建立 id -> version 映射
  const refreshInstalled = useCallback(async () => {
    try {
      const list = await sdk.miniApp.list();
      const map: Record<string, string> = {};
      for (const p of list) map[p.id] = p.version;
      setInstalledMap(map);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchTemplates();
      refreshInstalled();
    }
  }, [open, fetchTemplates, refreshInstalled]);

  // 三态：未安装 / 有更新（商店 version ≠ 已安装 version）/ 已导入（已安装且版本一致）
  const getStatus = useCallback(
    (item: MiniAppIndexItem): InstallStatus => {
      const installedVersion = installedMap[item.id];
      if (!installedVersion) return 'not-installed';
      if (item.version && item.version !== installedVersion) return 'updatable';
      return 'installed';
    },
    [installedMap],
  );

  const handleImport = async (item: MiniAppIndexItem) => {
    setImporting(item.id);
    try {
      // 增量安装：server 按文件级 md5 清单对比本地，仅下载缺失/变化的文件
      const baseUrl = resolveStoreUrl(`mini-app/${item.id}`);
      await sdk.miniApp.installFromStore({
        id: item.id,
        baseUrl,
        manifest: {
          name: item.name,
          type: item.type === 'html' ? 'html' : 'react',
          description: item.description,
          version: item.version,
          tags: item.tags,
          icon: item.icon,
        },
        files: item.files ?? [],
        storeUrl: baseUrl,
        storeChecksum: item.md5,
      });

      // 刷新「已安装」状态与外层列表；不关闭对话框，便于连续导入 / 查看状态
      await refreshInstalled();
      onImported();
    } finally {
      setImporting(null);
    }
  };

  // 从 GitHub 仓库地址安装：拉取仓库根 app.json（元数据 + 文件级 md5 清单），server 增量安装
  const handleImportGithub = async () => {
    const repoInfo = parseGithubRepoUrl(githubUrl);
    if (!repoInfo) {
      setGithubError(t('store.githubInvalid'));
      return;
    }
    setGithubImporting(true);
    setGithubError(null);
    try {
      const manifestUrl = githubAppManifestUrl(repoInfo.owner, repoInfo.repo);
      const res = await fetch(manifestUrl);
      if (!res.ok) throw new Error(`fetch app.json failed: ${res.status}`);
      const app = (await res.json()) as {
        id?: string;
        name?: string;
        type?: 'react' | 'html';
        description?: string;
        version?: string;
        tags?: string[];
        icon?: string;
        enabledPlugins?: string[];
        mainFile?: string;
        md5?: string;
        files?: Array<{ path: string; md5: string }>;
      };
      if (!Array.isArray(app.files) || !app.files.length) {
        throw new Error('app.json has no file list');
      }

      // id 用仓库名；清单 path 相对仓库根 raw 地址
      await sdk.miniApp.installFromStore({
        id: repoInfo.repo,
        baseUrl: githubRepoRawUrl(repoInfo.owner, repoInfo.repo),
        manifest: {
          name: app.name,
          type: app.type,
          description: app.description,
          version: app.version,
          tags: app.tags,
          icon: app.icon,
          enabledPlugins: app.enabledPlugins,
          mainFile: app.mainFile,
        },
        files: app.files,
        storeUrl: manifestUrl,
        storeChecksum: app.md5,
      });

      setGithubUrl('');
      await refreshInstalled();
      onImported();
    } catch {
      setGithubError(t('store.githubFailed'));
    } finally {
      setGithubImporting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) setSelected(null);
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="!w-[80vw] !max-w-none !h-[80vh] !max-h-none flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            {t('store.title')}
          </DialogTitle>
          <DialogDescription>{t('store.description')}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 pb-1">
          <Globe className="size-4 shrink-0 text-muted-foreground" />
          <Input
            value={githubUrl}
            onChange={(e) => {
              setGithubUrl(e.target.value);
              setGithubError(null);
            }}
            placeholder={t('store.githubPlaceholder')}
            className="h-8 flex-1 text-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !githubImporting && githubUrl.trim()) {
                e.preventDefault();
                handleImportGithub();
              }
            }}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8 shrink-0"
            disabled={githubImporting || !githubUrl.trim()}
            onClick={handleImportGithub}
          >
            {githubImporting ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <>
                <Download className="size-3.5 mr-1" />
                {t('store.githubInstall')}
              </>
            )}
          </Button>
        </div>
        {githubError && <p className="text-xs text-destructive pb-1">{githubError}</p>}
        <ScrollArea className="flex-1 -mx-6 px-6">
          {selected ? (
            <MiniAppDetail item={selected} onBack={() => setSelected(null)} />
          ) : loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">{t('store.loading')}</div>
          ) : templates.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">{t('store.empty')}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-2">
              {templates.map((item) => {
                const status = getStatus(item);
                const isImporting = importing === item.id;
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelected(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelected(item);
                      }
                    }}
                    className="rounded-xl border border-border bg-background p-4 hover:bg-accent/30 transition-colors flex flex-col gap-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <AgentIcon
                        name={item.name}
                        avatarUrl={item.iconUrl ? resolveStoreUrl(item.iconUrl) : undefined}
                        icon={item.icon}
                        className="size-6 rounded shrink-0"
                      />
                      <span className="font-medium text-sm truncate">{item.name}</span>
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                    )}
                    <Button
                      variant={status === 'installed' ? 'secondary' : status === 'updatable' ? 'default' : 'outline'}
                      size="sm"
                      className="shrink-0 mt-auto w-full"
                      disabled={importing !== null || status === 'installed'}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleImport(item);
                      }}
                    >
                      {isImporting ? (
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : status === 'installed' ? (
                        <>
                          <Check className="size-3.5 mr-1" />
                          {t('store.installed')}
                        </>
                      ) : status === 'updatable' ? (
                        <>
                          <RefreshCw className="size-3.5 mr-1" />
                          {t('store.update')}
                        </>
                      ) : (
                        <>
                          <Download className="size-3.5 mr-1" />
                          {t('store.import')}
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
