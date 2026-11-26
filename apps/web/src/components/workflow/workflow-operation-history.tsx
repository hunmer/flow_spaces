'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { OperationEntry } from '@flow-spaces/shared';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Chip, type ChipColor } from '@/components/base/badges/chip';
import { Trash2, History, Undo2, Redo2 } from 'lucide-react';
import { Focusable } from 'react-aria-components';
import { Tooltip, TooltipTrigger } from '@/components/base/tooltip/tooltip';

interface OperationHistoryProps {
  entries: OperationEntry[];
  currentEntryIndex: number;
  currentUndoCount: number;
  currentRedoCount: number;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => Promise<void> | void;
}

const OPERATION_LABEL_KEYS: Record<string, string> = {
  'add node': 'operationHistory.addNode',
  'delete node': 'operationHistory.deleteNode',
  'delete': 'operationHistory.delete',
  'connect': 'operationHistory.connect',
  'delete edge': 'operationHistory.deleteEdge',
  'update edge label': 'operationHistory.updateEdgeLabel',
  'update edge style': 'operationHistory.updateEdgeStyle',
  'paste': 'operationHistory.paste',
  'move': 'operationHistory.move',
  'update data': 'operationHistory.updateData',
  'add group': 'operationHistory.addGroup',
  'create group': 'operationHistory.createGroup',
  'delete group': 'operationHistory.deleteGroup',
  'toggle group disabled': 'operationHistory.toggleGroupDisabled',
  'restore version': 'operationHistory.restoreVersion',
  'update trigger': 'operationHistory.updateTrigger',
  'import': 'operationHistory.import',
};

// 操作类型 → base Chip 语义色（原 raw palette 类按色系就近映射）
const OPERATION_COLORS: Record<string, ChipColor> = {
  'add node': 'lime',
  'delete node': 'rose',
  'delete': 'rose',
  'connect': 'blue',
  'delete edge': 'orange',
  'paste': 'purple',
  'move': 'neutral',
  'update data': 'cyan',
};

export function WorkflowOperationHistory({
  entries, currentEntryIndex, currentUndoCount, currentRedoCount, onUndo, onRedo, onClear,
}: OperationHistoryProps) {
  const t = useTranslations('workflows');

  const handleClear = useCallback(async () => {
    await onClear();
  }, [onClear]);

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-3">
        {/* Undo/Redo controls */}
        <div className="flex items-center gap-2">
          <TooltipTrigger>
            <Focusable>
              <Button
                variant="outline" size="icon" className="h-7 w-7"
                disabled={currentUndoCount === 0}
                onClick={onUndo}
              >
                <Undo2 className="h-3 w-3" />
              </Button>
            </Focusable>
            <Tooltip>{t('operationHistory.undo', { count: currentUndoCount })}</Tooltip>
          </TooltipTrigger>

          <TooltipTrigger>
            <Focusable>
              <Button
                variant="outline" size="icon" className="h-7 w-7"
                disabled={currentRedoCount === 0}
                onClick={onRedo}
              >
                <Redo2 className="h-3 w-3" />
              </Button>
            </Focusable>
            <Tooltip>{t('operationHistory.redo', { count: currentRedoCount })}</Tooltip>
          </TooltipTrigger>

          <span className="flex-1 text-[10px] text-muted-foreground text-right">
            {t('operationHistory.undoable', { count: currentUndoCount })} / {t('operationHistory.redoable', { count: currentRedoCount })}
          </span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">{t('operationHistory.recordCount', { count: entries.length })}</span>
          {entries.length > 0 && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={handleClear}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* History list */}
        {entries.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-6">
            <History className="h-6 w-6 mx-auto mb-2 opacity-50" />
            {t('operationHistory.empty')}
          </div>
        ) : (
          <div className="space-y-0.5">
            {entries.slice().reverse().map((entry, i) => {
              const entryIndex = entries.length - 1 - i;
              const isCurrent = entryIndex === currentEntryIndex;
              // Parse operation type from description (format: "type: detail" or just description)
              const desc = entry.description || '';
              const opType = desc.split(':')[0]?.trim() || '';
              const labelKey = OPERATION_LABEL_KEYS[opType];
              const label = labelKey ? t(labelKey) : opType || desc;
              const chipColor = OPERATION_COLORS[opType] ?? 'neutral';
              return (
                <div
                  key={`${entry.timestamp}-${i}`}
                  className={`flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                    isCurrent ? 'bg-primary/10 ring-1 ring-primary/25' : 'hover:bg-accent/50'
                  }`}
                >
                  <Chip variant="caption" color={chipColor}>
                    {label}
                  </Chip>
                  <span className="text-[10px] text-muted-foreground flex-1 truncate">
                    {desc.includes(':') ? desc.split(':').slice(1).join(':').trim() : desc}
                  </span>
                  <span className="text-[9px] text-muted-foreground shrink-0">
                    {formatTime(entry.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

function formatTime(ts: number | undefined): string {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}