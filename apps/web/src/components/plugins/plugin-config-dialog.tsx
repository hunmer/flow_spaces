'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PluginConfigField } from '@flow-spaces/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { pluginApi, pluginConfigSchemeApi, workflowPluginSchemeApi } from '@/lib/workflow-plugin-api';
import { loadPluginConfigValues } from './plugin-config-loader';

export function PluginConfigDialog({
  open,
  onOpenChange,
  pluginId,
  pluginName,
  config,
  schemeName,
  legacyWorkflowId,
  loadValues,
  saveValues,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pluginId: string | null;
  pluginName: string;
  config: PluginConfigField[];
  schemeName?: string;
  legacyWorkflowId?: string;
  loadValues?: () => Promise<Record<string, string>>;
  saveValues?: (values: Record<string, string>) => Promise<void>;
}) {
  const t = useTranslations('settings');
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !pluginId) return;
    setError('');
    const load = async () => {
      try {
        setValues(loadValues
          ? await loadValues()
          : await loadPluginConfigValues({
            schemeName,
            legacyWorkflowId,
            readScheme: () => pluginConfigSchemeApi.read(pluginId, schemeName!),
            readLegacyScheme: () => workflowPluginSchemeApi.read(legacyWorkflowId!, pluginId, schemeName!),
            saveScheme: values => pluginConfigSchemeApi.save(pluginId, schemeName!, values),
            readDefault: () => pluginApi.getConfig(pluginId),
          }));
      } catch (err) {
        setValues({});
        setError(err instanceof Error ? err.message : t('pluginConfig.loadFailed'));
      }
    };
    void load();
  }, [legacyWorkflowId, loadValues, open, pluginId, schemeName]);

  function setField(key: string, value: string) {
    setValues(prev => ({ ...prev, [key]: value }));
  }

  function validate(): string | null {
    for (const field of config) {
      if (field.type === 'object' && values[field.key]?.trim()) {
        try {
          JSON.parse(values[field.key]);
        } catch {
          return t('pluginConfig.invalidJson', { label: field.label });
        }
      }
      if (field.required && !values[field.key]?.trim()) return t('pluginConfig.requiredField', { label: field.label });
    }
    return null;
  }

  async function save() {
    if (!pluginId) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (saveValues) {
        await saveValues(values);
      } else if (schemeName) {
        await pluginConfigSchemeApi.save(pluginId, schemeName, values);
      } else {
        const result = await pluginApi.saveConfig(pluginId, values);
        if (!result.success) {
          setError(result.error || t('pluginConfig.saveFailed'));
          return;
        }
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pluginConfig.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            {t('pluginConfig.title', { name: pluginName })}{schemeName ? ` (${schemeName})` : ''}
          </DialogTitle>
          <DialogDescription>{t('pluginConfig.description')}</DialogDescription>
        </DialogHeader>

        {error && <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

        <div className="space-y-4">
          {config.map(field => (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={`plugin-config-${field.key}`} className="text-xs">
                {field.label}{field.required && <span className="text-destructive"> *</span>}
              </Label>
              {(field.type === 'string' || field.type === 'number') && (
                <Input
                  id={`plugin-config-${field.key}`}
                  type={field.type === 'number' ? 'number' : 'text'}
                  value={values[field.key] ?? ''}
                  placeholder={field.placeholder}
                  onChange={(event) => setField(field.key, event.target.value)}
                />
              )}
              {field.type === 'boolean' && (
                <div className="flex h-9 items-center gap-2">
                  <Switch
                    id={`plugin-config-${field.key}`}
                    checked={values[field.key] === 'true'}
                    onCheckedChange={(checked) => setField(field.key, checked ? 'true' : 'false')}
                  />
                  <span className="text-sm text-muted-foreground">{values[field.key] === 'true' ? t('pluginConfig.on') : t('pluginConfig.off')}</span>
                </div>
              )}
              {field.type === 'select' && (
                <Select value={values[field.key] ?? ''} onValueChange={(value) => setField(field.key, value ?? '')}>
                  <SelectTrigger id={`plugin-config-${field.key}`}>
                    <SelectValue placeholder={t('pluginConfig.selectPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(field.options || []).map(option => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {field.type === 'object' && (
                <Textarea
                  id={`plugin-config-${field.key}`}
                  value={values[field.key] ?? ''}
                  placeholder={field.placeholder || '{}'}
                  rows={4}
                  className="font-mono text-xs"
                  onChange={(event) => setField(field.key, event.target.value)}
                />
              )}
              {field.desc && <p className="text-[11px] text-muted-foreground">{field.desc}</p>}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
          <Button onClick={save} disabled={saving || !pluginId}>{saving ? t('pluginConfig.saving') : t('save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}