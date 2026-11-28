'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { MiniAppProject, MiniAppInstallProgress } from '@flow-spaces/sdk';
import { sdk } from '@/lib/sdk';
import { pluginApi } from '@/lib/workflow-plugin-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Button as UpdateButton } from '@/components/base/buttons/button';
import { RiFolderAddLine, RiRefreshLine } from '@remixicon/react';
import { checkMiniAppUpdates, loadMiniAppUpdate, type MiniAppUpdate } from '@/lib/mini-app-updates';
import { Plus, Upload, FileQuestion, Globe, CheckSquare, Search } from 'lucide-react';
import { MiniAppCard } from './mini-apps-card';
import { MiniAppCreateDialog } from './mini-apps-create-dialog';
import { MiniAppLocalImportDialog } from './mini-apps-local-import-dialog';
import { MiniAppGithubImportDialog } from './mini-apps-github-import-dialog';
import { MiniAppStoreDetailDialog } from './mini-apps-store-detail';
import { MiniAppStoreCard, type MiniAppIndexItem } from './mini-apps-store-card';
import { MiniAppListDialog } from './mini-apps-list-dialog';
import {
  MiniAppFilterToolbar,
  useMiniAppFilters,
} from './mini-apps-filters';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { fetchStoreIndex, resolveStoreUrl, githubRepoRawUrl } from '@/lib/agent-store';
import { loadMiniAppStoreIndex } from '@/lib/mini-app-store-index';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // strip data:...;base64, prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function MiniAppPage() {
  return <MiniAppListPage />;
}

