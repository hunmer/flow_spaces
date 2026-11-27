'use client';

/**
 * 【商店源】Tab：plugins / workflows / mini-app 三类商店的源地址管理。
 * 默认每类两个源（GitHub + 本地服务端口），可添加 / 修改 / 删除，
 * 保存到后端（PUT /api/user/store-sources，存 user-settings.json）。
 * 商店索引拉取按列表顺序故障转移（见 lib/agent-store.ts fetchStoreIndex）。
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PlusIcon, RotateCcwIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  defaultStoreSources,
  fetchStoreSourcesConfig,
  saveStoreSourcesConfig,
  STORE_CATEGORIES,
  type StoreCategory,
  type StoreSource,
  type StoreSourcesConfig,
} from '@/lib/store-sources';

/** 类别 → 标题 i18n key（settings 命名空间）。 */
const CATEGORY_TITLE_KEYS: Record<StoreCategory, string> = {
  plugins: 'storeCategoryPlugins',
  workflows: 'storeCategoryWorkflows',
  'mini-app': 'storeCategoryMiniApp',
};

function newSource(): StoreSource {
  return { id: crypto.randomUUID(), name: '', url: '', default: false };
}

/** 行内校验：每行 URL 必填（http(s) 或 / 开头的相对路径）。 */
function validateSources(config: StoreSourcesConfig): boolean {
  return STORE_CATEGORIES.every((category) =>
    config[category].every(
      (source) => {
        const url = source.url.trim();
        return url !== '' && (/^https?:\/\/\S+$/i.test(url) || /^\/\S+$/.test(url));
      },
    ),
  );
}

export function StoreSourcesPanel() {
  const t = useTranslations('settings');
  const [config, setConfig] = useState<StoreSourcesConfig>(() => defaultStoreSources());
  const [usingDefaults, setUsingDefaults] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // 打开面板时加载后端配置；null = 未配置，展示默认源
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const sources = await fetchStoreSourcesConfig();
        if (cancelled) return;
        setConfig(sources ?? defaultStoreSources());
        setUsingDefaults(sources === null);
      } catch {
        // 加载失败：保持默认源展示，保存时仍会报错
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSource = (category: StoreCategory, id: string, patch: Partial<StoreSource>) => {
    setConfig((prev) => ({
      ...prev,
      [category]: prev[category].map((source) =>
        source.id === id ? { ...source, ...patch } : source,
      ),
    }));
    setDirty(true);
    setSaved(false);
  };

  const addSource = (category: StoreCategory) => {
    setConfig((prev) => {
      // 空类别的第一个源自动成为默认（radio 必须有选中项）
      const source = prev[category].length === 0 ? { ...newSource(), default: true } : newSource();
      return { ...prev, [category]: [...prev[category], source] };
    });
    setDirty(true);
    setSaved(false);
  };

  const removeSource = (category: StoreCategory, id: string) => {
    setConfig((prev) => {
      const remaining = prev[category].filter((source) => source.id !== id);
      // 删掉默认源后，剩余列表第一个补为默认
      const removed = prev[category].find((source) => source.id === id);
      if (removed?.default && remaining.length > 0 && !remaining.some((s) => s.default)) {
        remaining[0] = { ...remaining[0], default: true };
      }
      return { ...prev, [category]: remaining };
    });
    setDirty(true);
    setSaved(false);
  };

  /** radio 选中默认源：同类别仅该源 default=true。 */
  const setDefaultSource = (category: StoreCategory, id: string) => {
    setConfig((prev) => ({
      ...prev,
      [category]: prev[category].map((source) => ({ ...source, default: source.id === id })),
    }));
    setDirty(true);
    setSaved(false);
  };

  const handleSave = async () => {
    if (!validateSources(config)) {
      setError(t('storeSourceInvalidUrl'));
      return;
    }
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await saveStoreSourcesConfig(config);
      setUsingDefaults(false);
      setDirty(false);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await saveStoreSourcesConfig(null);
      setConfig(defaultStoreSources());
      setUsingDefaults(true);
      setDirty(false);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-muted-foreground">{t('storeSourcesDesc')}</p>
      {usingDefaults && !dirty && (
        <p className="text-xs text-muted-foreground">{t('storeSourceDefaultHint')}</p>
      )}
      {STORE_CATEGORIES.map((category) => (
        <section key={category} className="flex flex-col gap-2.5">
          <h3 className="text-sm font-medium text-foreground">
            {t(CATEGORY_TITLE_KEYS[category])}
            <span className="ms-2 text-xs font-normal text-muted-foreground">
              {t('storeSourceCount', { count: config[category].length })}
            </span>
          </h3>
          <div className="flex flex-col gap-2">
            <RadioGroup
              value={config[category].find((source) => source.default === true)?.id}
              onValueChange={(id) => setDefaultSource(category, id)}
              className="contents"
              aria-label={`${t(CATEGORY_TITLE_KEYS[category])} ${t('storeSourceDefault')}`}
            >
              {config[category].map((source, index) => (
                <div key={source.id} className="flex items-center gap-2">
                  <RadioGroupItem
                    value={source.id}
                    aria-label={`${t(CATEGORY_TITLE_KEYS[category])} #${index + 1} ${t('storeSourceDefault')}`}
                  />
                  <Input
                    className="w-28 shrink-0"
                    value={source.name}
                    placeholder={t('storeSourceName')}
                    aria-label={`${t(CATEGORY_TITLE_KEYS[category])} #${index + 1} ${t('storeSourceName')}`}
                    onChange={(event) => updateSource(category, source.id, { name: event.target.value })}
                  />
                  <Input
                    className="min-w-0 flex-1"
                    value={source.url}
                    placeholder={t('storeSourceUrl')}
                    aria-label={`${t(CATEGORY_TITLE_KEYS[category])} #${index + 1} ${t('storeSourceUrl')}`}
                    spellCheck={false}
                    onChange={(event) => updateSource(category, source.id, { url: event.target.value })}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={t('storeSourceDelete')}
                    disabled={saving}
                    onClick={() => removeSource(category, source.id)}
                  >
                    <Trash2Icon aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </RadioGroup>
            {config[category].length === 0 && (
              <p className="text-xs text-muted-foreground">{t('storeSourceEmpty')}</p>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            disabled={saving}
            onClick={() => addSource(category)}
          >
            <PlusIcon aria-hidden="true" />
            {t('storeSourceAdd')}
          </Button>
        </section>
      ))}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={saving || !dirty}
          onClick={() => void handleSave()}
        >
          {saving ? t('saving') : t('save')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={saving || (usingDefaults && !dirty)}
          onClick={() => void handleReset()}
        >
          <RotateCcwIcon aria-hidden="true" />
          {t('storeSourceReset')}
        </Button>
        {saved && !error && (
          <span className="text-sm text-muted-foreground">{t('saved')}</span>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
