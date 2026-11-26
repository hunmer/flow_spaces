'use client';

import { useTranslations } from 'next-intl';
import { Check, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/base/badges/chip';
import { AgentIcon } from '@/components/common/agent-icon';
import { FeatureCard } from '@/components/ui/feature-card';
import { resolveStoreUrl } from '@/lib/agent-store';

/** 商店索引条目（mini-app/index.json） */
export interface MiniAppIndexItem {
  id: string;
  name: string;
  type?: 'react' | 'html';
  icon?: string;
  iconUrl?: string;
  description?: string;
  md5?: string;
  updatedAt?: string;
  hasIntro?: boolean;
  version?: string;
  tags?: string[];
  /** 文件级 md5 清单：server 对比本地按需下载（增量安装） */
  files?: Array<{ path: string; md5: string }>;
}

export type MiniAppInstallStatus = 'not-installed' | 'updatable' | 'installed';

interface MiniAppStoreCardProps {
  item: MiniAppIndexItem;
  /** 三态：未安装 / 有更新（商店 version ≠ 已安装 version）/ 已导入 */
  status: MiniAppInstallStatus;
  /** 某项正在安装时禁用全部按钮 */
  disabled?: boolean;
  /** 当前卡片正在安装 */
  importing?: boolean;
  onInstall: (item: MiniAppIndexItem) => void;
  onOpenDetail: (item: MiniAppIndexItem) => void;
}

/** 商店模式卡片：复用本地 MiniAppCard 的 FeatureCard 视觉，底部为三态安装按钮 */
export function MiniAppStoreCard({
  item,
  status,
  disabled,
  importing,
  onInstall,
  onOpenDetail,
}: MiniAppStoreCardProps) {
  const t = useTranslations('mini-apps');

  return (
    <FeatureCard
      color="blue"
      className="cursor-pointer h-[260px]"
      centerIcon={
        <AgentIcon
          name={item.name}
          avatarUrl={item.iconUrl ? resolveStoreUrl(item.iconUrl) : undefined}
          icon={item.icon}
          bordered={false}
          textSize="text-4xl"
          rounded="rounded-2xl"
          className="size-24"
        />
      }
      onClick={() => onOpenDetail(item)}
    >
      {/* Type badge (top-left) */}
      <div className="absolute top-2.5 left-3 z-10">
        <Chip variant="caption" color={item.type === 'react' ? 'blue' : 'neutral'}>
          {item.type === 'react' ? 'React' : 'HTML'}
        </Chip>
      </div>

      {/* Bottom glass panel */}
      <div className="mt-auto">
        <div className="rounded-t-xl p-3 bg-background/80 dark:bg-background/60 backdrop-blur-sm border-t text-card-foreground">
          <p className="text-sm font-medium truncate mb-1">{item.name}</p>
          <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px] mb-2">
            {item.description || '—'}
          </p>
          <Button
            variant={status === 'installed' ? 'secondary' : status === 'updatable' ? 'default' : 'outline'}
            size="sm"
            className="w-full h-7"
            disabled={disabled || status === 'installed'}
            onClick={(e) => {
              e.stopPropagation();
              onInstall(item);
            }}
          >
            {importing ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
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
        </div>
      </div>
    </FeatureCard>
  );
}
