'use client';

/**
 * 设置对话框：左侧竖排 Tabs（下划线 + 图标前置，参考 coss p-tabs-11）。
 * 首个 Tab 为【外观】（主题模式 + 鼠标指针/react-cursor-studio），
 * 其余 Tab：【通用】语言设置、【模型】服务商与模型列表、【账号】个人资料与头像。
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabList, Tab, TabPanel } from '@/components/base/tabs/tabs';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useTheme } from '@/components/layout/theme-provider';
import { useLocale, type Locale } from '@/components/layout/locale-provider';
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
import {
  BrainIcon,
  CheckIcon,
  LanguagesIcon,
  MonitorIcon,
  MoonIcon,
  MousePointerIcon,
  PaletteIcon,
  SettingsIcon,
  SunIcon,
  Trash2Icon,
  UploadIcon,
  UserIcon,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAccountStore } from '@/stores/account';
import { removeAvatar, updateProfile, uploadAvatar } from '@/lib/account-api';
import { resolveServerAssetUrl } from '@/lib/server';
import { Avatar } from '../sidebar-rail/Avatar';
import { ModelSettingsPanel } from './model-settings-panel';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

interface OptionCardProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  preview?: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
}

/** 单选卡片：主题 / 语言等设置项共用。 */
function OptionCard({
  icon: Icon,
  title,
  description,
  preview,
  selected,
  onSelect,
}: OptionCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'group relative flex flex-col items-start gap-2.5 rounded-xl border p-3 text-left outline-none transition-colors',
        'focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'border-primary ring-2 ring-primary/40'
          : 'border-border hover:bg-accent/50',
      )}
    >
      {preview && (
        <div className="aspect-[16/10] w-full overflow-hidden rounded-lg border border-border bg-background">
          {preview}
        </div>
      )}
      <span className="flex w-full items-center gap-2 text-sm font-medium text-foreground">
        <Icon
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        {title}
      </span>
      {description && (
        <span className="text-xs text-muted-foreground">{description}</span>
      )}
      {selected && (
        <span
          className="absolute end-2 top-2 flex size-4.5 items-center justify-center rounded-full bg-primary text-primary-foreground"
          aria-hidden="true"
        >
          <CheckIcon className="size-3" />
        </span>
      )}
    </button>
  );
}

/** 【主题】Tab：外观模式选择。 */
function ThemePanel() {
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

/** 【外观】Tab · 鼠标指针：react-cursor-studio 样式 / 音效 / 拖尾长度。 */
function CursorPanel() {
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

/** 【通用】Tab：界面语言选择。 */
function GeneralPanel() {
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

/** 【账号】Tab：头像 + 用户名管理（经 account store 与侧边栏即时同步）。 */
function AccountPanel() {
  const t = useTranslations('settings');
  const name = useAccountStore((s) => s.name);
  const avatarUrl = useAccountStore((s) => s.avatarUrl);
  const load = useAccountStore((s) => s.load);
  const applyProfile = useAccountStore((s) => s.applyProfile);

  const [userName, setUserName] = useState(name);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void load();
  }, [load]);

  // store 中的资料被外部刷新（如侧边栏）时同步输入框
  useEffect(() => {
    setUserName(name);
  }, [name]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const profile = await updateProfile(userName.trim());
      applyProfile(profile);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (file: File) => {
    setBusy(true);
    setError('');
    try {
      const { url } = await uploadAvatar(file);
      applyProfile({ name, avatarUrl: url });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    setError('');
    try {
      await removeAvatar();
      applyProfile({ name, avatarUrl: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-foreground">{t('userAvatar')}</h3>
        <div className="flex items-center gap-4">
          <Avatar
            name={name}
            src={avatarUrl ? resolveServerAssetUrl(avatarUrl) : undefined}
            size="lg"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadIcon aria-hidden="true" />
              {busy ? t('avatarUploading') : t('uploadAvatar')}
            </Button>
            {avatarUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void handleRemove()}
              >
                <Trash2Icon aria-hidden="true" />
                {t('removeAvatar')}
              </Button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleUpload(file);
              event.target.value = '';
            }}
          />
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-foreground">{t('userName')}</h3>
        <Input
          value={userName}
          placeholder={t('userNamePlaceholder')}
          onChange={(event) => setUserName(event.target.value)}
        />
        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="sm"
            disabled={saving || busy || !userName.trim()}
            onClick={() => void handleSave()}
          >
            {saving ? t('saving') : t('save')}
          </Button>
          {saved && !error && (
            <span className="text-sm text-muted-foreground">{t('saved')}</span>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </section>
    </div>
  );
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const t = useTranslations('settings');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 h-[600px] w-[760px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]">
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <Tabs defaultSelectedKey="appearance" orientation="vertical" className="min-h-0 flex-1 gap-0">
          {/* 左侧竖排导航：外层 border-r 贯穿全高（TabList 自带线只到自身高度，故关掉避免断线） */}
          <div className="w-40 shrink-0 border-r py-3">
            <TabList orientation="vertical" className="border-r-0">
              <Tab id="appearance">
                <PaletteIcon aria-hidden="true" />
                {t('appearance')}
              </Tab>
              <Tab id="general">
                <SettingsIcon aria-hidden="true" />
                {t('general')}
              </Tab>
              <Tab id="models">
                <BrainIcon aria-hidden="true" />
                {t('modelsTab')}
              </Tab>
              <Tab id="account">
                <UserIcon aria-hidden="true" />
                {t('accountTab')}
              </Tab>
            </TabList>
          </div>
          <TabPanel id="appearance" className="min-w-0 flex-1 p-6">
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-medium text-foreground">{t('theme')}</h3>
              <ThemePanel />
            </section>
            <section className="mt-8 flex flex-col gap-3">
              <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
                <MousePointerIcon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                {t('cursor')}
              </h3>
              <CursorPanel />
            </section>
          </TabPanel>
          <TabPanel id="general" className="min-w-0 flex-1 p-6">
            <GeneralPanel />
          </TabPanel>
          <TabPanel id="models" className="max-h-[65vh] min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
            <ModelSettingsPanel />
          </TabPanel>
          <TabPanel id="account" className="min-w-0 flex-1 p-6">
            <AccountPanel />
          </TabPanel>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
