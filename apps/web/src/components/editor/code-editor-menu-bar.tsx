"use client";

import { useTranslations } from 'next-intl';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import type { CodeEditorAction, CodeEditorHandle } from "@/components/editor/code-editor";
import { useTerminalStore } from "@/stores/terminal";

interface EditorMenuBarProps {
  editorHandle: CodeEditorHandle | null;
  activeFilePath: string | null;
  isReadOnly: boolean;
  onSave: () => void;
  onToggleReadOnly: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  wordWrap: boolean;
  onToggleWordWrap: () => void;
  fontSize: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

export function EditorMenuBar({ editorHandle, activeFilePath, isReadOnly, onSave, onToggleReadOnly, isFullscreen, onToggleFullscreen, wordWrap, onToggleWordWrap, fontSize, onZoomIn, onZoomOut, onZoomReset }: EditorMenuBarProps) {
  const t = useTranslations('editor');

  const exec = (action: CodeEditorAction) => {
    requestAnimationFrame(() => {
      const handle = editorHandle;
      if (!handle) return;
      handle.focus();
      handle.runAction(action);
    });
  };

  return (
    <div className="flex items-center h-7 border-b bg-background text-foreground shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger className="px-3 h-full text-xs hover:bg-accent outline-none cursor-default">
          {t('menuFile')}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={0}>
          <DropdownMenuItem onClick={onSave}>
            {t('menuSave')}
            <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger className="px-3 h-full text-xs hover:bg-accent outline-none cursor-default">
          {t('menuEdit')}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={0}>
          <DropdownMenuItem onClick={() => exec('undo')}>
            {t('menuUndo')}
            <DropdownMenuShortcut>⌘Z</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => exec('redo')}>
            {t('menuRedo')}
            <DropdownMenuShortcut>⇧⌘Z</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => exec('cut')}>
            {t('menuCut')}
            <DropdownMenuShortcut>⌘X</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => exec('copy')}>
            {t('menuCopy')}
            <DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => exec('paste')}>
            {t('menuPaste')}
            <DropdownMenuShortcut>⌘V</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => exec('find')}>
            {t('menuFind')}
            <DropdownMenuShortcut>⌘F</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isReadOnly}
            onClick={() => exec('replace')}
          >
            {t('menuReplace')}
            <DropdownMenuShortcut>⌥⌘F</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger className="px-3 h-full text-xs hover:bg-accent outline-none cursor-default">
          {t('menuView')}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={0}>
          <DropdownMenuItem onClick={onToggleFullscreen}>
            {isFullscreen ? t('exitFullscreen') : t('menuFullscreen')}
            <DropdownMenuShortcut>⌃⌘F</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onToggleWordWrap}>
            {wordWrap ? t('disableWordWrap') : t('enableWordWrap')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onZoomIn}>
            {t('zoomIn')}
            <DropdownMenuShortcut>⌘+</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onZoomOut}>
            {t('zoomOut')}
            <DropdownMenuShortcut>⌘-</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onZoomReset} disabled={fontSize === 13}>
            {t('zoomReset')} ({fontSize}px)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger className="px-3 h-full text-xs hover:bg-accent outline-none cursor-default">
          {t('menuRun')}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={0}>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{t('openInTerminal')}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => {
                const file = activeFilePath;
                if (!file) return;
                const dir = file.includes('/') ? file.substring(0, file.lastIndexOf('/')) : '';
                useTerminalStore.getState().createSession(undefined, dir || undefined);
              }}>
                {t('openCurrentDir')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                useTerminalStore.getState().createSession();
              }}>
                {t('openWorkspaceRoot')}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex-1" />
      <button
        onClick={onToggleReadOnly}
        className="flex items-center gap-1 px-2 h-full text-xs text-muted-foreground hover:text-foreground hover:bg-accent outline-none cursor-default cursor-pointer"
        title={isReadOnly ? t('enableEdit') : t('disableEdit')}
      >
        {isReadOnly ? '🔒' : '✏️'}
      </button>
    </div>
  );
}
