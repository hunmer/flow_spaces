'use client';

/**
 * 【外观】Tab：主题模式选择 + 鼠标指针（react-cursor-studio）设置。
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CURSOR_CHANGE_EVENT,
  CURSOR_STYLES,
  getCursorStyleKey,
  getCursorTrailPercent,
  isCursorSoundEnabled,
  setCursorSoundEnabled,
  setCursorStyle,
  setCursorTrailPercent,
} from 'react-cursor-studio';
import {
  CheckIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { THEME_ACCENTS, useTheme } from '@/components/layout/theme-provider';
import { OptionCard } from './option-card';

/** cursor 样式 key → settings 命名空间的 i18n key（未知 key 回退包内名称）。 */
const CURSOR_LABEL_KEYS: Record<string, string> = {
  ring: 'cursorRing',
  ribbon: 'cursorRibbon',
  crosshair: 'cursorCrosshair',
  stardust: 'cursorStardust',
  fluid: 'cursorFluid',
};

/** 与 ThemeProvider 内部定义保持一致的偏好值。 */
type Theme = 'light' | 'dark' | 'system';

/** 浅色主题预览（与 ThemeProvider 的 light 主题色一致）。 */
function LightPreview() {
  return (
    <div className="flex h-full w-full bg-white">
      <div className="w-1/4 border-e border-neutral-200 bg-neutral-100" />
      <div className="flex flex-1 flex-col gap-1 p-1.5">
        <div className="h-1 w-3/4 rounded-full bg-neutral-300" />
        <div className="h-1 w-1/2 rounded-full bg-neutral-200" />
        <div className="h-1 w-2/3 rounded-full bg-neutral-200" />
      </div>
    </div>
  );
}

/** 深色主题预览（与 ThemeProvider 的 dark 主题色一致）。 */
function DarkPreview() {
  return (
    <div className="flex h-full w-full bg-[#0f1117]">
      <div className="w-1/4 border-e border-white/10 bg-white/[0.04]" />
      <div className="flex flex-1 flex-col gap-1 p-1.5">
        <div className="h-1 w-3/4 rounded-full bg-slate-500" />
        <div className="h-1 w-1/2 rounded-full bg-slate-700" />
        <div className="h-1 w-2/3 rounded-full bg-slate-700" />
      </div>
    </div>
  );
}

/** 跟随系统：左右分屏展示浅色 / 深色。 */
function SystemPreview() {
  return (
    <div className="flex h-full w-full">
      <div className="w-1/2 border-e border-black/10">
        <LightPreview />
      </div>
      <div className="w-1/2">
        <DarkPreview />
      </div>
    </div>
  );
}

/** 【主题】Tab：外观模式选择。 */
export function ThemePanel() {
  const t = useTranslations('settings');
  const { theme, setTheme } = useTheme();

  const options: Array<{
    value: Theme;
    label: string;
    icon: LucideIcon;
    preview: React.ReactNode;
  }> = [
    { value: 'light', label: t('themeLight'), icon: SunIcon, preview: <LightPreview /> },
    { value: 'dark', label: t('themeDark'), icon: MoonIcon, preview: <DarkPreview /> },
    { value: 'system', label: t('themeSystem'), icon: MonitorIcon, preview: <SystemPreview /> },
  ];

  return (
    <div
      role="radiogroup"
      aria-label={t('theme')}
      className="grid gap-3 sm:grid-cols-3"
    >
      {options.map((option) => (
        <OptionCard
          key={option.value}
          icon={option.icon}
          title={option.label}
          preview={option.preview}
          selected={theme === option.value}
          onSelect={() => setTheme(option.value)}
        />
      ))}
    </div>
  );
}

/** accent key → settings 命名空间的 i18n key。 */
const ACCENT_LABEL_KEYS: Record<string, string> = {
  blue: 'accentBlue',
  violet: 'accentViolet',
  cyan: 'accentCyan',
  emerald: 'accentEmerald',
  amber: 'accentAmber',
  orange: 'accentOrange',
  red: 'accentRed',
  pink: 'accentPink',
};

/** 【外观】Tab · 主题色：圆点列表切换 accent（swatch 为功能色值，非主题 token）。 */
export function ThemeColorPanel() {
  const t = useTranslations('settings');
  const { accent, setAccent } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label={t('themeColor')}
      className="flex flex-wrap gap-2.5"
    >
      {THEME_ACCENTS.map((option) => {
        const selected = accent === option.key;
        const label = ACCENT_LABEL_KEYS[option.key]
          ? t(ACCENT_LABEL_KEYS[option.key])
          : option.key;
        return (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={() => setAccent(option.key)}
            className={cn(
              'flex size-8 items-center justify-center rounded-full outline-none transition-transform',
              'focus-visible:ring-2 focus-visible:ring-ring',
              selected
                ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                : 'hover:scale-110',
            )}
          >
            <span
              className="flex size-5 items-center justify-center rounded-full"
              style={{ backgroundColor: option.swatch }}
            >
              {selected && (
                <CheckIcon
                  className="size-3 text-primary-foreground"
                  aria-hidden="true"
                />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** 【外观】Tab · 鼠标指针：react-cursor-studio 样式 / 音效 / 拖尾长度。 */
export function CursorPanel() {
  const t = useTranslations('settings');
  const [styleKey, setStyleKey] = useState(() => getCursorStyleKey());
  const [sound, setSound] = useState(() => isCursorSoundEnabled());
  const [trail, setTrail] = useState(() => getCursorTrailPercent());
  const active = styleKey !== '';

  // 引擎任何设置变化都会派发 CURSOR_CHANGE_EVENT，监听以保持回显同步
  useEffect(() => {
    const sync = () => {
      setStyleKey(getCursorStyleKey());
      setSound(isCursorSoundEnabled());
      setTrail(getCursorTrailPercent());
    };
    window.addEventListener(CURSOR_CHANGE_EVENT, sync);
    return () => window.removeEventListener(CURSOR_CHANGE_EVENT, sync);
  }, []);

  const styleOptions = [
    { key: '', label: t('cursorDefault') },
    ...CURSOR_STYLES.map((style) => ({
      key: style.key,
      label: CURSOR_LABEL_KEYS[style.key]
        ? t(CURSOR_LABEL_KEYS[style.key])
        : style.name,
    })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div
        role="radiogroup"
        aria-label={t('cursor')}
        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
      >
        {styleOptions.map((option) => (
          <button
            key={option.key || 'cursor-default'}
            type="button"
            role="radio"
            aria-checked={styleKey === option.key}
            onClick={() => setCursorStyle(option.key)}
            className={cn(
              'rounded-lg border px-3 py-2 text-sm outline-none transition-colors',
              'focus-visible:ring-2 focus-visible:ring-ring',
              styleKey === option.key
                ? 'border-primary font-medium text-foreground ring-2 ring-primary/40'
                : 'border-border text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div
        aria-disabled={!active}
        className={cn(
          'flex flex-col gap-4 transition-opacity',
          !active && 'pointer-events-none opacity-50',
        )}
      >
        <label className="flex items-center justify-between gap-4">
          <span className="text-sm text-foreground">{t('cursorSound')}</span>
          <Switch
            size="sm"
            checked={sound}
            onCheckedChange={(checked) => setCursorSoundEnabled(checked)}
          />
        </label>
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">{t('cursorTrail')}</span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {trail}%
            </span>
          </div>
          <Slider
            min={30}
            max={180}
            value={trail}
            onValueChange={(value) => {
              const next = Array.isArray(value) ? value[0] : value;
              if (typeof next === 'number') {
                setTrail(next);
                setCursorTrailPercent(next);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
