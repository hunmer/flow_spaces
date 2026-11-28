"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import "@/components/editor/code-editor-clipboard";
import { Code, Eye, FileText, AlignLeft, Binary } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MediaType, OpenFile } from "@/stores/editor";
import { EditorMenuBar } from "./code-editor-menu-bar";
import { getLanguage } from "@/lib/code-languages";
import { CodeEditor, type CodeEditorHandle, type CodeEditorOptions } from "./code-editor";
import { Markdown } from "@/components/ui/markdown";

function getDefaultReadOnly() {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768;
}

export interface PendingEditorJump {
  path: string;
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

interface CommonCodeEditorProps {
  activeFile: OpenFile | undefined;
  activeFilePath: string | null;
  activeContent: string;
  mediaType: MediaType | null;
  mediaUrl: string | null;
  pendingJump: PendingEditorJump | null;
  workspaceIdForMarkdown?: string;
  tabs?: React.ReactNode;
  onChange: (filePath: string, value: string) => void;
  onSave: () => void;
  onRefreshActiveFile: () => void;
  onClearPendingJump: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function detectEncoding(content: string): string {
  if (/^[\x00-\x7F]*$/.test(content)) return "ASCII";
  return "UTF-8";
}

function EditorStatusBar({
  file,
  content,
  t,
}: {
  file: OpenFile;
  content: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const lines = content ? content.split("\n").length : 0;
  const sizeBytes = new Blob([content]).size;
  const encoding = detectEncoding(content);

  return (
    <div className="flex items-center px-3 py-1 text-[11px] text-muted-foreground border-t bg-muted/30 select-none shrink-0 overflow-hidden">
      <span className="truncate flex items-center gap-1" title={file.path}>
        <FileText size={11} className="shrink-0" />
        {file.path}
      </span>
      <div className="ml-auto flex items-center gap-3 shrink-0">
        <span className="flex items-center gap-0.5">
          <Binary size={11} />
          {formatFileSize(sizeBytes)}
        </span>
        <span className="flex items-center gap-0.5">
          <AlignLeft size={11} />
          {lines} {t("lines")}
        </span>
        <span>{encoding}</span>
      </div>
    </div>
  );
}

export function CommonCodeEditor({
  activeFile,
  activeFilePath,
  activeContent,
  mediaType,
  mediaUrl,
  pendingJump,
  workspaceIdForMarkdown,
  tabs,
  onChange,
  onSave,
  onRefreshActiveFile,
  onClearPendingJump,
}: CommonCodeEditorProps) {
  const t = useTranslations("editor");
  const editorHandleRef = useRef<CodeEditorHandle | null>(null);
  const wheelZoomCleanupRef = useRef<(() => void) | null>(null);
  const [editorHandle, setEditorHandle] = useState<CodeEditorHandle | null>(null);
  const [isReadOnly, setIsReadOnly] = useState(getDefaultReadOnly);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wordWrap, setWordWrap] = useState(() => localStorage.getItem("editor-word-wrap") === "true");
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem("editor-font-size");
    return saved ? parseInt(saved, 10) : 13;
  });
  const [showPreview, setShowPreview] = useState(true);

  const isPreviewable = mediaType === "image" || mediaType === "video" || mediaType === "audio" || mediaType === "svg" || mediaType === "markdown";
  const isCodePreviewToggle = mediaType === "svg" || mediaType === "markdown";

  useEffect(() => { setShowPreview(true); }, [activeFilePath]);

