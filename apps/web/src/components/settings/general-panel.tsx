'use client';

/**
 * 【通用】Tab：界面语言选择。
 */

import { useTranslations } from 'next-intl';
import { LanguagesIcon, type LucideIcon } from 'lucide-react';
import { useLocale, type Locale } from '@/components/layout/locale-provider';
import { OptionCard } from './option-card';

export function GeneralPanel() {
  const t = useTranslations('settings');
  const { locale, setLocale } = useLocale();

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
    </div>
  );
}
