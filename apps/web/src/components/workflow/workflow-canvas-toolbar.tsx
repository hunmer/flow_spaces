'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Workflow } from '@flow-spaces/shared';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
// 迁移 BoardUI：tooltip 改用 base 版（TooltipTrigger 包住 trigger + Tooltip 内容）
import { Tooltip, TooltipTrigger } from '@/components/base/tooltip/tooltip';
import {
  Archive, ClipboardPaste, Copy, Trash2,
  EyeOff, LassoSelect, LayoutGrid, Map as MapIcon, RotateCcw, RotateCw, SquareDashedMousePointer,
  PanelBottomClose, PanelBottomOpen,
  ExternalLink,
  MousePointerClick,
  Grid2x2, TextCursorInput,
} from 'lucide-react';
import type { WorkflowNodeDisplayMode } from './workflow-node-types';

export interface WorkflowClipboardRecord {
  id: string;
  label: string;
  count: number;
}

function CanvasToolbarButton({
  tooltip,
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { tooltip: string }) {
  return (
    <TooltipTrigger delay={400}>
      <Button
        variant="ghost"
        size="sm"
        className={`h-8 w-8 rounded-full p-0 text-muted-foreground transition-all duration-150 hover:bg-background hover:text-foreground active:scale-90 ${className ?? ''}`}
        {...props}
      >
        {children}
      </Button>
      <Tooltip placement="top">{tooltip}</Tooltip>
    </TooltipTrigger>
  );
}

export function CanvasToolbar({
  workflow,
  isPreview,
  canUndo,
  canRedo,
  rectangleDrawActive,
  lassoSelectionActive,
  minimapVisible,
  onUndo,
  onRedo,
  onExitPreview,
  onAutoLayout,
  layoutEngine,
  copiedNodeCount = 0,
  copiedRecords = [],
  onPasteRecord,
  onMoveRecord,
  onClearCopiedNodes,
  onToggleRectangleDraw,
  onToggleLassoSelection,
  onToggleMinimap,
  clickConnectEnabled = true,
  onClickConnectEnabledChange,
  logsCollapsed,
  onToggleLogsCollapsed,
  embeddedMode = null,
  workspaceId,
  issueId,
  nodeDisplayMode = 'properties',
  onNodeDisplayModeChange,
}: {
  workflow: Workflow;
  isPreview: boolean;
  canUndo: boolean;
  canRedo: boolean;
  rectangleDrawActive: boolean;
  lassoSelectionActive: boolean;
  minimapVisible: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onExitPreview?: () => void;
  onAutoLayout?: (direction: 'LR' | 'TB', options?: { layoutEngine?: string }) => void;
  layoutEngine?: string;
  copiedNodeCount?: number;
  copiedRecords?: WorkflowClipboardRecord[];
  onPasteRecord?: (id: string) => void;
  onMoveRecord?: (id: string) => void;
  onClearCopiedNodes?: () => void;
  onToggleRectangleDraw?: () => void;
  onToggleLassoSelection?: () => void;
  onToggleMinimap: () => void;
  clickConnectEnabled?: boolean;
  onClickConnectEnabledChange?: (enabled: boolean) => void;
  logsCollapsed: boolean;
  onToggleLogsCollapsed: () => void;
  embeddedMode?: 'issue' | null;
  workspaceId?: string;
  issueId?: string;
  nodeDisplayMode?: WorkflowNodeDisplayMode;
  onNodeDisplayModeChange?: (mode: WorkflowNodeDisplayMode) => void;
}) {
  const t = useTranslations("workflows");
  const [clipboardOpen, setClipboardOpen] = useState(false);
  const hasNodes = workflow.nodes.length > 0;
  const autoLayoutOptions = layoutEngine ? { layoutEngine } : undefined;
  const openWorkflowInNewWindow = () => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams();
    if (workspaceId) params.set('returnWorkspaceId', workspaceId);
    if (issueId) params.set('returnIssueId', issueId);
    const qs = params.toString();
    window.open(`/workflows/${workflow.id}${qs ? `?${qs}` : ''}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border/60 bg-muted px-2.5 py-1 shadow-[0_12px_28px_-10px_rgba(20,21,23,0.28)]">
      {isPreview && onExitPreview ? (
        <TooltipTrigger delay={400}>
          <Button variant="ghost" size="sm" className="h-8 rounded-full px-3 text-orange-500 hover:bg-background hover:text-orange-600" onClick={onExitPreview}>
            <EyeOff className="mr-1.5 h-3.5 w-3.5" />
            <span className="text-xs font-medium">{t('canvasToolbar.exitPreview')}</span>
          </Button>
          <Tooltip placement="top">{t('canvasToolbar.exitPreviewTooltip')}</Tooltip>
        </TooltipTrigger>
      ) : null}

      {isPreview && (
        <CanvasToolbarButton
          tooltip={logsCollapsed ? t('canvasToolbar.expandLogs') : t('canvasToolbar.collapseLogs')}
          className={`h-8 w-8 ${!logsCollapsed ? 'bg-background text-blue-600' : ''}`}
          onClick={onToggleLogsCollapsed}
        >
          {logsCollapsed ? <PanelBottomOpen className="h-3.5 w-3.5" /> : <PanelBottomClose className="h-3.5 w-3.5" />}
        </CanvasToolbarButton>
      )}
      {embeddedMode === 'issue' && (
        <CanvasToolbarButton tooltip={t('canvasToolbar.openInNewWindow')} onClick={openWorkflowInNewWindow}>
          <ExternalLink className="h-3.5 w-3.5" />
        </CanvasToolbarButton>
      )}
      {canUndo && (
        <CanvasToolbarButton tooltip={t('canvasToolbar.undo')} onClick={onUndo}>
          <RotateCcw className="h-3.5 w-3.5" />
        </CanvasToolbarButton>
      )}
      {canRedo && (
        <CanvasToolbarButton tooltip={t('canvasToolbar.redo')} onClick={onRedo}>
          <RotateCw className="h-3.5 w-3.5" />
        </CanvasToolbarButton>
      )}

      {copiedRecords.length > 0 && (
        <Popover open={clipboardOpen} onOpenChange={setClipboardOpen}>
          <TooltipTrigger delay={400}>
            <PopoverTrigger
              render={<Button variant="ghost" size="sm" className="relative h-8 w-8 rounded-full p-0 text-blue-600 transition-all duration-150 hover:bg-background active:scale-90" />}
            >
              <Copy className="h-3.5 w-3.5" />
              <span className="absolute -right-0.5 -bottom-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-1 text-[9px] leading-none text-primary-foreground">
                {copiedNodeCount}
              </span>
            </PopoverTrigger>
            <Tooltip placement="top">{t('canvasToolbar.copiedNodes')}</Tooltip>
          </TooltipTrigger>
          <PopoverContent align="center" side="top" className="w-60 gap-0 p-1.5">
            <div className="flex max-h-72 flex-col overflow-y-auto">
              {copiedRecords.map((record) => (
                <div key={record.id} className="flex items-center gap-2 rounded-md px-1.5 py-1.5 hover:bg-accent">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{record.label}</div>
                    <div className="text-[10px] text-muted-foreground">{t('canvasToolbar.recordCount', { count: record.count })}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 shrink-0 p-0"
                    disabled={!onPasteRecord}
                    onClick={() => { setClipboardOpen(false); onPasteRecord?.(record.id); }}
                  >
                    <ClipboardPaste className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 shrink-0 p-0"
                    disabled={!onMoveRecord}
                    onClick={() => { setClipboardOpen(false); onMoveRecord?.(record.id); }}
                  >
                    <Archive className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
            {onClearCopiedNodes && (
              <div className="mt-1 border-t border-border pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-full justify-center text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => { setClipboardOpen(false); onClearCopiedNodes(); }}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  {t('canvasToolbar.clearCopiedNodes')}
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}

      {onToggleRectangleDraw && (
        <CanvasToolbarButton
          tooltip={t('canvasToolbar.drawAreaAddNode')}
          className={`h-8 w-8 ${rectangleDrawActive ? 'bg-background text-blue-600' : ''}`}
          onClick={onToggleRectangleDraw}
        >
          <SquareDashedMousePointer className="h-3.5 w-3.5" />
        </CanvasToolbarButton>
      )}

      {onToggleLassoSelection && (
        <CanvasToolbarButton
          tooltip={t('canvasToolbar.drawAreaSelectNode')}
          className={`h-8 w-8 ${lassoSelectionActive ? 'bg-background text-blue-600' : ''}`}
          onClick={onToggleLassoSelection}
        >
          <LassoSelect className="h-3.5 w-3.5" />
        </CanvasToolbarButton>
      )}

      {hasNodes && onAutoLayout && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="h-8 w-8 rounded-full p-0 text-muted-foreground transition-all duration-150 hover:bg-background hover:text-foreground active:scale-90" />}>
            <LayoutGrid className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top">
            <DropdownMenuItem onClick={() => onAutoLayout('LR', autoLayoutOptions)}>{t('canvasToolbar.horizontalLayout')}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAutoLayout('TB', autoLayoutOptions)}>{t('canvasToolbar.verticalLayout')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <CanvasToolbarButton
        tooltip={minimapVisible ? t('canvasToolbar.hideMinimap') : t('canvasToolbar.showMinimap')}
        className={`h-8 w-8 ${minimapVisible ? 'bg-background text-blue-600' : ''}`}
        onClick={onToggleMinimap}
      >
        <MapIcon className="h-3.5 w-3.5" />
      </CanvasToolbarButton>

      {onNodeDisplayModeChange && (
        <CanvasToolbarButton
          tooltip={`${t('canvasToolbar.nodeDisplayMode')}: ${t(`canvasToolbar.nodeDisplayModeOptions.${nodeDisplayMode}`)} · ${t('canvasToolbar.nodeDisplayModeCycle')}`}
          onClick={() => {
            onNodeDisplayModeChange(nodeDisplayMode === 'icon' ? 'properties' : 'icon');
          }}
        >
          {nodeDisplayMode === 'properties' ? <TextCursorInput className="h-3.5 w-3.5" /> : null}
          {nodeDisplayMode === 'icon' ? <Grid2x2 className="h-3.5 w-3.5" /> : null}
        </CanvasToolbarButton>
      )}

      {onClickConnectEnabledChange && (
        <CanvasToolbarButton
          tooltip={t('canvasToolbar.clickConnectTooltip')}
          className={`h-8 w-8 md:hidden ${clickConnectEnabled ? 'bg-background text-blue-600' : ''}`}
          onClick={() => onClickConnectEnabledChange(!clickConnectEnabled)}
        >
          <MousePointerClick className="h-3.5 w-3.5" />
        </CanvasToolbarButton>
      )}

    </div>
  );
}