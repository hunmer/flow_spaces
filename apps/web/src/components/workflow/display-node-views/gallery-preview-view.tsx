'use client';

import { Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { openMediaGallery, type MediaItem } from '@/components/ui/media-gallery';
import { Carousel, CarouselItem } from '@/components/base/carousel/carousel';
import { type DisplayNodeViewProps, galleryItems, EmptyDisplay } from './utils';

export function GalleryPreviewView({ data }: DisplayNodeViewProps) {
  const t = useTranslations('workflows.nodes.gallery_preview');
  const items = galleryItems(data);
  const useCarousel = data.carousel === true;
  const mediaItems: MediaItem[] = items.map(item => ({
    src: item.src,
    thumb: item.thumb,
    type: item.type,
    alt: item.caption || item.src,
  }));

  if (items.length === 0) {
    return <EmptyDisplay icon={<Play className="h-5 w-5" />} text={t('empty')} />;
  }

  const renderItem = (item: typeof items[number], index: number, isLast = false) => {
    const imgSrc = item.thumb || item.src;
    const isBase64 = imgSrc.startsWith('data:');
    const alt = isBase64 ? '' : (item.caption || imgSrc);
    return (
      <button
        key={item.id || `${item.src}-${index}`}
        type="button"
        onDoubleClick={(e) => {
          e.stopPropagation();
          openMediaGallery(mediaItems, index);
        }}
        className="relative h-full min-h-0 min-w-0 overflow-hidden rounded border border-border bg-muted transition-opacity hover:opacity-80"
        title={item.caption || ''}
      >
        {item.type === 'video' ? (
          <span className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Play className="h-5 w-5" />
          </span>
        ) : (
          <img
            src={imgSrc}
            alt={alt}
            draggable={false}
            className="h-full w-full object-cover"
          />
        )}
        {isLast ? (
          <span className="absolute inset-0 flex items-center justify-center bg-background/80 text-xs font-medium">
            +{items.length - 6}
          </span>
        ) : null}
      </button>
    );
  };

  if (useCarousel) {
    return (
      <div className="nodrag nopan relative flex h-full w-full items-center overflow-hidden">
        {/* base/carousel：原生 scroll-snap 轮播，箭头与圆点为 base 内建（替代旧 embla 版悬浮按钮）。
            opts.loop 无 base 对应（原生滚动不循环）；gap 对应旧 CarouselItem 的 pl-2 间距。
            nth-child(2) 布局类让 track 在节点预览的受限高度内撑满剩余空间。 */}
        <Carousel
          aria-label="Gallery"
          gap={8}
          className="h-full min-h-0 w-full [&>*:nth-child(2)]:min-h-0 [&>*:nth-child(2)]:flex-1"
        >
          {items.map((item, index) => (
            <CarouselItem key={item.id || `${item.src}-${index}`}>
              <div className="h-full w-full">{renderItem(item, index)}</div>
            </CarouselItem>
          ))}
        </Carousel>
      </div>
    );
  }

  const visible = items.slice(0, 6);
  const cols = Math.min(items.length, 3);
  const rows = Math.ceil(visible.length / cols);

  return (
    <div
      className="nodrag nopan grid h-full w-full gap-1 overflow-hidden rounded-lg bg-background p-1"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
    >
      {visible.map((item, index) => {
        const last = index === visible.length - 1 && items.length > visible.length;
        return renderItem(item, index, last);
      })}
    </div>
  );
}
