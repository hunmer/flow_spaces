'use client';

import { useTranslations } from 'next-intl';
import { Check, Eye } from 'lucide-react';
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
  /** 开发版额外下载的源码与构建配置 */
  development?: Array<{ path: string; md5: string }>;
}

export type MiniAppInstallStatus = 'not-installed' | 'updatable' | 'installed';

interface MiniAppStoreCardProps {
  item: MiniAppIndexItem;
  /** 三态：未安装 / 有更新（商店 version ≠ 已安装 version）/ 已导入 */
  status: MiniAppInstallStatus;
  onOpenDetail: (item: MiniAppIndexItem) => void;
}

/** 商店模式卡片：复用本地 MiniAppCard 的 FeatureCard 视觉，底部为「查看详情」按钮；已安装时右上角展示角标，安装/更新入口移入详情对话框 */
export function MiniAppStoreCard({ item, status, onOpenDetail }: MiniAppStoreCardProps) {
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

      {/* Installed badge (top-right) */}
      {status === 'installed' && (
        <div className="absolute top-2.5 right-3 z-10">
          <Chip variant="caption" color="lime" className="gap-1">
            <Check className="size-3" />
            {t('store.installed')}
          </Chip>
        </div>
      )}

      {/* Bottom glass panel */}
      <div className="mt-auto">
        <div className="rounded-t-xl p-3 bg-background/80 dark:bg-background/60 backdrop-blur-sm border-t text-card-foreground">
          <p className="text-sm font-medium truncate mb-1">{item.name}</p>
          <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px] mb-2">
            {item.description || '—'}
          </p>
          <Button
            variant="default"
            size="sm"
            className="w-full h-7"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail(item);
            }}
          >
            <Eye className="size-3.5 mr-1" />
            {t('store.viewDetail')}
          </Button>
        </div>
      </div>
    </FeatureCard>
  );
}
