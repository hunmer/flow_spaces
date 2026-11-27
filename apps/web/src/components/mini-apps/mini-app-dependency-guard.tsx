'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2, PackageOpen, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/base/badges/chip';
import type { MiniAppProject } from '@flow-spaces/sdk';
import { sdk } from '@/lib/sdk';
import { fetchStoreIndex, resolveStoreUrl } from '@/lib/agent-store';
import { pluginApi, type StoreWorkflowPlugin } from '@/lib/workflow-plugin-api';
import { installWorkflowTemplateFromStore } from '@/lib/workflow-template-install';
import { useLocale } from '@/components/layout/locale-provider';
import type { WorkflowIndexItem } from '@/components/workflows/workflow-template-card';

/** 内置插件随宿主分发，永不缺失（与 MiniAppPreview 的工具栏警示逻辑口径一致） */
const BUILTIN_PLUGIN_ID = '@flow-spaces/builtin';

/**
 * 工作流依赖匹配键归一：商店模板 id 用连字符（text-to-image）而安装后的
 * workflow.name 用下划线（text_to_image，= 模板 data.name），统一按 `_` 比较，
 * 使 enabledWorkflows 写模板 id 或 data.name 均可命中。
 */
function normalizeWorkflowKey(key: string): string {
  return key.trim().toLowerCase().replace(/-/g, '_');
}

type GuardPhase = 'checking' | 'missing' | 'installing';

/**
 * mini-app 预览页依赖守卫：核查 project.enabledPlugins / enabledWorkflows 是否已安装，
 * 缺失时渲染 empty 态（列缺失项 + 一键安装 + 仍要预览），不阻塞用户。
 * - 插件：与本地 pluginApi.list() 对比，缺失项从插件商店（plugins/index.json）安装；
 * - 工作流：声明值可与本地 workflow 的 id 或 name 匹配，缺失项从工作流商店
 *   （workflows/index.json，按模板 id/name 匹配）拉模板落库；
 * - 插件列表/工作流列表拉取失败或为空时不判定缺失（避免误报阻塞预览）；
 * - 依赖齐全时立即回调 onPass 放行渲染真正的 MiniAppPreview。
 */
