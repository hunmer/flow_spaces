'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { LLMModel } from '@flow-spaces/shared';
import { ArrowLeftIcon, CheckCircle2Icon, Loader2Icon, PencilIcon, PlugIcon, PlusIcon, Trash2Icon, XCircleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchSelect } from '@/components/ui/search-select';
import type { SearchSelectOption } from '@/components/ui/search-select';
import { Tabs, TabList, Tab } from '@/components/base/tabs/tabs';
import { ProvidersDialog } from '@/components/sidebar/providers-dialog';
import { findCatalogProviderByApiBase } from '@/lib/model-catalog';
import { sdk } from '@/lib/sdk';
import { useLLMStore } from '@/stores/llm';

type ModelDraft = Pick<LLMModel, 'modelId' | 'name' | 'provider'> & { id?: string };

export function ModelSettingsPanel() {
  const t = useTranslations('settings');
  const tm = useTranslations('models');
  const tc = useTranslations('common');
  const tp = useTranslations('providers');
  const fieldId = useId();
  const { models, providers, ensure, addModel, updateModel, removeModel, catalog, loadCatalog } = useLLMStore();
  const [view, setView] = useState('providers');
  const [providerFilter, setProviderFilter] = useState('');
  const [draft, setDraft] = useState<ModelDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const testConnection = async () => {
    if (!draft?.provider || testing) return;
    const provider = providers.find(p => p.name === draft.provider);
    if (!provider?.apiBase || !draft.modelId.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      // 走 agent 预设的 test-connection：对具体 modelId 发一次轻量真实请求，验证模型能否回复
      const data = await sdk.agent.testConnection({
        apiBase: provider.apiBase,
        apiKey: provider.apiKey || '',
        modelId: draft.modelId.trim(),
        modelProvider: provider.modelProvider,
      }) as unknown as { success?: boolean; message?: string; error?: string };
      setTestResult({
        success: Boolean(data.success),
        message: data.message || data.error || tp('form.testFailed'),
      });
    } catch (e: any) {
      setTestResult({ success: false, message: e?.message || 'Request failed' });
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    let active = true;
    void ensure().then(() => {
      if (!active) return;
      setLoading(false);
      if (!useLLMStore.getState().loaded) setError(t('modelLoadFailed'));
    });
    return () => { active = false; };
  }, [ensure, t]);

  // 模型目录（供 modelId 下拉搜索；已在 store 缓存则不会重复拉取）
  useEffect(() => { void loadCatalog(); }, [loadCatalog]);

  // Include legacy models whose provider configuration has been removed.
  const providerNames = [...new Set([...providers.map(p => p.name), ...models.map(m => m.provider)])];
  const visibleModels = models.filter(model => !providerFilter || model.provider === providerFilter);
  const validDraft = Boolean(draft?.provider.trim() && draft.modelId.trim() && !draft.modelId.includes(','));

  // 按当前所选 provider 的 apiBase 匹配 catalog 供应商，得到可搜索的模型选项
  const modelIdOptions = useMemo<SearchSelectOption[]>(() => {
    const apiBase = providers.find(p => p.name === draft?.provider)?.apiBase;
    const catalogProvider = findCatalogProviderByApiBase(catalog, apiBase)?.provider;
    return Object.values(catalogProvider?.models ?? {}).map(m => ({
      value: m.id,
      label: m.name || m.id,
      description: m.id,
      keywords: typeof m.family === 'string' ? [m.family] : [],
    }));
  }, [catalog, providers, draft?.provider]);

  const openModels = (provider: string, add: boolean) => {
    setProviderFilter(provider);
    setDraft(add ? { provider, modelId: '', name: '' } : null);
    setError(null);
    setTestResult(null);
    setView('models');
  };

  const closeDraft = () => {
    setDraft(null);
    setError(null);
    setTestResult(null);
  };

  const saveModel = async () => {
    if (!draft || !validDraft || busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = {
        provider: draft.provider.trim(),
        modelId: draft.modelId.trim(),
        name: draft.name.trim() || draft.modelId.trim(),
      };
      if (draft.id) {
        updateModel(await sdk.llm.updateModel(draft.id, data));
      } else {
        addModel(await sdk.llm.createModel(data));
      }
      setProviderFilter(data.provider);
      closeDraft();
    } catch {
      setError(tm('error.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const deleteModel = async (model: LLMModel) => {
    if (busy || !window.confirm(`${tm('confirm.delete')}\n${model.name} (${model.modelId})`)) return;
    setBusy(true);
    setError(null);
    try {
      await sdk.llm.deleteModel(model.id);
      removeModel(model.id);
    } catch {
      setError(tm('error.deleteFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Tabs className="w-full" selectedKey={view} onSelectionChange={k => { if (k) { setView(String(k)); setError(null); } }}>
        <TabList aria-label={t('modelsTab')} className="w-full">
          <Tab id="providers">{t('modelProviders')}</Tab>
          <Tab id="models">{t('modelList')}</Tab>
        </TabList>
      </Tabs>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {loading && <p role="status" className="text-sm text-muted-foreground">{tm('dialog.loading')}</p>}
      <section hidden={view !== 'providers'} className="min-w-0">
        <p className="mb-3 text-xs text-muted-foreground">{t('modelProviderDeleteHint')}</p>
        <div className="overflow-hidden rounded-lg border">
          <ProvidersDialog
            standalone
            open={view === 'providers'}
            onOpenChange={() => {}}
            onAddModel={provider => openModels(provider, true)}
            onEditModels={provider => openModels(provider, false)}
          />
        </div>
      </section>
      <section hidden={view !== 'models'} className="min-w-0">
        {draft ? (
          <form onSubmit={event => { event.preventDefault(); void saveModel(); }}>
            <fieldset disabled={busy} className="flex min-w-0 flex-col gap-4">
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="icon" aria-label={tc('cancel')} onClick={closeDraft}>
                  <ArrowLeftIcon className="size-4" />
                </Button>
                <h3 className="text-sm font-medium">{tm(draft.id ? 'dialog.editTitle' : 'dialog.addTitle')}</h3>
              </div>
              <div className="flex flex-col gap-1.5 text-sm">
                {t('modelProviders')}
                <SearchSelect
                  value={draft.provider}
                  onChange={value => setDraft({ ...draft, provider: value })}
                  options={providerNames.map(name => ({ value: name, label: name }))}
                  placeholder={t('modelSelectProvider')}
                  searchPlaceholder={t('modelSelectProvider')}
                  allowCustom={false}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start h-7 text-xs"
                  disabled={testing || busy || !draft.modelId.trim() || !providers.some(p => p.name === draft.provider && p.apiBase)}
                  onClick={() => void testConnection()}
                >
                  {testing ? <Loader2Icon className="size-3.5 animate-spin" /> : <PlugIcon className="size-3.5" />}
                  {tp('form.testConnection')}
                </Button>
                {testResult && (
                  <div className={`flex items-center gap-1.5 text-xs ${testResult.success ? 'text-emerald-600' : 'text-destructive'}`}>
                    {testResult.success ? <CheckCircle2Icon className="size-3.5" /> : <XCircleIcon className="size-3.5" />}
                    <span className="truncate">{testResult.success ? tp('form.testSuccess') : `${tp('form.testFailed')}: ${testResult.message}`}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5 text-sm">
                {tm('form.modelId')}
                <SearchSelect
                  value={draft.modelId}
                  onChange={value => setDraft({ ...draft, modelId: value })}
                  options={modelIdOptions}
                  placeholder={tm('form.modelIdPlaceholder')}
                  searchPlaceholder={tm('form.modelIdSearch')}
                  allowCustom
                />
                {draft.modelId.includes(',') && <span className="text-xs text-destructive">{t('modelSingleId')}</span>}
              </div>
              <label className="flex flex-col gap-1.5 text-sm" htmlFor={`${fieldId}-name`}>
                {tm('form.displayName')}
                <Input id={`${fieldId}-name`} value={draft.name} placeholder={draft.modelId || tm('form.displayNamePlaceholder')} onChange={event => setDraft({ ...draft, name: event.target.value })} />
              </label>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeDraft}>{tc('cancel')}</Button>
                <Button type="submit" disabled={!validDraft || busy}>{tc(busy ? 'saving' : 'save')}</Button>
              </div>
            </fieldset>
          </form>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <SearchSelect
                value={providerFilter}
                onChange={setProviderFilter}
                options={[{ value: '', label: t('modelAllProviders') }, ...providerNames.map(name => ({ value: name, label: name }))]}
                placeholder={t('modelAllProviders')}
                searchPlaceholder={t('modelFilterProvider')}
                allowCustom={false}
              />
              <Button size="sm" disabled={loading || providers.length === 0 || busy} onClick={() => { setError(null); setDraft({ provider: providers.find(p => p.name === providerFilter)?.name || providers[0]?.name || '', modelId: '', name: '' }); }}>
                <PlusIcon className="size-4" />{tm('dialog.addTitle')}
              </Button>
            </div>
            {providers.length === 0 && <p className="mb-4 text-xs text-muted-foreground">{t('modelAddProviderFirst')}</p>}
            <div className="divide-y rounded-lg border">
              {visibleModels.map(model => (
                <div key={model.id} className="flex min-w-0 items-center gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{model.name}</p>
                    <p className="truncate text-xs text-muted-foreground" title={`${model.provider} · ${model.modelId}`}>{model.provider} · {model.modelId}</p>
                  </div>
                  <Button variant="ghost" size="icon" disabled={busy} aria-label={`${tm('dialog.editTitle')}: ${model.name}`} onClick={() => { setError(null); setTestResult(null); setDraft({ id: model.id, modelId: model.modelId, name: model.name, provider: model.provider }); }}>
                    <PencilIcon className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" disabled={busy} aria-label={`${tm('confirm.delete')} ${model.name}`} onClick={() => void deleteModel(model)}>
                    <Trash2Icon className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {!loading && visibleModels.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">{tm('list.empty')}</p>}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
