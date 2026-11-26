'use client';

import { useTranslations } from 'next-intl';
import { Markdown } from '@/components/ui/markdown';

interface MarkdownNodeViewProps {
  nodeId: string;
  data: Record<string, unknown>;
}

export function MarkdownNodeView({ data }: MarkdownNodeViewProps) {
  const t = useTranslations('workflows.nodes.markdown');
  const content = typeof data.content === 'string' ? data.content : '';

  return (
    <div
      className="nodrag nopan h-full w-full overflow-auto rounded-md border border-border/60 bg-card/80 p-3 text-sm leading-relaxed shadow-sm"
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {content.trim() ? (
        <Markdown content={content} />
      ) : (
        <p className="text-sm text-muted-foreground/50">{t('placeholder')}</p>
      )}
    </div>
  );
}
