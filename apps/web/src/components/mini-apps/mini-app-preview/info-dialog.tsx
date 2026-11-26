import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { MiniAppProject } from '@flow-spaces/sdk';
import { sdk } from '@/lib/sdk';
import { Chip } from '@/components/base/badges/chip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShareDialog } from '@/components/common/share-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** 应用信息键值行。 */
function InfoRow({ label, value }: { label: string; value?: ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="grid grid-cols-[88px_1fr] gap-2 px-3 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-all">{value}</span>
    </div>
  );
}

/** 应用信息 Dialog（独立弹窗）。传入 shareUrl 时底部展示分享入口。 */
export function MiniAppInfoDialog({ open, onOpenChange, projectId, shareUrl }: { open: boolean; onOpenChange: (o: boolean) => void; projectId: string; shareUrl?: string }) {
  const t = useTranslations('mini-apps');
  const [project, setProject] = useState<MiniAppProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    sdk.miniApp.get(projectId)
      .then((p) => { if (alive) setProject(p); })
      .catch(() => { if (alive) setProject(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open, projectId]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[86vh] min-w-[420px] max-w-md flex-col overflow-hidden p-0">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle>{t('preview.info')}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="min-h-0 flex-1">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t('preview.infoLoading')}
              </div>
            ) : project ? (
              <div className="py-1">
                <InfoRow label={t('preview.infoName')} value={project.name} />
                <InfoRow label={t('preview.infoId')} value={<code className="text-[11px]">{project.id}</code>} />
                <InfoRow label={t('preview.infoVersion')} value={project.version} />
                <InfoRow label={t('preview.infoType')} value={project.type} />
                <InfoRow label={t('preview.infoMainFile')} value={<code className="text-[11px]">{project.mainFile}</code>} />
                <InfoRow label={t('preview.infoDescription')} value={project.description} />
                {project.devices?.length ? (
                  <InfoRow label={t('preview.infoDevices')} value={project.devices.join(', ')} />
                ) : null}
                {project.tags?.length ? (
                  <InfoRow label={t('preview.infoTags')} value={(
                    <span className="flex flex-wrap gap-1">
                      {project.tags.map((tag) => <Chip key={tag} variant="caption" color="neutral">{tag}</Chip>)}
                    </span>
                  )} />
                ) : null}
                {project.enabledPlugins?.length ? (
                  <InfoRow label={t('preview.infoPlugins')} value={project.enabledPlugins.join(', ')} />
                ) : null}
                <InfoRow label={t('preview.infoCreatedAt')} value={new Date(project.createdAt).toLocaleString()} />
                <InfoRow label={t('preview.infoLastLaunchAt')} value={project.lastLaunchAt ? new Date(project.lastLaunchAt).toLocaleString() : '-'} />
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">{t('preview.infoEmpty')}</div>
            )}
          </ScrollArea>
          {shareUrl && (
            <div className="border-t p-3">
              <Button
                variant="outline"
                className="w-full"
                disabled={!project}
                onClick={() => {
                  setShareOpen(true);
                  onOpenChange(false);
                }}
              >
                <Share2 className="size-4" />
                {t('card.share')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {shareUrl && project && (
        <ShareDialog open={shareOpen} onOpenChange={setShareOpen} title={project.name} url={shareUrl} />
      )}
    </>
  );
}