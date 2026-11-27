'use client';

/**
 * 【通用】Tab：界面语言与 Mini App 加载设置。
 */

import { useTranslations } from 'next-intl';
import { LanguagesIcon, type LucideIcon } from 'lucide-react';
import { useLocale, type Locale } from '@/components/layout/locale-provider';
import { OptionCard } from './option-card';
import { Switch } from '@/components/base/switch/switch';
import { useMiniAppLoadingStore } from '@/stores/mini-app-loading';

export function GeneralPanel() {
  const t = useTranslations('settings');
  const { locale, setLocale } = useLocale();
  const fastLoading = useMiniAppLoadingStore((state) => state.fastLoading);
  const setFastLoading = useMiniAppLoadingStore((state) => state.setFastLoading);

  const options: Array<{
    value: Locale;
    label: string;
    icon: LucideIcon;
  }> = [
    { value: 'zh', label: t('languageZh'), icon: LanguagesIcon },
    { value: 'en', label: t('languageEn'), icon: LanguagesIcon },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label={t('language')} className="grid gap-3 sm:grid-cols-2">
        {options.map((option) => (
          <OptionCard
            key={option.value}
            icon={option.icon}
            title={option.label}
            selected={locale === option.value}
            onSelect={() => setLocale(option.value)}
          />
        ))}
      </div>
      <div className="flex items-center justify-between gap-4 rounded-3xl border border-border-button-default p-4">
        <div className="flex flex-col gap-1">
          <p id="mini-app-fast-loading-label" className="text-body-medium text-text-primary">{t('miniAppFastLoading')}</p>
          <p id="mini-app-fast-loading-description" className="text-body-2-regular text-text-secondary">{t('miniAppFastLoadingDescription')}</p>
        </div>
        <Switch
          aria-labelledby="mini-app-fast-loading-label"
          aria-describedby="mini-app-fast-loading-description"
          isSelected={fastLoading}
          onChange={setFastLoading}
        />
      </div>
    </div>
  );
}
