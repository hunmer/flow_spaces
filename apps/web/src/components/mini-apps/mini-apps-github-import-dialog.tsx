'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { sdk } from '@/lib/sdk';
import { loadMiniAppFiles } from '@/lib/mini-app-updates';
import { parseGithubRepoUrl, githubRepoRawUrl, githubAppManifestUrl } from '@/lib/agent-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Globe, Download, Loader2 } from 'lucide-react';

interface MiniAppGithubImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 安装成功后回调（刷新本地列表）。 */
  onImported: () => void | Promise<void>;
}

/**
 * 从 GitHub 仓库地址安装独立 mini-app：
 * 拉取仓库根 app.json 元数据与 files.json 文件级 md5 清单，交给 server 增量安装。
 * 入口在页面 header 的「导入」下拉菜单第二项。
 */
export function MiniAppGithubImportDialog({ open, onOpenChange, onImported }: MiniAppGithubImportDialogProps) {
  const t = useTranslations('mini-apps');
  const [url, setUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  // 每次打开清掉上次的错误提示，保留已输入地址便于修改后重试
  useEffect(() => {
    if (open) setError('');
  }, [open]);

  const handleInstall = async () => {
    const trimmed = url.trim();
    if (!trimmed || importing) return;
    const repoInfo = parseGithubRepoUrl(trimmed);
    if (!repoInfo) {
      setError(t('store.githubInvalid'));
      return;
    }
    setImporting(true);
    setError('');
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
        development?: Array<{ path: string; md5: string }>;
      };
      const fileManifest = await loadMiniAppFiles(githubRepoRawUrl(repoInfo.owner, repoInfo.repo), app.md5);

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
        files: fileManifest.files,
        development: fileManifest.development,
        storeUrl: manifestUrl,
        storeChecksum: fileManifest.md5,
      });

      setUrl('');
      await onImported();
      onOpenChange(false);
    } catch {
      setError(t('store.githubFailed'));
    } finally {
      setImporting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInstall();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('page.importGithub')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">{t('store.githubDialogDesc')}</p>
          <div className="space-y-2">
            <Label>{t('store.githubLabel')}</Label>
            <div className="flex items-center gap-2">
              <Globe className="size-4 shrink-0 text-muted-foreground" />
              <Input
                placeholder={t('store.githubPlaceholder')}
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setError('');
                }}
                onKeyDown={handleKeyDown}
                disabled={importing}
                autoFocus
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            {t('store.githubCancel')}
          </Button>
          <Button onClick={handleInstall} disabled={importing || !url.trim()}>
            {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            {t('store.githubInstall')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
