"use client";

import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabList, Tab, TabPanel } from "@/components/base/tabs/tabs";
import { FolderPicker } from "@/components/ui/folder-picker";
import { FileUpload } from "@/components/base/file-upload/file-upload";
import { Loader2, Globe, FolderInput, Upload } from "lucide-react";
import { sdk } from '@/lib/sdk';
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { Accept } from "react-dropzone";

interface ImportFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  targetPath: string;
  onImported: () => void;
  accept?: Accept;
  onUploadFiles?: (files: File[]) => Promise<void>;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] || result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ImportFileDialog({ open, onOpenChange, workspaceId, targetPath, onImported, accept, onUploadFiles }: ImportFileDialogProps) {
  const t = useTranslations("editor");
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");
  const [internalPath, setInternalPath] = useState("");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);

  const reset = useCallback(() => {
    setUrl("");
    setInternalPath("");
    setUploadFiles([]);
    setLoading(false);
  }, []);

  const handleClose = useCallback(
    (v: boolean) => {
      if (!v) reset();
      onOpenChange(v);
    },
    [onOpenChange, reset],
  );

  const handleUrlImport = async () => {
    if (!url.trim()) return;
    setLoading(true);
    try {
      await sdk.editor.importUrl(workspaceId, url.trim(), targetPath);
      toast.success(t("importSuccess"));
      onImported();
      handleClose(false);
    } catch {
      toast.error(t("importFailed"));
      toast.error(t("importFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleInternalImport = async () => {
    if (!internalPath.trim()) return;
    setLoading(true);
    try {
      await sdk.editor.importPath(workspaceId, internalPath.trim(), targetPath);
      toast.success(t("importSuccess"));
      onImported();
      handleClose(false);
    } catch {
      toast.error(t("importFailed"));
      toast.error(t("importFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (uploadFiles.length === 0) return;
    setLoading(true);
    try {
      if (onUploadFiles) {
        await onUploadFiles(uploadFiles);
        toast.success(t("importSuccess"));
        onImported();
        handleClose(false);
      } else {
        const filesData = await Promise.all(
          uploadFiles.map(async (file) => ({
            name: file.name,
            content: await fileToBase64(file),
          })),
        );
        await sdk.editor.uploadFiles(workspaceId, targetPath, filesData);
        toast.success(t("importSuccess"));
        onImported();
        handleClose(false);
      }
    } catch {
      toast.error(t("importFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{t("importFile")}</DialogTitle>
          <DialogDescription>{t("importFileDesc")}</DialogDescription>
        </DialogHeader>
        <Tabs defaultSelectedKey="upload" className="gap-3">
          <TabList className="grid grid-cols-3">
             <Tab id="upload">
              <Upload className="size-3" />
              {t("importUpload")}
            </Tab>
            <Tab id="url">
              <Globe className="size-3" />
              {t("importOnline")}
            </Tab>
            <Tab id="internal">
              <FolderInput className="size-3" />
              {t("importInternal")}
            </Tab>
          </TabList>
           <TabPanel id="upload" className="space-y-3 pt-2">
            <FileUpload
              allowedExtensions={
                accept
                  ? Object.values(accept)
                      .flat()
                      .filter((value): value is string => typeof value === "string" && value.startsWith("."))
                      .map((value) => value.slice(1).toLowerCase())
                  : undefined
              }
              onUploadComplete={(file) => setUploadFiles((prev) => [...prev, file])}
            />
            <Button className="w-full" onClick={handleUpload} disabled={uploadFiles.length === 0 || loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : t("importUpload")}
            </Button>
          </TabPanel>
          <TabPanel id="url" className="space-y-3 pt-2">
            <Input placeholder="https://example.com/file.js" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleUrlImport()} />
            <Button className="w-full" onClick={handleUrlImport} disabled={!url.trim() || loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : t("importOnline")}
            </Button>
          </TabPanel>
          <TabPanel id="internal" className="space-y-3 pt-2">
            <FolderPicker value={internalPath} onChange={setInternalPath} allowFiles />
            <Button className="w-full" onClick={handleInternalImport} disabled={!internalPath.trim() || loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : t("importInternal")}
            </Button>
          </TabPanel>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
