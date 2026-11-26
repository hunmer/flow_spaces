'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatFileSize } from '@/components/base/file-upload/file-upload';
import { Settings, Trash2, RotateCw } from 'lucide-react';
import { RiUploadCloud2Line } from '@remixicon/react';
import { sdk } from '@/lib/sdk';
import { cn } from '@/lib/utils';
import { cx } from '@/utils/cx';
import type { KnowledgeBase, KbFile, KbFileIndexStatus } from '@flow-spaces/shared';
import { KnowledgeBaseSettingsDialog } from './knowledge-base-settings-dialog';

const STATUS_STYLE: Record<KbFileIndexStatus, string> = {
  indexed: 'bg-emerald-500/15 text-emerald-600',
  pending: 'bg-muted text-muted-foreground',
  indexing: 'bg-blue-500/15 text-blue-600',
  failed: 'bg-destructive/15 text-destructive',
};

export function KnowledgeBaseDetailDialog({ workspaceId, kbId, onClose }: {
  workspaceId: string;
  kbId: string;
  onClose: () => void;
}) {
  const t = useTranslations();
  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [files, setFiles] = useState<KbFile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // 正在上传的本地文件（仅用于上传期间展示；上传成功即清空）
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const loadingRef = useRef(false);
  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const [k, fs] = await Promise.all([
        sdk.knowledgeBase.list(workspaceId).then((l) => l.find((x) => x.id === kbId) ?? null),
        sdk.knowledgeBase.listFiles(workspaceId, kbId),
      ]);
      setKb(k); setFiles(fs);
      setSelectedId((cur) => cur ?? fs[0]?.id ?? null);
    } finally { loadingRef.current = false; }
  }, [workspaceId, kbId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const hasPending = files.some((f) => f.indexStatus === 'pending' || f.indexStatus === 'indexing');
    if (!hasPending) return;
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, [files, load]);

  const selected = files.find((f) => f.id === selectedId) ?? null;

  // 拖入即上传：收到本次新增文件后立即全部上传，成功后刷新列表。
  // base/file-upload 为非受控单文件组件，缺少受控多文件与任意类型支持，
  // 按 MIGRATION-BOARDUI.md 第 9 节在消费方内联最小受控逻辑，仅复用 base 的 formatFileSize。
  const handleFilesAdded = useCallback(async (incoming: File[]) => {
    if (incoming.length === 0 || uploading) return;
    setPendingFiles(incoming);
    setUploading(true);
    try {
      await Promise.all(incoming.map((file) => sdk.knowledgeBase.uploadFile(workspaceId, kbId, file)));
      setPendingFiles([]);
      load();
    } catch (e) {
      setPendingFiles([]);
      window.alert((e as Error).message);
    } finally { setUploading(false); }
  }, [uploading, workspaceId, kbId, load]);

  const handleReindex = async (f: KbFile) => { await sdk.knowledgeBase.reindexFile(workspaceId, kbId, f.id); load(); };
  const handleDeleteFile = async (f: KbFile) => {
    if (!window.confirm(t('knowledgeBase.confirmDeleteFile'))) return;
    await sdk.knowledgeBase.deleteFile(workspaceId, kbId, f.id);
    if (selectedId === f.id) setSelectedId(null);
    load();
  };

  return (
    <>
      <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent className="!flex !h-[80vh] !w-[80vw] !max-w-[80vw] !flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {kb?.name ?? kbId}
              <Button variant="outline" size="sm" className="ml-auto h-7 me-5 gap-1 text-xs" onClick={() => setSettingsOpen(true)}>
                <Settings className="size-3.5" />{t('knowledgeBase.settings')}
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 gap-2">
            <div className="flex w-64 flex-col gap-2">
              <KbFileUploadZone
                placeholder={t('knowledgeBase.dropFiles')}
                disabled={uploading}
                pending={pendingFiles}
                onFiles={handleFilesAdded}
              />
              <div className="min-h-0 flex-1 overflow-auto rounded-md border">
                {files.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">{t('knowledgeBase.noFiles')}</div>
                ) : files.map((f) => (
                  <div key={f.id} className={cn('flex items-center gap-2 border-b px-2 py-1.5 last:border-0 hover:bg-muted/40', selectedId === f.id && 'bg-muted')}>
                    <button type="button" className="flex flex-1 items-center gap-2 text-left" onClick={() => setSelectedId(f.id)}>
                      <span className={cn('inline-block size-2 rounded-full', STATUS_STYLE[f.indexStatus])} />
                      <span className="flex-1 truncate text-xs">{f.fileName}</span>
                    </button>
                    {f.indexStatus === 'failed' && <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => handleReindex(f)} title={f.indexError ?? ''}><RotateCw className="size-3" /></button>}
                    <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => handleDeleteFile(f)}><Trash2 className="size-3" /></button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col rounded-md border">
              {selected ? (
                <>
                  <div className="shrink-0 border-b px-3 py-1.5 text-xs text-muted-foreground">
                    {selected.fileName} · {selected.size}B · {selected.chunkCount} {t('knowledgeBase.chunks')} · {selected.sourceType}:{selected.sourceRef}
                    {selected.indexStatus === 'failed' && <span className="text-destructive"> · {selected.indexError}</span>}
                  </div>
                  <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-3 text-xs">{selected.extractedText || t('knowledgeBase.noPreview')}</pre>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">{t('knowledgeBase.selectFile')}</div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {kb && settingsOpen && (
        <KnowledgeBaseSettingsDialog workspaceId={workspaceId} kb={kb} onClose={() => setSettingsOpen(false)} onSaved={load} />
      )}
    </>
  );
}

/** 知识库拖入即传的最小受控上传区：点击/拖放选择多个任意类型文件。
 *  base/file-upload 是非受控单文件模拟上传组件（强制扩展名白名单、动画结束才回调），
 *  按 MIGRATION-BOARDUI.md 第 9 节以最小补充逻辑内联实现，大小展示复用 base 的 formatFileSize。 */
function KbFileUploadZone({ placeholder, disabled, pending, onFiles }: {
  placeholder: string;
  disabled?: boolean;
  pending: File[];
  onFiles: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const acceptFiles = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length > 0) onFiles(files);
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={placeholder}
        onClick={() => { if (!disabled) inputRef.current?.click(); }}
        onKeyDown={(e) => {
          if (disabled || (e.key !== 'Enter' && e.key !== ' ')) return;
          e.preventDefault();
          inputRef.current?.click();
        }}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled) acceptFiles(e.dataTransfer.files);
        }}
        className={cx(
          'flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring',
          dragOver
            ? 'border-border-button-active bg-accent-500/5'
            : 'border-border-button-default hover:border-border-button-active',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => { acceptFiles(e.target.files); e.target.value = ''; }}
        />
        <RiUploadCloud2Line className="size-6 text-foreground-icon-secondary" aria-hidden />
        <p className="text-body-2-regular text-text-secondary">{placeholder}</p>
      </div>
      {pending.length > 0 && (
        <ul className="flex flex-col gap-1">
          {pending.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center gap-2 rounded-lg border border-border-button-default bg-background-primary-default px-2 py-1.5"
            >
              <span className="flex-1 truncate text-body-2-regular">{file.name}</span>
              <span className="shrink-0 text-caption-1-medium text-text-secondary">{formatFileSize(file.size)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}