'use client';

import { useTranslations } from 'next-intl';
import { Check, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/base/badges/chip';
import { AgentIcon } from '@/components/common/agent-icon';
import { FeatureCard } from '@/components/ui/feature-card';
import { resolveStoreUrl } from '@/lib/agent-store';
import { cx } from '@/utils/cx';

/** 商店索引条目（mini-app/index.json） */
export interface MiniAppIndexItem {
  id: string;
  name: string;
  type?: 'react' | 'html';
  icon?: string;
  iconUrl?: string;
  /** 封面背景图（商店卡片背景），mini-app/{id}/cover.jpg */
  coverUrl?: string;
  description?: string;
  md5?: string;
  updatedAt?: string;
  hasIntro?: boolean;
  version?: string;
  tags?: string[];
  mainFile?: string;
  enabledPlugins?: string[];
  enabledWorkflows?: string[];
  /** 外部仓库的安装及详情资源地址 */
  baseUrl?: string;
  storeUrl?: string;
  introUrl?: string;
  hasDevelopment?: boolean;
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
  const hasCover = Boolean(item.coverUrl);

  return (
    <FeatureCard
      color="blue"
      className="cursor-pointer aspect-[16/9]"
      backgroundImage={item.coverUrl ? (/^https?:\/\//.test(item.coverUrl) ? item.coverUrl : resolveStoreUrl(item.coverUrl)) : undefined}
      onClick={() => onOpenDetail(item)}
    >
      {/* Horizontal content: icon + info + action */}
      <div className="flex h-full items-center gap-3 p-3">
        <AgentIcon
          name={item.name}
          avatarUrl={item.iconUrl ? (/^https?:\/\//.test(item.iconUrl) ? item.iconUrl : resolveStoreUrl(item.iconUrl)) : undefined}
          icon={item.icon}
          bordered={false}
          textSize="text-2xl"
          rounded="rounded-xl"
          className="size-14 shrink-0 transition-transform duration-200 group-hover:scale-110"
        />
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
          {/* Name + type chip + installed badge */}
          <div className="flex items-center gap-2 min-w-0">
            <p className={cx('text-sm font-medium truncate', hasCover && 'text-white drop-shadow-[0_1px_2px_rgb(0_0_0/0.6)]')}>{item.name}</p>
            {status === 'installed' && (
              <Chip variant="caption" color="lime" className="shrink-0 gap-1">
                <Check className="size-3" />
                {t('store.installed')}
              </Chip>
            )}
          </div>
          <p className={cx('text-xs line-clamp-1', hasCover ? 'text-white/80 drop-shadow-[0_1px_2px_rgb(0_0_0/0.6)]' : 'text-muted-foreground')}>
            {item.description || '—'}
          </p>
        </div>
        <Button
          variant="default"
          size="sm"
          className="h-7 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail(item);
          }}
        >
          <Eye className="size-3.5 mr-1" />
          {t('store.viewDetail')}
        </Button>
      </div>
    </FeatureCard>
  );
}
