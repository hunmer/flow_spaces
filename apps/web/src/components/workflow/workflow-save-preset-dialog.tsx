'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { JsonPreset } from './workflow-properties-utils';
import { JSON_PRESETS_KEY, SELECTED_JSON_PRESET_KEY, isPlainObject } from './workflow-properties-utils';

interface SavePresetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName?: string;
  defaultJson?: string;
  /** Read current node data to get existing presets */
  getNodeData: () => Record<string, unknown>;
  onUpdateData: (key: string, value: unknown) => void;
}

export function SavePresetDialog({
  open,
  onOpenChange,
  defaultName = '',
  defaultJson = '{\n  "data": {},\n  "inputs": {},\n  "outputs": {}\n}',
  getNodeData,
  onUpdateData,
}: SavePresetDialogProps) {
  const [presetName, setPresetName] = useState(defaultName);
  const [presetJson, setPresetJson] = useState(defaultJson);
  const [presetError, setPresetError] = useState('');
  const t = useTranslations('workflows.properties');

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setPresetName(defaultName);
      setPresetJson(defaultJson);
      setPresetError('');
    }
    onOpenChange(next);
  };

  const savePreset = () => {
    const name = presetName.trim();
    if (!name) {
      setPresetError(t('presetNameRequired'));
      return;
    }

    try {
      const parsed = JSON.parse(presetJson) as unknown;
      if (
        !isPlainObject(parsed)
        || !isPlainObject(parsed.data)
        || !isPlainObject(parsed.inputs)
        || (parsed.outputs !== undefined && !isPlainObject(parsed.outputs))
      ) {
        setPresetError(t('presetInvalidFormat'));
        return;
      }

      const data = getNodeData();
      const existingPresets: JsonPreset[] = Array.isArray(data[JSON_PRESETS_KEY])
        ? data[JSON_PRESETS_KEY] as JsonPreset[]
        : [];

      const preset: JsonPreset = {
        id: crypto.randomUUID(),
        name,
        data: parsed.data,
        inputs: parsed.inputs,
        outputs: isPlainObject(parsed.outputs) ? parsed.outputs : {},
      };

      const next = [...existingPresets, preset];
      onUpdateData(JSON_PRESETS_KEY, next);

      if (!data[SELECTED_JSON_PRESET_KEY]) {
        onUpdateData(SELECTED_JSON_PRESET_KEY, preset.id);
      }

      onOpenChange(false);
    } catch {
      setPresetError(t('importInvalidJson'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">{t('savePresetTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">{t('presetNameLabel')}</Label>
            <Input value={presetName} onChange={(e) => setPresetName(e.target.value)} className="h-7 text-xs" placeholder={t('presetNamePlaceholder')} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">JSON</Label>
            <Textarea
              value={presetJson}
              onChange={(e) => setPresetJson(e.target.value)}
              className="min-h-[220px] text-xs font-mono"
              placeholder='{ "data": {}, "inputs": {}, "outputs": {} }'
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') savePreset();
              }}
            />
          </div>
          {presetError && <p className="text-[11px] text-red-500">{presetError}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
          <Button size="sm" className="h-7 text-xs" onClick={savePreset}>{t('save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