export function MiniAppDependencyGuard({ project, onPass }: {
  project: MiniAppProject;
  /** 依赖齐全或用户选择「仍要预览」时回调，父级放行渲染 MiniAppPreview */
  onPass: () => void;
}) {
  const t = useTranslations('mini-apps.dependency');
  const { locale } = useLocale();
  const [phase, setPhase] = useState<GuardPhase>('checking');
  const [missingPlugins, setMissingPlugins] = useState<string[]>([]);
  const [missingWorkflows, setMissingWorkflows] = useState<string[]>([]);
  const [installProgress, setInstallProgress] = useState({ done: 0, total: 0 });
  const [checkVersion, setCheckVersion] = useState(0);

  const checkDependencies = useCallback(async () => {
    setPhase('checking');
    try {
      const [plugins, workflows] = await Promise.all([
        pluginApi.list(),
        sdk.workflow.list(),
      ]);
      // 列表为空视为接口不可用，不判定缺失（与 MiniAppPreview 工具栏警示的防御一致）
      const installedPluginIds = plugins.length ? new Set(plugins.map((p) => p.id)) : null;
      const installedWorkflowKeys = workflows.length
        ? new Set<string>(workflows.flatMap((wf) => [wf.id, normalizeWorkflowKey(wf.name)]))
        : null;

      const nextMissingPlugins = (project.enabledPlugins || [])
        .filter((id) => id !== BUILTIN_PLUGIN_ID && !installedPluginIds?.has(id));
      const nextMissingWorkflows = (project.enabledWorkflows || [])
        .filter((dep) => !installedWorkflowKeys?.has(dep) && !installedWorkflowKeys?.has(normalizeWorkflowKey(dep)));

      if (!nextMissingPlugins.length && !nextMissingWorkflows.length) {
        onPass();
        return;
      }
      setMissingPlugins(nextMissingPlugins);
      setMissingWorkflows(nextMissingWorkflows);
      setPhase('missing');
    } catch {
      // 核查失败不阻塞预览
      onPass();
    }
  }, [project.enabledPlugins, project.enabledWorkflows, onPass]);

  useEffect(() => { void checkDependencies(); }, [checkDependencies, checkVersion]);

  async function handleInstallAll() {
    setPhase('installing');
    const total = missingPlugins.length + missingWorkflows.length;
    setInstallProgress({ done: 0, total });
    const failures: string[] = [];
    let done = 0;
    const bump = () => { done += 1; setInstallProgress({ done, total }); };

    try {
      // 拉商店索引（插件优先本地化索引，与 WorkflowPluginsDialog 口径一致）
      let storePlugins: StoreWorkflowPlugin[] = [];
      try {
        storePlugins = await fetchStoreIndex<StoreWorkflowPlugin>(`plugins/index_${locale}.json`);
      } catch {
        storePlugins = await fetchStoreIndex<StoreWorkflowPlugin>('plugins/index.json');
      }
      const storeWorkflows = await fetchStoreIndex<WorkflowIndexItem>('workflows/index.json');
      const pluginById = new Map(storePlugins.map((p) => [p.id, p]));
      const workflowByKey = new Map<string, WorkflowIndexItem>();
      for (const item of storeWorkflows) {
        workflowByKey.set(item.id, item);
        workflowByKey.set(item.name, item);
      }

      // 插件逐个安装（串行，避免并发写冲突；依赖数量通常个位数）
      for (const pluginId of missingPlugins) {
        const sp = pluginById.get(pluginId);
        if (!sp) {
          failures.push(pluginId);
          bump();
          continue;
        }
        try {
          await pluginApi.installFromStore(sp.id, resolveStoreUrl(`plugins/${sp.path}`), sp.md5, sp.type, sp.files);
        } catch {
          failures.push(pluginId);
        }
        bump();
      }

      // 工作流逐个安装（agents 去重 + agentConfigId 重映射见 lib/workflow-template-install）。
      // 探测本地同名工作流（安装后 workflow.name = 模板 data.name）：命中则走更新分支，避免重复创建
      const localWorkflows = await sdk.workflow.list();
      for (const dep of missingWorkflows) {
        const item = workflowByKey.get(dep);
        if (!item) {
          failures.push(dep);
          bump();
          continue;
        }
        try {
          const installed = localWorkflows
            .filter((wf) => normalizeWorkflowKey(wf.name) === normalizeWorkflowKey(item.name))
            .sort((a, b) => b.updatedAt - a.updatedAt)[0];
          await installWorkflowTemplateFromStore(item, installed?.id);
        } catch {
          failures.push(dep);
        }
        bump();
      }

      if (failures.length) {
        toast.warning(t('installPartialFailed', { count: failures.length, failed: failures.join(', ') }));
        setCheckVersion((v) => v + 1); // 重新核查剔除已装项
      } else {
        toast.success(t('installed'));
        setCheckVersion((v) => v + 1);
      }
    } catch {
      toast.error(t('storeUnavailable'));
      setPhase('missing');
    }
  }

  if (phase === 'checking') {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalMissing = missingPlugins.length + missingWorkflows.length;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="rounded-full bg-muted p-4">
        <PackageOpen className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h1 className="text-lg font-semibold">{t('title')}</h1>
        <p className="max-w-md text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <div className="w-full max-w-md space-y-3 text-left">
        {missingPlugins.length > 0 && (
          <section className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">
              {t('pluginsLabel', { count: missingPlugins.length })}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {missingPlugins.map((id) => <Chip key={id} variant="caption" color="orange">{id}</Chip>)}
            </div>
          </section>
        )}
        {missingWorkflows.length > 0 && (
          <section className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">
              {t('workflowsLabel', { count: missingWorkflows.length })}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {missingWorkflows.map((dep) => <Chip key={dep} variant="caption" color="orange">{dep}</Chip>)}
            </div>
          </section>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={() => void handleInstallAll()} disabled={phase === 'installing'}>
          {phase === 'installing'
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Download className="h-4 w-4" />}
          {phase === 'installing'
            ? t('installing', { done: installProgress.done, total: installProgress.total })
            : t('installAll', { count: totalMissing })}
        </Button>
        <Button variant="ghost" onClick={onPass} disabled={phase === 'installing'}>
          {t('skip')}
        </Button>
      </div>
    </div>
  );
}
