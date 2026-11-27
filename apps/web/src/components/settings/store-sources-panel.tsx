'use client';

/**
 * 【商店源】Tab：plugins / workflows / mini-app 三类商店的源地址管理。
 * 默认每类两个源（GitHub + 本地镜像端口），可添加 / 修改 / 删除，
 * 修改即自动保存（500ms 防抖，PUT /api/user/store-sources，存 user-settings.json）。
 * 商店索引拉取按列表顺序故障转移（见 lib/agent-store.ts fetchStoreIndex）。
 */

import { useEffect, useRef, useState } from 'react';
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

/** 完全空白的行视为草稿：不进入保存载荷（填好后才持久化）。 */
function stripDraftRows(config: StoreSourcesConfig): StoreSourcesConfig {
  const result = {} as StoreSourcesConfig;
  for (const category of STORE_CATEGORIES) {
    result[category] = config[category].filter(
      (source) => source.name.trim() !== '' || source.url.trim() !== '',
    );
  }
  return result;
}

/** 行内校验：每行 URL 必填（http(s) 或 / 开头的相对路径）。 */
function validateSources(config: StoreSourcesConfig): boolean {
  return STORE_CATEGORIES.every((category) =>
    config[category].every((source) => {
      const url = source.url.trim();
      return url !== '' && (/^https?:\/\/\S+$/i.test(url) || /^\/\S+$/.test(url));
    }),
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
  const [invalidHint, setInvalidHint] = useState(false);

  // 最新配置与最近一次已尝试版本（失败后等修改或手动重试，避免自动重试风暴）
  const configRef = useRef(config);
  configRef.current = config;
  const lastAttemptedRef = useRef<StoreSourcesConfig | null>(null);

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

  /** 所有编辑入口共用：改配置 + 标记待自动保存。 */
  const mutate = (updater: (prev: StoreSourcesConfig) => StoreSourcesConfig) => {
    setConfig(updater);
    setDirty(true);
    setSaved(false);
  };

  const updateSource = (category: StoreCategory, id: string, patch: Partial<StoreSource>) => {
    mutate((prev) => ({
      ...prev,
      [category]: prev[category].map((source) =>
        source.id === id ? { ...source, ...patch } : source,
      ),
    }));
  };

  const addSource = (category: StoreCategory) => {
    mutate((prev) => {
      // 空类别的第一个源自动成为默认（radio 必须有选中项）
      const source = prev[category].length === 0 ? { ...newSource(), default: true } : newSource();
      return { ...prev, [category]: [...prev[category], source] };
    });
  };

  const removeSource = (category: StoreCategory, id: string) => {
    mutate((prev) => {
      const remaining = prev[category].filter((source) => source.id !== id);
      // 删掉默认源后，剩余列表第一个补为默认
      const removed = prev[category].find((source) => source.id === id);
      if (removed?.default && remaining.length > 0 && !remaining.some((s) => s.default)) {
        remaining[0] = { ...remaining[0], default: true };
      }
      return { ...prev, [category]: remaining };
    });
  };

  /** radio 选中默认源：同类别仅该源 default=true。 */
  const setDefaultSource = (category: StoreCategory, id: string) => {
    mutate((prev) => ({
      ...prev,
      [category]: prev[category].map((source) => ({ ...source, default: source.id === id })),
    }));
  };

  const doSave = async (payload: StoreSourcesConfig, version: StoreSourcesConfig) => {
    lastAttemptedRef.current = version;
    setSaving(true);
    setError('');
    try {
      await saveStoreSourcesConfig(payload);
      // 保存期间无新修改才收口状态；有修改则保持 dirty，saving 翻转后 effect 会补存
      if (configRef.current === version) {
        setUsingDefaults(false);
        setDirty(false);
        setSaved(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  // 修改即生效：dirty 且非保存中时 500ms 防抖自动保存；
  // 校验不通过（非空白行 URL 无效）时提示并暂缓，修正后自动继续。
  useEffect(() => {
    if (!dirty || saving) return;
    if (config === lastAttemptedRef.current) return;
    const payload = stripDraftRows(config);
    if (!validateSources(payload)) {
      setInvalidHint(true);
      return;
    }
    setInvalidHint(false);
    const timer = setTimeout(() => {
      void doSave(payload, config);
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doSave/t 为稳定引用
  }, [config, dirty, saving]);

  const handleRetry = () => {
    const payload = stripDraftRows(config);
    if (!validateSources(payload)) {
      setInvalidHint(true);
      return;
    }
    setInvalidHint(false);
    void doSave(payload, config);
  };

  const handleReset = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    setInvalidHint(false);
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
      <div className="flex flex-wrap items-center gap-3">
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
        {saving && <span className="text-sm text-muted-foreground">{t('saving')}</span>}
        {!saving && saved && !dirty && !error && (
          <span className="text-sm text-muted-foreground">{t('saved')}</span>
        )}
        {error && (
          <>
            <p className="text-sm text-destructive">{error}</p>
            <Button type="button" variant="outline" size="sm" disabled={saving} onClick={handleRetry}>
              {t('retry')}
            </Button>
          </>
        )}
        {!error && invalidHint && (
          <p className="text-xs text-muted-foreground">{t('storeSourceInvalidUrl')}</p>
        )}
      </div>
    </div>
  );
}