  const handleMount = useCallback((handle: CodeEditorHandle) => {
    editorHandleRef.current = handle;
    setEditorHandle(handle);

    wheelZoomCleanupRef.current?.();
    const node = handle.getDomNode();
    if (node) {
      const handler = (e: WheelEvent) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        e.stopPropagation();
        setFontSize((prev) => {
          const next = prev + (e.deltaY < 0 ? 1 : -1);
          const clamped = Math.min(Math.max(next, 8), 40);
          localStorage.setItem("editor-font-size", String(clamped));
          return clamped;
        });
      };
      node.addEventListener("wheel", handler, { passive: false, capture: true });
      wheelZoomCleanupRef.current = () => {
        node.removeEventListener("wheel", handler, true);
      };
    }
  }, []);

  useEffect(() => {
    return () => {
      wheelZoomCleanupRef.current?.();
      wheelZoomCleanupRef.current = null;
      editorHandleRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!activeFilePath || !activeFile || activeFile.modified) return;
    const timer = setInterval(onRefreshActiveFile, 3000);
    return () => clearInterval(timer);
  }, [activeFile, activeFilePath, activeFile?.modified, onRefreshActiveFile]);

  useEffect(() => {
    if (!pendingJump || !activeFilePath || pendingJump.path !== activeFilePath) return;

    if (isCodePreviewToggle && showPreview) {
      setShowPreview(false);
      return;
    }

    const handle = editorHandleRef.current;
    if (!handle) return;

    const { line, column, endLine, endColumn } = pendingJump;
    handle.setSelection(line, column || 1, endLine, endColumn, { flash: true });
    if (!isReadOnly) {
      handle.focus();
    }
    onClearPendingJump();
  }, [pendingJump, activeFilePath, editorHandle, onClearPendingJump, isReadOnly, isCodePreviewToggle, showPreview]);

  const editorOptions: CodeEditorOptions = {
    fontSize,
    scrollBeyondLastLine: false,
    padding: { top: 8 },
    renderLineHighlight: "gutter",
    readOnly: isReadOnly,
    wordWrap: wordWrap ? "on" : "off",
  };

  const renderCodeEditor = () => (
    <CodeEditor
      height="100%"
      language={activeFile ? getLanguage(activeFile.path) : undefined}
      path={activeFilePath ?? undefined}
      value={activeContent}
      onChange={(value) => {
        if (!activeFile) return;
        onChange(activeFile.path, value || "");
      }}
      onMount={handleMount}
      onSave={onSave}
      options={editorOptions}
    />
  );

  return (
    <div className={`flex flex-col h-full ${isFullscreen ? "fixed inset-0 z-50 bg-background" : ""}`}>
      {tabs}
      <EditorMenuBar
        editorHandle={editorHandle}
        activeFilePath={activeFilePath}
        isReadOnly={isReadOnly}
        onSave={onSave}
        onToggleReadOnly={() => setIsReadOnly((r) => !r)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen((f) => !f)}
        wordWrap={wordWrap}
        onToggleWordWrap={() => {
          const v = !wordWrap;
          setWordWrap(v);
          localStorage.setItem("editor-word-wrap", String(v));
        }}
        fontSize={fontSize}
        onZoomIn={() => setFontSize((s) => {
          const n = Math.min(s + 1, 40);
          localStorage.setItem("editor-font-size", String(n));
          return n;
        })}
        onZoomOut={() => setFontSize((s) => {
          const n = Math.max(s - 1, 8);
          localStorage.setItem("editor-font-size", String(n));
          return n;
        })}
        onZoomReset={() => {
          setFontSize(13);
          localStorage.setItem("editor-font-size", "13");
        }}
      />
      <div className="relative flex-1 min-h-0 bg-background">
        {isPreviewable && showPreview && (mediaUrl || mediaType === "markdown") ? (
          <div className="relative flex justify-center h-full bg-muted/20 overflow-auto">
            {isCodePreviewToggle && (
              <button
                onClick={() => setShowPreview(false)}
                className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-background/90 border text-xs text-muted-foreground hover:text-foreground hover:bg-background shadow-sm transition-colors cursor-pointer"
                title={t("switchToCode")}
              >
                <Code size={14} />
                {t("code")}
              </button>
            )}
            {mediaType === "image" && (
              <img src={mediaUrl!} alt={activeFile?.name} className="max-w-full max-h-full object-contain" />
            )}
            {mediaType === "video" && (
              <video src={mediaUrl!} controls className="max-w-full max-h-full" />
            )}
            {mediaType === "audio" && (
              <div className="flex flex-col items-center gap-4">
                <div className="text-muted-foreground text-sm">{activeFile?.name}</div>
                <audio src={mediaUrl!} controls />
              </div>
            )}
            {mediaType === "svg" && (
              <img src={mediaUrl!} alt={activeFile?.name} className="max-w-full max-h-full object-contain" />
            )}
            {mediaType === "markdown" && activeContent && (
              <div className="prose prose-sm dark:prose-invert max-w-none w-full max-w-4xl mx-auto">
                <Markdown content={activeContent} workspaceId={workspaceIdForMarkdown} />
              </div>
            )}
          </div>
        ) : activeFile && isCodePreviewToggle && !showPreview ? (
          <div className="relative flex flex-col h-full">
            <button
              onClick={() => setShowPreview(true)}
              className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-background/90 border text-xs text-muted-foreground hover:text-foreground hover:bg-background shadow-sm transition-colors cursor-pointer"
              title={t("switchToPreview")}
            >
              <Eye size={14} />
              {t("preview")}
            </button>
            {renderCodeEditor()}
          </div>
        ) : activeFile ? (
          renderCodeEditor()
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            {t("openFileToEdit")}
          </div>
        )}
      </div>
      {activeFile && (
        <EditorStatusBar file={activeFile} content={activeContent} t={t} />
      )}
    </div>
  );
}