function MiniAppListPage() {
  const t = useTranslations('mini-apps');
  const [projects, setProjects] = useState<MiniAppProject[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allPlugins, setAllPlugins] = useState<{ id: string; name: string; iconPath?: string }[]>([]);
  // 多选 Dialog 状态
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSelectedIds, setPickerSelectedIds] = useState<string[]>([]);

  // 商店模式：开启后复用列表卡片网格展示商店索引
  const [storeMode, setStoreMode] = useState(false);
  const [storeTemplates, setStoreTemplates] = useState<MiniAppIndexItem[]>([]);
  const [storeLoading, setStoreLoading] = useState(false);
  const [storeImportingId, setStoreImportingId] = useState<string | null>(null);
  const [storeInstallProgress, setStoreInstallProgress] = useState<MiniAppInstallProgress | null>(null);
  const [storeInstallingDevelopment, setStoreInstallingDevelopment] = useState(false);
  // 当前查看详情的商店条目；null = 关闭详情对话框
  const [selectedStoreItem, setSelectedStoreItem] = useState<MiniAppIndexItem | null>(null);
  // 从 GitHub 仓库地址安装独立 mini-app 仓库（header 导入下拉第二项弹出的对话框）
  const [githubDialogOpen, setGithubDialogOpen] = useState(false);
  const [localDialogOpen, setLocalDialogOpen] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [availableUpdates, setAvailableUpdates] = useState<MiniAppUpdate[]>([]);

  const filters = useMiniAppFilters({ projects, persistKey: 'miniapp-filter' });

  const loadProjects = useCallback(async () => {
    try {
      const list = await sdk.miniApp.list();
      setProjects(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // 商店模式开启时拉取索引（每次开启都刷新）
  useEffect(() => {
    if (!storeMode) return;
    let cancelled = false;
    setStoreLoading(true);
    loadMiniAppStoreIndex(fetchStoreIndex, githubRepoRawUrl)
      .then(({ items, failed }) => {
        if (cancelled) return;
        setStoreTemplates(items);
        if (failed) toast.error(t('store.loadPartialFailed', { count: failed }));
      })
      .catch(() => {
        /* ignore */
      })
      .finally(() => {
        if (!cancelled) setStoreLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeMode]);

  // 加载插件清单（供卡片展示已启用插件图标）—— 整页只请求一次
  useEffect(() => {
    pluginApi.list().then((list) => {
      setAllPlugins(list.map(p => ({ id: p.id, name: p.name, iconPath: p.iconPath })));
    }).catch(() => {});
  }, []);

  // 已安装项目按 id 索引，MD5 优先判断更新。
  const installedMap = useMemo(() => {
    const map: Record<string, MiniAppProject> = {};
    for (const p of projects) map[p.id] = p;
    return map;
  }, [projects]);

  // 三态：未安装 / 有更新 / 已导入；旧清单没有 MD5 时回退版本号。
  const getInstallStatus = useCallback(
    (item: MiniAppIndexItem) => {
      const installed = installedMap[item.id];
      if (!installed) return 'not-installed' as const;
      if (installed.localPath) return 'installed' as const;
      if (item.md5 && item.md5 !== installed.storeChecksum) return 'updatable' as const;
      if (!item.md5 && item.version && item.version !== installed.version) return 'updatable' as const;
      return 'installed' as const;
    },
    [installedMap],
  );

  const handleDelete = useCallback(async (id: string) => {
    await sdk.miniApp.delete_(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setAvailableUpdates((prev) => prev.filter((update) => update.id !== id));
  }, []);

  const handleUpdated = useCallback((updated: MiniAppProject) => {
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  const handleImport = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const zip = await fileToBase64(file);
        const name = file.name.replace(/\.zip$/i, '');
        await sdk.miniApp.importZip({ zip, name });
        loadProjects();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '导入失败');
      }
    };
    input.click();
  }, [loadProjects]);

  // 商店安装（增量）：server 按文件级 md5 清单对比本地，仅下载缺失/变化的文件。
  // 安装后刷新本地列表与三态按钮，保持商店模式便于连续安装。
  const handleInstallStoreItem = async (item: MiniAppIndexItem, installDevelopment?: boolean) => {
    setStoreImportingId(item.id);
    setStoreInstallProgress(null);
    setStoreInstallingDevelopment(installDevelopment === true);
    try {
      const baseUrl = item.baseUrl ?? resolveStoreUrl(`mini-app/${item.id}`);
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
          mainFile: item.mainFile,
          enabledPlugins: item.enabledPlugins,
          enabledWorkflows: item.enabledWorkflows,
        },
        files: item.files ?? [],
        development: item.development,
        installDevelopment,
        storeUrl: item.storeUrl ?? baseUrl,
        storeChecksum: item.md5,
      }, setStoreInstallProgress);
      await loadProjects();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('store.githubFailed'));
    } finally {
      setStoreImportingId(null);
      setStoreInstallProgress(null);
    }
  };

  const handleCheckUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const result = await checkMiniAppUpdates(projects, resolveStoreUrl('mini-app/'));
      setAvailableUpdates(result.updates);
      if (result.updates.length) toast.success(t('updates.found', { count: result.updates.length }));
      else if (result.checked && !result.failed) toast.success(t('updates.latest'));
      else if (!result.failed) toast.info(t('updates.noSources'));
      if (result.failed) toast.error(t('updates.failed', { count: result.failed }));
    } finally {
      setCheckingUpdates(false);
    }
  };

  const handleUpdateMiniApp = async (update: MiniAppUpdate) => {
    setStoreImportingId(update.id);
    setStoreInstallProgress(null);
    setStoreInstallingDevelopment(false);
    try {
      const app = await loadMiniAppUpdate(update);
      await sdk.miniApp.installFromStore({
        id: update.id,
        baseUrl: update.baseUrl,
        manifest: app,
        files: app.files,
        development: app.development,
        installDevelopment: installedMap[update.id]?.storeDevelopment,
        storeUrl: update.storeUrl,
        storeChecksum: app.md5,
      }, setStoreInstallProgress);
      await loadProjects();
      setAvailableUpdates((prev) => prev.filter((item) => item.id !== update.id));
      toast.success(t('updates.updated', { name: update.name }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('store.githubFailed'));
    } finally {
      setStoreImportingId(null);
      setStoreInstallProgress(null);
    }
  };

  const toggleStoreMode = (checked: boolean) => {
    setStoreMode(checked);
    if (!checked) setSelectedStoreItem(null);
  };

  // 多选 Dialog 确认回调：返回选中的完整项目数据
  const handlePickerConfirm = useCallback((selected: MiniAppProject[]) => {
    setPickerOpen(false);
    setPickerSelectedIds([]);
    toast.success(t('listDialog.selected', { count: selected.length }));
    // TODO: 在此消费 selected —— 例如绑定到工作流、批量导出等
    // eslint-disable-next-line no-console
    console.log('[mini-apps picker] selected:', selected);
  }, [t]);

  const openPicker = useCallback(() => {
    setPickerSelectedIds([]);
    setPickerOpen(true);
  }, []);

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header — sticky：吸附在 shell topbar 下缘，内容从其下方滚过（.main 拥有滚动） */}
      <div className="hidden md:flex items-center justify-between mb-6 sticky top-[var(--rail-topbar-h)] z-10 bg-background -mt-6 pt-6">
        <div>
          {/* 本地 / 商店 链接式切换代替 h2 标题 */}
          <h2 className="text-lg font-semibold flex items-baseline gap-2">
            <button
              type="button"
              onClick={() => toggleStoreMode(false)}
              className={`cursor-pointer underline-offset-4 ${storeMode ? 'text-muted-foreground font-normal hover:text-foreground' : 'text-foreground underline'}`}
            >
              {t('page.title')}
            </button>
            <span className="text-muted-foreground/60 font-normal">/</span>
            <button
              type="button"
              onClick={() => toggleStoreMode(true)}
              className={`cursor-pointer underline-offset-4 ${storeMode ? 'text-foreground underline' : 'text-muted-foreground font-normal hover:text-foreground'}`}
            >
              {t('page.storeTab')}
            </button>
          </h2>
          <p className="text-sm text-muted-foreground">
            {storeMode ? t('store.description') : t('page.subtitle')}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={(
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  {t('page.import')}
                </Button>
              )}
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleImport}>
                <Upload className="h-3.5 w-3.5 mr-2" />
                {t('page.importZip')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocalDialogOpen(true)}>
                <RiFolderAddLine className="size-3.5 me-2" />
                {t('page.addLocal')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGithubDialogOpen(true)}>
                <Globe className="h-3.5 w-3.5 mr-2" />
                {t('page.importGithub')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('page.create')}
          </Button>
        </div>
      </div>

      {/* Mobile header — 同样 sticky 吸附在 topbar 下缘 */}
      <div className="md:hidden mb-4 sticky top-[var(--rail-topbar-h)] z-10 bg-background -mt-6 pt-6">
        {/* 本地 / 商店 链接式切换代替 h2 标题 */}
        <h2 className="text-lg font-semibold flex items-baseline gap-2">
          <button
            type="button"
            onClick={() => toggleStoreMode(false)}
            className={`cursor-pointer underline-offset-4 ${storeMode ? 'text-muted-foreground font-normal hover:text-foreground' : 'text-foreground underline'}`}
          >
            {t('page.title')}
          </button>
          <span className="text-muted-foreground/60 font-normal">/</span>
          <button
            type="button"
            onClick={() => toggleStoreMode(true)}
            className={`cursor-pointer underline-offset-4 ${storeMode ? 'text-foreground underline' : 'text-muted-foreground font-normal hover:text-foreground'}`}
          >
            {t('page.storeTab')}
          </button>
        </h2>
        <p className="text-sm text-muted-foreground mb-3">
          {storeMode ? t('store.description') : t('page.subtitle')}
        </p>
        <div className="flex gap-2 flex-wrap items-center">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={(
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  {t('page.import')}
                </Button>
              )}
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleImport}>
                <Upload className="h-3.5 w-3.5 mr-2" />
                {t('page.importZip')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocalDialogOpen(true)}>
                <RiFolderAddLine className="size-3.5 me-2" />
                {t('page.addLocal')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGithubDialogOpen(true)}>
                <Globe className="h-3.5 w-3.5 mr-2" />
                {t('page.importGithub')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('page.create')}
          </Button>
        </div>
      </div>

      {/* Filters toolbar (search / type / sort / tags) — 商店模式下隐藏（GitHub 安装入口在 header 导入下拉） */}
      {!storeMode && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <MiniAppFilterToolbar state={filters} showSearch={false} />
          <Button variant="outline" size="sm" className="shrink-0" onClick={openPicker}>
            <CheckSquare className="h-4 w-4 mr-2" />
            {t('page.select')}
          </Button>
          <UpdateButton
            variant="secondary"
            size="small"
            leadingIcon={RiRefreshLine}
            disabled={loading || checkingUpdates || storeImportingId !== null || !projects.length}
            onClick={handleCheckUpdates}
          >
            {t(checkingUpdates ? 'updates.checking' : 'updates.check')}
          </UpdateButton>
          {/* 搜索栏固定在最右侧 */}
          <div className="relative ml-auto min-w-[140px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={t('page.searchPlaceholder')}
              value={filters.search}
              onChange={(e) => filters.setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
      )}

      {!storeMode && availableUpdates.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {availableUpdates.map((update) => (
            <div key={update.id} className="flex items-center justify-between gap-3 rounded-xl border border-border-button-default bg-background-secondary-default p-3">
              <span className="min-w-0 truncate text-body-regular text-text-primary">{update.name}</span>
              <UpdateButton
                variant="secondary"
                size="small"
                leadingIcon={RiRefreshLine}
                disabled={checkingUpdates || storeImportingId !== null}
                onClick={() => handleUpdateMiniApp(update)}
              >
                {storeImportingId === update.id && storeInstallProgress
                  ? t('store.installProgress', {
                    percent: Math.floor(storeInstallProgress.completed / storeInstallProgress.total * 100),
                    completed: storeInstallProgress.completed,
                    total: storeInstallProgress.total,
                  })
                  : t(storeImportingId === update.id ? 'updates.updating' : 'store.update')}
              </UpdateButton>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {storeMode ? (
        storeLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            {t('store.loading')}
          </div>
        ) : storeTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground">
            <FileQuestion className="h-10 w-10 mb-3" />
            <p className="text-sm">{t('store.empty')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 flex-1 content-start">
            {storeTemplates.map((item) => (
              <MiniAppStoreCard
                key={item.id}
                item={item}
                status={getInstallStatus(item)}
                onOpenDetail={(it) => setSelectedStoreItem(it)}
              />
            ))}
          </div>
        )
      ) : loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          {t('page.loading')}
        </div>
      ) : filters.filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground">
          <FileQuestion className="h-10 w-10 mb-3" />
          {projects.length === 0 ? (
            <>
              <p className="text-sm mb-3">{t('page.empty')}</p>
              <Button variant="outline" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t('page.createFirst')}
              </Button>
            </>
          ) : (
            <p className="text-sm">{t('page.noMatch')}</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 flex-1 content-start">
          {filters.filtered.map((project) => (
            <MiniAppCard
              key={project.id}
              project={project}
              onDelete={handleDelete}
              onUpdated={handleUpdated}
              allPlugins={allPlugins}
            />
          ))}
        </div>
      )}

      <MiniAppStoreDetailDialog
        item={selectedStoreItem}
        status={selectedStoreItem ? getInstallStatus(selectedStoreItem) : 'not-installed'}
        importing={!!selectedStoreItem && storeImportingId === selectedStoreItem.id}
        progress={storeInstallProgress ?? undefined}
        installingDevelopment={storeInstallingDevelopment}
        disabled={storeImportingId !== null || !!(selectedStoreItem && installedMap[selectedStoreItem.id]?.localPath)}
        onInstall={handleInstallStoreItem}
        onClose={() => setSelectedStoreItem(null)}
      />
      <MiniAppCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      <MiniAppLocalImportDialog open={localDialogOpen} onOpenChange={setLocalDialogOpen} onImported={loadProjects} />
      <MiniAppGithubImportDialog
        open={githubDialogOpen}
        onOpenChange={setGithubDialogOpen}
        onImported={loadProjects}
      />
      <MiniAppListDialog
        open={pickerOpen}
        projects={projects}
        selectable
        selectedIds={pickerSelectedIds}
        onSelectedIdsChange={setPickerSelectedIds}
        onConfirm={handlePickerConfirm}
        onClose={() => setPickerOpen(false)}
        confirmLabelKey="filters.confirm"
      />
    </div>
  );
}
