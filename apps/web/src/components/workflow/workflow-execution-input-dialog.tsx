'use client';

import { useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import type { OutputField } from '@flow-spaces/shared';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { cx } from '@/utils/cx';
import { Button } from '@/components/ui/button';
import { formatFileSize } from '@/components/base/file-upload/file-upload';
import { RiCloseLine, RiFileTextLine, RiUploadCloud2Line } from '@remixicon/react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { sdk } from '@/lib/sdk';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Play } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  isArrayOutputFieldType,
  isFileOutputFieldType,
  isStructuredOutputFieldType,
  stringifyOutputFieldValue,
} from './workflow-properties-utils';

// 受控文件条目（旧 ui/file-upload 的 FileUploadFile 最小等价物；base 版无此导出，
// 按 MIGRATION-BOARDUI.md 第 9 节内联）。file 为新选的本地 File 或从保存值恢复的 WorkflowFileInput。
type WorkflowUploadFile = { id: string; file: File | WorkflowFileInput; preview?: string };
type InputFormValue = string | WorkflowUploadFile[];

export function parseInputValue(field: OutputField, raw: string): unknown {
  if (field.type === 'file' || field.type === 'file[]') return field.type === 'file[]' ? [] : null;
  if (field.type === 'number') return raw === '' ? 0 : Number(raw);
  if (field.type === 'boolean') return raw === 'true';
  if (isStructuredOutputFieldType(field.type) || field.type === 'any' || isArrayOutputFieldType(field.type)) {
    if (!raw.trim()) return field.type === 'object' ? {} : isArrayOutputFieldType(field.type) ? [] : '';
    try {
      const parsed = JSON.parse(raw);
      return isArrayOutputFieldType(field.type) && !Array.isArray(parsed) ? raw : parsed;
    } catch {
      if (isStructuredOutputFieldType(field.type) || isArrayOutputFieldType(field.type)) {
        try {
          const parsed = JSON.parse(raw.replace(/，/g, ','));
          return isArrayOutputFieldType(field.type) && !Array.isArray(parsed) ? raw : parsed;
        } catch {
          return raw;
        }
      }
      return raw;
    }
  }
  return raw;
}

export interface ExecutionInputFormProps {
  fields: OutputField[];
  onSubmit: (values: Record<string, unknown>) => void | Promise<void>;
  submitLabel?: React.ReactNode;
  initialValues?: Record<string, string>;
  disabled?: boolean;
  footer?: (submit: () => void) => React.ReactNode;
}

export function ExecutionInputForm({ fields, onSubmit, submitLabel, initialValues, disabled, footer }: ExecutionInputFormProps) {
  const form = useExecutionInputFormState(fields, initialValues);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    if (isSubmitting || disabled) return;
    if (!form.validate()) return;
    setIsSubmitting(true);
    try {
      await onSubmit(await form.parse());
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <ScrollArea className="min-h-0 flex-1 pr-2">
        <ExecutionInputFields fields={fields} form={form} disabled={disabled} />
      </ScrollArea>
      {footer ? footer(submit) : submitLabel ? (
        <DialogFooter>
          <Button size="sm" onClick={submit} disabled={isSubmitting || disabled}>
            {submitLabel}
          </Button>
        </DialogFooter>
      ) : null}
    </>
  );
}

