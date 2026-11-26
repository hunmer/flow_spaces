'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Download, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

/** 工作流商店索引条目（workflows/index.json） */
export interface WorkflowIndexItem {
  id: string;
  name: string;
  description: string;
  filename: string;
  category: string;
  nodeCount: number;
}

interface WorkflowTemplateCardProps {
  template: WorkflowIndexItem;
  /** 该模板已导入过（本地存在同名工作流）：按钮显示「更新」 */
  installed?: boolean;
  /** 该卡片正在导入（显示 spinner） */
  importing?: boolean;
  /** 任一导入进行中时禁用所有导入按钮 */
  disabled?: boolean;
  onImport: (template: WorkflowIndexItem) => void;
}

/** 商店模式下的模板卡片：复用 WorkflowCard 的卡片结构与栅格布局展示商店模板 */
export function WorkflowTemplateCard({ template, installed, importing, disabled, onImport }: WorkflowTemplateCardProps) {
  const t = useTranslations('workflows');

  return (
    <Card className="group overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded bg-primary/10 text-xs font-bold flex items-center justify-center text-primary shrink-0">
            {template.name.charAt(0).toUpperCase()}
          </span>
          <CardTitle className="text-sm truncate min-w-0 flex-1">{template.name}</CardTitle>
          {template.category && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium shrink-0">
              {template.category}
            </span>
          )}
        </div>
        {/* Always render description row for consistent height（与 WorkflowCard 一致） */}
        <CardDescription className="text-xs line-clamp-2">
          {template.description || '\u00A0'}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted-foreground">
            {t('card.nodes', { count: template.nodeCount })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 gap-1"
            disabled={disabled || importing}
            onClick={() => onImport(template)}
          >
            {importing ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <>
                {installed ? <RefreshCw className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                {installed ? t('templates.update') : t('templates.import')}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
