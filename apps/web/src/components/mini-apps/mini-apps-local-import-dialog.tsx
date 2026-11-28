'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { RiFolderAddLine } from '@remixicon/react';
import { sdk } from '@/lib/sdk';
import { getApiErrorStatus, readApiErrorMessage } from '@/lib/api-error';
import { Button } from '@/components/base/buttons/button';
import { FolderPicker } from '@/components/ui/folder-picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void | Promise<void>;
}

export function MiniAppLocalImportDialog({ open, onOpenChange, onImported }: Props) {
  const t = useTranslations('mini-apps');
  const [path, setPath] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const handleOpenChange = (next: boolean) => {
    if (adding) return;
    setError('');
    onOpenChange(next);
  };
  const handleAdd = async () => {
    if (!path.trim() || adding) return;
    setAdding(true);
    setError('');
    try {
      await sdk.miniApp.addLocal(path.trim());
      await onImported();
      onOpenChange(false);
    } catch (err) {
      console.error('[MiniAppLocalImport] Failed to add local app', { path: path.trim(), error: err });
      setError(getApiErrorStatus(err) === 409
        ? t('localImport.duplicate')
        : t('localImport.failed', { reason: readApiErrorMessage(err) }));
    } finally {
      setAdding(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('localImport.title')}</DialogTitle>
          <DialogDescription>{t('localImport.description')}</DialogDescription>
        </DialogHeader>
        <FolderPicker value={path} onChange={value => { setPath(value); setError(''); }} />
        {error && <p role="alert" className="text-body-regular text-text-error-primary">{error}</p>}
        <DialogFooter>
          <Button variant="secondary" disabled={adding} onClick={() => handleOpenChange(false)}>{t('localImport.cancel')}</Button>
          <Button leadingIcon={RiFolderAddLine} disabled={adding || !path.trim()} onClick={handleAdd}>
            {t(adding ? 'localImport.adding' : 'localImport.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