function useExecutionInputFormState(fields: OutputField[], initialValues?: Record<string, string>) {
  const [values, setValues] = useState<Record<string, InputFormValue>>(() => {
    if (!initialValues) return {};
    const map: Record<string, InputFormValue> = {};
    for (const field of fields) {
      if (!field.key) continue;
      const init = initialValues[field.key];
      if (init === undefined) continue;
      map[field.key] = isFileOutputFieldType(field.type)
        ? restoreFileFieldValue(init, field.type === 'file[]')
        : init;
    }
    return map;
  });

  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const setField = (key: string, value: InputFormValue) => {
    setValues(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: false }));
  };

  const validate = (): boolean => {
    const next: Record<string, boolean> = {};
    for (const field of fields) {
      if (!field.key || !field.required) continue;
      const val = values[field.key];
      const empty = isFileOutputFieldType(field.type)
        ? !Array.isArray(val) || val.length === 0
        : getStringValue(val, field.value).trim() === '';
      if (empty) next[field.key] = true;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const parse = async () => parseInputFormValues(fields, values);

  return { values, setField, parse, validate, errors };
}

function ExecutionInputFields({
  fields,
  form,
  disabled,
}: {
  fields: OutputField[];
  form: ReturnType<typeof useExecutionInputFormState>;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3 py-1 m-1">
      {fields.map(field => {
        const hasError = !!form.errors[field.key];
        return (
          <label key={field.key} className="block space-y-1.5">
            <span className="text-xs font-medium">
              {field.required && <span className="text-destructive mr-0.5">*</span>}
              {field.key}
              <span className="text-muted-foreground font-normal ml-1">({field.type})</span>
            </span>
            {field.description && (
              <span className="block text-[10px] text-muted-foreground">{field.description}</span>
            )}
            {isFileOutputFieldType(field.type) ? (
              <WorkflowFileUpload
                value={getFileValue(form.values[field.key])}
                onChange={(files) => form.setField(field.key, files)}
                maxFiles={field.type === 'file[]' ? undefined : 1}
                fileNameFilter={field.fileNameFilter}
                disabled={disabled}
                placeholder={field.key}
                invalid={hasError}
              />
            ) : field.inputMode === 'native' && field.type === 'select' ? (
              <Select
                value={getSelectValue(form.values[field.key], field.value)}
                onValueChange={value => value != null && form.setField(field.key, value)}
                disabled={disabled}
              >
                <SelectTrigger className={cn('h-8 text-xs w-full', hasError && 'border-destructive')}>
                  <SelectValue placeholder={field.key} />
                </SelectTrigger>
                <SelectContent>
                  {getSelectOptions(field.options).map(option => (
                    <SelectItem key={option} value={option} className="text-xs">
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : field.type === 'boolean' ? (
              <div className="flex items-center gap-2 h-8">
                <Switch
                  size="sm"
                  checked={getBooleanValue(form.values[field.key], field.value)}
                  onCheckedChange={checked => form.setField(field.key, String(checked))}
                  isDisabled={disabled}
                />
                <span className="text-xs text-muted-foreground">
                  {getBooleanValue(form.values[field.key], field.value) ? 'true' : 'false'}
                </span>
              </div>
            ) : (
              <Input
                className={cn('h-8 text-xs', hasError && 'border-destructive')}
                type={field.type === 'number' ? 'number' : 'text'}
                placeholder={field.key}
                value={getStringValue(form.values[field.key], field.value)}
                onChange={event => form.setField(field.key, event.target.value)}
                disabled={disabled}
              />
            )}
            {hasError && (
              <span className="text-[10px] text-destructive">This field is required</span>
            )}
          </label>
        );
      })}
    </div>
  );
}

// —— file / file[] 字段的受控文件上传区（替代旧 ui/file-upload）——

let uploadFileId = 0;

/** fileNameFilter 匹配：逗号分隔模式，"." 前缀按扩展名后缀、含 * / ? 按 glob、否则按子串。 */
function matchesFileNameFilter(fileName: string, filter: string): boolean {
  const name = fileName.toLowerCase();
  const patterns = filter.split(',').map((pattern) => pattern.trim().toLowerCase()).filter(Boolean);
  if (patterns.length === 0) return true;
  return patterns.some((pattern) => {
    if (pattern.startsWith('.')) return name.endsWith(pattern);
    if (pattern.includes('*') || pattern.includes('?')) return globToRegExp(pattern).test(name);
    return name.includes(pattern);
  });
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/\\\*/g, '.*').replace(/\\\?/g, '.')}$`);
}

/** 提取 fileNameFilter 中确定的扩展名（作为 input accept 的预过滤；通配模式返回空）。 */
function fileNameFilterExtensions(filter?: string): string[] {
  if (!filter?.trim()) return [];
  const extensions = filter
    .split(',')
    .map((pattern) => pattern.trim().toLowerCase())
    .map((pattern) => {
      const match = pattern.match(/(\.[a-z0-9][a-z0-9_-]*)$/);
      if (!match) return null;
      return pattern.slice(0, -match[1].length).includes('?') ? null : match[1];
    })
    .filter((extension): extension is string => Boolean(extension));
  return Array.from(new Set(extensions));
}

/** 文件行缩略图：本地图片用 blob 预览，恢复的图片条目用其远端地址，非图片无缩略。 */
function uploadItemThumb(item: WorkflowUploadFile): string | undefined {
  const file = item.file;
  if (!file.type.startsWith('image/')) return undefined;
  return file instanceof File ? item.preview : (file.url ?? file.httpPath);
}

/**
 * base/file-upload 为非受控单文件模拟上传组件（强制扩展名白名单、动画结束才回调），
 * 缺少受控 value/onChange、多文件、fileNameFilter 与任意类型支持，
 * 按 MIGRATION-BOARDUI.md 第 9 节以内联最小逻辑补齐；文件大小展示复用 base 的 formatFileSize。
 */
function WorkflowFileUpload({ value, onChange, maxFiles, fileNameFilter, disabled, placeholder, invalid }: {
  value: WorkflowUploadFile[];
  onChange: (files: WorkflowUploadFile[]) => void;
  maxFiles?: number;
  fileNameFilter?: string;
  disabled?: boolean;
  placeholder?: string;
  invalid?: boolean;
}) {
  const t = useTranslations('common');
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);
  const accept = fileNameFilterExtensions(fileNameFilter).join(',') || undefined;

  const addFiles = (incoming: File[]) => {
    if (incoming.length === 0) return;
    let allowed = incoming;
    if (fileNameFilter?.trim()) {
      allowed = incoming.filter((file) => matchesFileNameFilter(file.name, fileNameFilter));
      setDragError(allowed.length < incoming.length
        ? `File name does not match filter: ${fileNameFilter}`
        : null);
    }
    if (allowed.length === 0) return;

    const newItems = allowed.map((file) => {
      const item: WorkflowUploadFile = { id: `upload-${++uploadFileId}`, file };
      if (file.type.startsWith('image/')) item.preview = URL.createObjectURL(file);
      return item;
    });
    const limit = maxFiles ?? 0;
    const next = limit > 0 ? [...value, ...newItems].slice(0, limit) : [...value, ...newItems];
    // 被上限截断而未入列的项，回收其 blob 预览
    const kept = new Set(next.map((item) => item.id));
    for (const item of newItems) {
      if (!kept.has(item.id) && item.preview) URL.revokeObjectURL(item.preview);
    }
    onChange(next);
  };

  const removeFile = (id: string) => {
    const target = value.find((item) => item.id === id);
    if (target?.preview?.startsWith('blob:')) URL.revokeObjectURL(target.preview);
    onChange(value.filter((item) => item.id !== id));
  };

  const acceptFiles = (list: FileList | null) => addFiles(Array.from(list ?? []));

  const dropZoneProps = {
    role: 'button' as const,
    tabIndex: disabled ? -1 : 0,
    onClick: () => { if (!disabled) inputRef.current?.click(); },
    onKeyDown: (e: KeyboardEvent) => {
      if (disabled || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      inputRef.current?.click();
    },
    onDragOver: (e: DragEvent) => { e.preventDefault(); if (!disabled) setDragOver(true); },
    onDragLeave: () => setDragOver(false),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (!disabled) acceptFiles(e.dataTransfer.files);
    },
  };

  const zoneStateClass = cx(
    dragOver
      ? 'border-border-button-active bg-accent-500/5'
      : 'border-border-button-default hover:border-border-button-active',
    invalid && !dragOver && 'border-border-error-default',
    disabled && 'pointer-events-none opacity-50',
  );

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => { acceptFiles(e.target.files); e.target.value = ''; }}
      />
      {value.length === 0 ? (
        <div
          {...dropZoneProps}
          aria-label={placeholder ?? t('dragOrClickToSelect')}
          className={cx(
            'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring',
            zoneStateClass,
          )}
        >
          <RiUploadCloud2Line className="size-8 text-foreground-icon-secondary" aria-hidden />
          <p className="text-body-medium">{dragOver ? t('releaseToUpload') : (placeholder ?? t('dragOrClickToSelect'))}</p>
          {!dragOver && <p className="text-body-2-regular text-text-secondary">{t('multiFileHint')}</p>}
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {value.map((item) => {
              const thumb = uploadItemThumb(item);
              return (
                <li
                  key={item.id}
                  className={cx(
                    'flex items-center gap-3 rounded-lg border bg-background-primary-default px-3 py-2',
                    invalid ? 'border-border-error-default' : 'border-border-button-default',
                  )}
                >
                  {thumb ? (
                    <img src={thumb} alt="" draggable={false} className="size-10 shrink-0 rounded-md object-cover" />
                  ) : (
                    <RiFileTextLine className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
                  )}
                  <span className="w-0 flex-1 truncate text-body-2-regular">{item.file.name}</span>
                  <span className="shrink-0 text-caption-1-medium text-text-secondary">{formatFileSize(item.file.size)}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeFile(item.id); }}
                    aria-label={t('deleteFileName', { name: item.file.name })}
                    className="flex size-6 shrink-0 items-center justify-center rounded-md outline-none transition-colors hover:bg-background-secondary-default-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                  >
                    <RiCloseLine className="size-3.5 text-foreground-icon-secondary" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
          <div
            {...dropZoneProps}
            aria-label={t('addFile')}
            className={cx(
              'flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-3 py-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring',
              zoneStateClass,
            )}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background-secondary-default">
              <RiUploadCloud2Line className="size-4 text-foreground-icon-secondary" aria-hidden />
            </span>
            <span className="w-0 flex-1">
              <span className="block truncate text-caption-1-medium">{dragOver ? t('releaseToUpload') : t('addFile')}</span>
              {placeholder && <span className="block truncate text-caption-1-medium text-text-secondary">{placeholder}</span>}
            </span>
          </div>
        </>
      )}
      {dragError && <p className="text-body-2-regular text-text-error-primary">{dragError}</p>}
    </div>
  );
}

function getSelectOptions(options: OutputField['options']) {
  return Array.isArray(options) ? options : [];
}

function getSelectValue(value: InputFormValue | undefined, fallback?: unknown): string | undefined {
  const selected = getStringValue(value, fallback);
  return selected || undefined;
}

async function parseInputFormValues(fields: OutputField[], values: Record<string, InputFormValue>) {
  const parsed: Record<string, unknown> = {};
  for (const field of fields) {
    if (!field.key) continue;
    if (isFileOutputFieldType(field.type)) {
      const files = values[field.key];
      parsed[field.key] = Array.isArray(files)
        ? field.type === 'file[]'
          ? await Promise.all(files.map(file => resolveWorkflowFileInput(file.file)))
          : await resolveWorkflowFileInput(files[0]?.file)
        : field.type === 'file[]' ? [] : null;
      continue;
    }
    parsed[field.key] = parseInputValue(field, getStringValue(values[field.key], field.value));
  }
  return parsed;
}

function getStringValue(value: InputFormValue | undefined, fallback?: unknown): string {
  return typeof value === 'string' ? value : stringifyOutputFieldValue(fallback);
}

function getBooleanValue(value: InputFormValue | undefined, fallback?: unknown): boolean {
  const str = getStringValue(value, fallback);
  return str === 'true';
}

function getFileValue(value: InputFormValue | undefined): WorkflowUploadFile[] {
  return Array.isArray(value) ? value : [];
}

function restoreFileFieldValue(saved: string, isArray: boolean): WorkflowUploadFile[] {
  try {
    const parsed = JSON.parse(saved);
    if (isArray) {
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isWorkflowFileInput).map((file: WorkflowFileInput, i: number) => ({ id: `restored-${i}`, file }));
    }
    if (!isWorkflowFileInput(parsed)) return [];
    return [{ id: 'restored-0', file: parsed }];
  } catch {
    return [];
  }
}

type WorkflowFileInput = {
  path: string;
  relativePath: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  httpPath?: string;
};

type UploadedWorkflowFile = {
  name: string;
  path: string;
  size: number;
  type: string;
  url: string;
  httpPath?: string;
};

function isWorkflowFileInput(value: unknown): value is WorkflowFileInput {
  if (!value || typeof value !== 'object') return false;
  const file = value as Partial<WorkflowFileInput>;
  return typeof file.name === 'string'
    && typeof file.path === 'string'
    && typeof file.size === 'number'
    && typeof file.type === 'string';
}

async function resolveWorkflowFileInput(file?: File | WorkflowFileInput): Promise<WorkflowFileInput | null> {
  if (!file) return null;
  if (!(file instanceof File)) return file;

  const relativePath = getFileRelativePath(file);
  const localPath = getElectronFilePath(file);
  if (isElectronEnvironment() && localPath) {
    return {
      path: localPath,
      relativePath,
      name: file.name,
      size: file.size,
      type: file.type,
    };
  }

  const formData = new FormData();
  formData.append('file', file);
  const uploaded = await sdk.http.upload<UploadedWorkflowFile>('/api/upload', formData);

  return {
    path: uploaded.path,
    relativePath,
    name: uploaded.name || file.name,
    size: uploaded.size || file.size,
    type: uploaded.type || file.type,
    url: uploaded.url,
    httpPath: uploaded.httpPath,
  };
}

function getFileRelativePath(file: File): string {
  const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  return relativePath || file.name;
}

function getElectronFilePath(file: File): string | null {
  const path = (file as File & { path?: string }).path;
  return typeof path === 'string' && path.trim() ? path : null;
}

function isElectronEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const maybeWindow = window as Window & {
    electron?: unknown;
    electronAPI?: { isElectron?: boolean };
    require?: unknown;
  };
  if (maybeWindow.electronAPI?.isElectron === true) return true;
  const userAgent = navigator.userAgent.toLowerCase();
  return Boolean(maybeWindow.electron || maybeWindow.electronAPI || userAgent.includes('electron'));
}

function getStorageKey(workflowId: string, startNodeLabel: string) {
  return `flow-spaces:workflow-input:${workflowId}:${startNodeLabel}`;
}

function loadSavedValues(workflowId: string, startNodeLabel: string): Record<string, string> | undefined {
  try {
    const raw = localStorage.getItem(getStorageKey(workflowId, startNodeLabel));
    return raw ? JSON.parse(raw) : undefined;
  } catch { return undefined; }
}

function saveValues(workflowId: string, startNodeLabel: string, values: Record<string, unknown>) {
  const stringified: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    if (v != null) stringified[k] = typeof v === 'string' ? v : JSON.stringify(v);
  }
  localStorage.setItem(getStorageKey(workflowId, startNodeLabel), JSON.stringify(stringified));
}

export function ExecutionInputDialog({
  open, fields, variableFields = [], startNodeLabel, onOpenChange, onSubmit, workflowId, restoreSavedValues = true,
  initialInputValues, initialEnvValues,
}: {
  open: boolean;
  fields: OutputField[];
  variableFields?: OutputField[];
  startNodeLabel: string;
  workflowId?: string | null;
  restoreSavedValues?: boolean;
  initialInputValues?: Record<string, string>;
  initialEnvValues?: Record<string, string>;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: Record<string, unknown>, env?: Record<string, unknown>) => void | Promise<void>;
}) {
  const t = useTranslations('workflows');
  const savedValues = restoreSavedValues && workflowId ? loadSavedValues(workflowId, startNodeLabel) : undefined;
  const savedEnvValues = restoreSavedValues && workflowId ? loadSavedValues(workflowId, `${startNodeLabel}:__env__`) : undefined;
  const effectiveInputValues = initialInputValues ?? savedValues;
  const effectiveEnvValues = initialEnvValues ?? savedEnvValues;
  const hasInputFields = fields.length > 0;
  const hasVariableFields = variableFields.length > 0;
  const formKey = useMemo(
    () => `${workflowId ?? 'workflow'}:${startNodeLabel}:${restoreSavedValues ? 'saved' : 'fresh'}:${open ? 'open' : 'closed'}`,
    [open, restoreSavedValues, startNodeLabel, workflowId],
  );
  const submit = async (values: Record<string, unknown>, env?: Record<string, unknown>) => {
    if (workflowId) {
      saveValues(workflowId, startNodeLabel, values);
      if (env) saveValues(workflowId, `${startNodeLabel}:__env__`, env);
    }
    await onSubmit(values, env);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm">{startNodeLabel}</DialogTitle>
        </DialogHeader>
        {hasInputFields && !hasVariableFields ? (
          <ExecutionInputForm
            key={formKey}
            fields={fields}
            initialValues={effectiveInputValues}
            onSubmit={(values) => submit(values)}
            submitLabel={<><Play className="h-3 w-3 mr-1" /> {t('execution.startExecution')}</>}
          />
        ) : hasVariableFields && !hasInputFields ? (
          <ExecutionInputForm
            key={formKey}
            fields={variableFields}
            initialValues={effectiveEnvValues}
            onSubmit={(env) => submit({}, env)}
            submitLabel={<><Play className="h-3 w-3 mr-1" /> {t('execution.startExecution')}</>}
          />
        ) : (
          <CombinedExecutionInputForm
            key={formKey}
            fields={fields}
            variableFields={variableFields}
            initialValues={effectiveInputValues}
            initialEnvValues={effectiveEnvValues}
            onSubmit={submit}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CombinedExecutionInputForm({
  fields,
  variableFields,
  initialValues,
  initialEnvValues,
  onSubmit,
}: {
  fields: OutputField[];
  variableFields: OutputField[];
  initialValues?: Record<string, string>;
  initialEnvValues?: Record<string, string>;
  onSubmit: (values: Record<string, unknown>, env: Record<string, unknown>) => void | Promise<void>;
}) {
  const t = useTranslations('workflows');
  const inputForm = useExecutionInputFormState(fields, initialValues);
  const envForm = useExecutionInputFormState(variableFields, initialEnvValues);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    if (isSubmitting) return;
    const inputValid = inputForm.validate();
    const envValid = envForm.validate();
    if (!inputValid || !envValid) return;
    setIsSubmitting(true);
    try {
      const [values, env] = await Promise.all([inputForm.parse(), envForm.parse()]);
      await onSubmit(values, env);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="min-h-0 flex-1">
        <div className="mb-2 text-xs font-medium">{t('execution.workflowInput')}</div>
        <ScrollArea className="max-h-[28vh] pr-2">
          <ExecutionInputFields fields={fields} form={inputForm} disabled={isSubmitting} />
        </ScrollArea>
      </div>
      <div className="min-h-0 flex-1 border-t pt-3">
        <div className="mb-2 text-xs font-medium">{t('execution.initVariables')}</div>
        <ScrollArea className="max-h-[28vh] pr-2">
          <ExecutionInputFields fields={variableFields} form={envForm} disabled={isSubmitting} />
        </ScrollArea>
      </div>
      <DialogFooter>
        <Button size="sm" onClick={submit} disabled={isSubmitting}>
          <Play className="h-3 w-3 mr-1" /> {t('execution.startExecution')}
        </Button>
      </DialogFooter>
    </div>
  );
}