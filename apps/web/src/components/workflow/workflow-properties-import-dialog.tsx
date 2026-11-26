'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toOutputFields } from './workflow-properties-utils';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (outputs: unknown) => void;
}

export function ImportDialog({ open, onOpenChange, onImport }: ImportDialogProps) {
  const [json, setJson] = useState('');
  const [error, setError] = useState('');
  const t = useTranslations('workflows.properties');

  const handleImport = () => {
    setError('');
    try {
      const parsed = JSON.parse(json) as unknown;
      onImport(toOutputFields(parsed));
      onOpenChange(false);
      setJson('');
    } catch {
      setError(t('importInvalidJson'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">{t('importDialogTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">{t('importHint')}</p>
          <Textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            placeholder='{"key1": "value1", "key2": 123}'
            className="min-h-[160px] text-xs font-mono"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleImport();
            }}
          />
          {error && <p className="text-[11px] text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
          <Button size="sm" className="h-7 text-xs" disabled={!json.trim()} onClick={handleImport}>{t('importConfirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
