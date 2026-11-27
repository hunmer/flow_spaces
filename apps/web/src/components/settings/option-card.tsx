'use client';

/**
 * 设置面板共享组件：单选卡片（主题 / 语言等设置项共用）。
 */

import {
  CheckIcon,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OptionCardProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  preview?: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
}

/** 单选卡片：主题 / 语言等设置项共用。 */
export function OptionCard({
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
