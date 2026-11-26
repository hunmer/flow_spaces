import { Bot, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

interface WorkflowTakeoverOverlayProps {
  /** 服务端下发的接管说明文案（空时显示默认描述） */
  message: string | null;
  /** 取消接管的 POST 请求进行中 */
  canceling: boolean;
  /** 取消接管：POST { enabled: false } 成功后由 hook 关闭占位并触发画布刷新 */
  onCancelTakeover: () => void;
  /** 本地忽略当前这轮接管（新的接管事件会重新弹出） */
  onDismiss: () => void;
}

/**
 * Agent 接管全屏占位：MCP 接管画布期间盖住编辑器（高斯模糊），
 * 用户可选择「取消接管」（服务端关闭）或「忽略」（仅本地隐藏）。
 * 样式对齐 workflow 组件域现有 shadcn 语义 token。
 */
export function WorkflowTakeoverOverlay({
  message,
  canceling,
  onCancelTakeover,
  onDismiss,
}: WorkflowTakeoverOverlayProps) {
  const t = useTranslations('workflows.takeover');

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-background/50 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={t('title')}
    >
      <div className="mx-4 flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-background p-6 text-center shadow-2xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bot className="h-6 w-6" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-base font-semibold text-foreground">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">{message || t('description')}</p>
        </div>
        <div className="flex w-full gap-2">
          <Button variant="default" className="flex-1" onClick={onCancelTakeover} disabled={canceling}>
            {canceling && <Loader2 className="h-4 w-4 animate-spin" />}
            {canceling ? t('canceling') : t('cancel')}
          </Button>
          <Button variant="outline" className="flex-1" onClick={onDismiss} disabled={canceling}>
            {t('ignore')}
          </Button>
        </div>
      </div>
    </div>
  );
}
