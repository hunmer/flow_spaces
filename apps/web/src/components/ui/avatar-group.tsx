'use client';
import { useState, useEffect, useRef } from 'react';

// Mini App 运行时兼容层：存量 Mini App 经 @flow-spaces/ui / window.FlowSpacesUI
// 消费此组件的旧 API 表面（lib/ui-exports.ts 再导出）。
// 业务代码请改用 @/components/base/*；此文件仅为 Mini App 平台契约保留。
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Avatar {
  imageUrl: string;
  name: string;
  avatarNode?: ReactNode;
}

type AvatarSize = 'sm' | 'md';

const sizeMap: Record<AvatarSize, { avatar: string; text: string; space: string; border: string; nameText: string; hoverPad: string }> = {
  sm: {
    avatar: 'h-5 w-5',
    text: 'text-[10px] font-medium',
    space: '-space-x-2',
    border: 'border',
    nameText: 'text-xs',
    hoverPad: 'pr-3 pl-1 py-1',
  },
  md: {
    avatar: 'h-10 w-10',
    text: 'text-sm font-medium',
    space: '-space-x-4',
    border: 'border-2',
    nameText: 'text-sm',
    hoverPad: 'pr-6 pl-2 py-2',
  },
};

interface AvatarGroupProps {
  className?: string;
  avatarUrls: Avatar[];
  size?: AvatarSize;
  /** hover 某个 avatar 时渲染的悬浮卡片；提供后不再展开默认名称 */
  renderHoverCard?: (index: number) => ReactNode;
  /**
   * Mini App 兼容：传入 <Avatar/> 子元素时按子元素渲染（忽略 avatarUrls）。
   * 旧 shadcn 用法为 <AvatarGroup><Avatar>…</Avatar></AvatarGroup>。
   */
  children?: ReactNode;
}

const AvatarGroup = ({ className, avatarUrls = [], size = 'md', renderHoverCard, children }: AvatarGroupProps) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const s = sizeMap[size];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setHoveredIndex(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const handleInteraction = (
    index: number,
    e: React.MouseEvent | React.TouchEvent,
  ) => {
    e.preventDefault();
    setHoveredIndex(hoveredIndex === index ? null : index);
  };

  return (
    <div
      ref={containerRef}
      className={cn('z-10 flex rtl:space-x-reverse', s.space, className)}
    >
      {children
        ? children
        : avatarUrls.map((avatar, index) => {
        const isHovered = hoveredIndex === index;
        const showName = isHovered && !renderHoverCard;

        return (
          <div
            key={index}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            onTouchEnd={(e) => handleInteraction(index, e)}
            onClick={(e) => handleInteraction(index, e)}
            className={cn(
              'relative flex items-center gap-0 rounded-full cursor-pointer touch-none',
              'transition-all duration-500 ease-out',
              'hover:z-10',
              showName ? s.hoverPad : 'p-0.5',
            )}
          >
            <div className='relative shrink-0'>
              {avatar.avatarNode ? (
                avatar.avatarNode
              ) : avatar.imageUrl ? (
                <img
                  src={avatar.imageUrl}
                  alt={avatar.name}
                  className={cn(
                    s.avatar,
                    'rounded-full object-cover border-white dark:border-gray-800',
                    s.border,
                    'transition-all duration-500 ease-out',
                    'hover:scale-105',
                  )}
                />
              ) : (
                <div className={cn(
                  s.avatar,
                  'rounded-full border-white dark:border-gray-800',
                  s.border,
                  'flex items-center justify-center bg-avatar-neutral-background text-text-secondary',
                  s.text,
                )}>
                  {avatar.name.charAt(0).toUpperCase()}
                </div>
              )}
              {renderHoverCard && isHovered && (
                <div className="absolute left-0 top-full z-50 pt-1">
                  {renderHoverCard(index)}
                </div>
              )}
            </div>

            <div
              className={cn(
                'grid transition-all duration-500 ease-out',
                showName
                  ? 'grid-cols-[1fr] opacity-100 ml-2'
                  : 'grid-cols-[0fr] opacity-0 ml-0',
              )}
            >
              <div className='overflow-hidden'>
                <span
                  className={cn(
                    s.nameText,
                    'font-medium whitespace-nowrap block',
                    'transition-colors duration-300 text-foreground',
                  )}
                >
                  {avatar.name}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export { AvatarGroup };
