'use client';

/**
 * 设置对话框：左侧竖排 Tabs（下划线 + 图标前置，参考 coss p-tabs-11）。
 * 首个 Tab 为【外观】（主题模式 + 鼠标指针/react-cursor-studio），
 * 其余 Tab：【通用】语言与 Mini App 加载设置、【模型】服务商与模型列表、
 * 【商店源】plugins / workflows / mini-app 商店地址、【账号】个人资料与头像。
 * 各面板实现在同目录独立文件：appearance-panel / general-panel /
 * model-settings-panel / store-sources-panel / account-panel。
 */

import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabList, Tab, TabPanel } from '@/components/base/tabs/tabs';
import {
  BrainIcon,
  MousePointerIcon,
  PaletteIcon,
  SettingsIcon,
  StoreIcon,
  UserIcon,
} from 'lucide-react';
import { ThemePanel, CursorPanel } from './appearance-panel';
import { GeneralPanel } from './general-panel';
import { ModelSettingsPanel } from './model-settings-panel';
import { StoreSourcesPanel } from './store-sources-panel';
import { AccountPanel } from './account-panel';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
              <Tab id="store">
                <StoreIcon aria-hidden="true" />
                {t('storeSourcesTab')}
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
          <TabPanel id="store" className="min-w-0 flex-1 overflow-y-auto p-6">
            <StoreSourcesPanel />
          </TabPanel>
          <TabPanel id="account" className="min-w-0 flex-1 p-6">
            <AccountPanel />
          </TabPanel>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
