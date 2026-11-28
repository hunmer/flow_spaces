'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import type { MiniAppInstallProgress } from '@flow-spaces/sdk';
import { Button } from '@/components/ui/button';
import { Button as DevelopmentButton } from '@/components/base/buttons/button';
import { RiCodeLine } from '@remixicon/react';
import { Check, Download, RefreshCw } from 'lucide-react';
import { resolveStoreUrl } from '@/lib/agent-store';
import { AgentIcon } from '@/components/common/agent-icon';
import { Markdown } from '@/components/ui/markdown';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { MiniAppIndexItem, MiniAppInstallStatus } from './mini-apps-store-card';

function formatLocalDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex w-full text-left text-sm">
      <span className="w-16 shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 break-all">{value}</span>
    </div>
  );
}

interface MiniAppStoreDetailDialogProps {
  /** 当前查看的商店条目；null 时不渲染 */
  item: MiniAppIndexItem | null;
  /** 三态安装状态（与商店卡片一致） */
  status: MiniAppInstallStatus;
  /** 当前条目正在安装 */
  importing?: boolean;
  progress?: MiniAppInstallProgress;
  /** 将进度放到用户点击的按钮上 */
  installingDevelopment?: boolean;
  /** 某项正在安装时禁用按钮 */
  disabled?: boolean;
  onInstall: (item: MiniAppIndexItem, installDevelopment?: boolean) => void;
  onClose: () => void;
}

/** 商店条目详情对话框：左 1/4 应用信息 + 安装按钮，右 3/4 README 介绍 */
export function MiniAppStoreDetailDialog({
  item,
  status,
  importing,
  progress,
  installingDevelopment,
  disabled,
  onInstall,
  onClose,
}: MiniAppStoreDetailDialogProps) {
  const t = useTranslations('mini-apps');
  const progressLabel = progress?.total
    ? t('store.installProgress', {
      percent: Math.floor(progress.completed / progress.total * 100),
      completed: progress.completed,
      total: progress.total,
    })
    : t('store.installPreparing');
  const [intro, setIntro] = useState<{ loading: boolean; content: string; error: boolean }>({
    loading: false,
    content: '',
    error: false,
  });

  const itemId = item?.id;
  const itemHasIntro = item?.hasIntro ?? false;
  const itemIntroUrl = item?.introUrl;

  useEffect(() => {
    if (!itemId || !itemHasIntro) {
      setIntro({ loading: false, content: '', error: false });
      return;
    }
    const controller = new AbortController();
    setIntro({ loading: true, content: '', error: false });
    // 介绍内容直接读 app 目录的 README.md（源目录即商店内容，无 intro 产物目录）
    fetch(itemIntroUrl ?? resolveStoreUrl(`mini-app/${itemId}/README.md`), { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.text();
      })
      .then((text) => {
        setIntro({ loading: false, content: text, error: false });
      })
      .catch((err) => {
        if (controller.signal.aborted || err?.name === 'AbortError') return;
        setIntro({ loading: false, content: '', error: true });
      });
    return () => controller.abort();
  }, [itemId, itemHasIntro, itemIntroUrl]);

  if (!item) return null;

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-4xl p-0 gap-0 h-[75vh]">
        <DialogHeader className="px-6 pt-5 pb-4 pe-12 border-b shrink-0">
          <DialogTitle className="truncate">{item.name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col sm:flex-row min-h-0 flex-1">
          {/* 左栏（1/4）：应用信息 + 安装按钮 */}
          <aside className="sm:w-1/4 shrink-0 border-b sm:border-b-0 sm:border-e p-4 flex flex-col items-center text-center gap-3 overflow-y-auto">
            <AgentIcon
              name={item.name}
              avatarUrl={item.iconUrl ? (/^https?:\/\//.test(item.iconUrl) ? item.iconUrl : resolveStoreUrl(item.iconUrl)) : undefined}
              icon={item.icon}
              className="size-16 rounded"
            />
            <span className="font-semibold text-base break-all">{item.name}</span>
            {item.description && (
              <p className="text-xs text-muted-foreground break-all">{item.description}</p>
            )}
            <div className="w-full border-t my-1" />
            <Meta label={t('detail.type')} value={item.type || '-'} />
            <Meta label={t('detail.version')} value={item.version || '-'} />
            <Meta
              label={t('detail.tags')}
              value={Array.isArray(item.tags) && item.tags.length ? item.tags.join(', ') : '-'}
            />
            <Meta label={t('detail.updatedAt')} value={formatLocalDate(item.updatedAt) || '-'} />
            <Button
              variant={
                status === 'installed' ? 'secondary' : status === 'updatable' ? 'default' : 'outline'
              }
              size="sm"
              className="w-full h-8 mt-1"
              disabled={disabled || importing || status === 'installed'}
              aria-busy={importing && !installingDevelopment}
              onClick={() => onInstall(item)}
            >
              {importing && !installingDevelopment ? (
                <>
                  <span className="me-1 h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {progressLabel}
                </>
              ) : status === 'installed' ? (
                <>
                  <Check className="size-3.5 mr-1" />
                  {t('store.installed')}
                </>
              ) : status === 'updatable' ? (
                <>
                  <RefreshCw className="size-3.5 mr-1" />
                  {t('store.update')}
                </>
              ) : (
                <>
                  <Download className="size-3.5 mr-1" />
                  {t('store.import')}
                </>
              )}
            </Button>
            {(item.hasDevelopment || !!item.development?.length) && (
              <DevelopmentButton
                variant="secondary"
                size="small"
                className="w-full"
                leadingIcon={RiCodeLine}
                disabled={disabled || importing}
                aria-busy={importing && installingDevelopment}
                onClick={() => onInstall(item, true)}
              >
                {importing && installingDevelopment ? progressLabel : t('store.installDevelopment')}
              </DevelopmentButton>
            )}
          </aside>
          {/* 右栏（3/4）：README 介绍 */}
          <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6">
            {item.hasIntro ? (
              intro.loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                  <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {t('detail.loading')}
                </div>
              ) : intro.error ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                  {t('detail.error')}
                </div>
              ) : (
                <Markdown content={intro.content} />
              )
            ) : (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                {t('detail.empty')}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
