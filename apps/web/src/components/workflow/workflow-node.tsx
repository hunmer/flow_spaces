'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, useSyncExternalStore, useDeferredValue } from 'react';
import { useTranslations } from 'next-intl';
import { Position, useConnection, useNodeConnections, useStore } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import {
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { getPluginNodesVersion, subscribePluginNodesVersion, useLocalizedNodeDefinition } from '@/lib/workflow-nodes';
import {
  type ExecutionStep,
  type WorkflowEdge,
  type WorkflowNode as SharedWorkflowNode,
  LOOP_BODY_NODE_TYPE,
} from '@flow-spaces/shared';
import { BorderGlide } from '@/components/ui/border-glide';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';
import { getWorkflowNodeSize, getWorkflowNodeVariableReferences } from './workflow-node-size';
import {
  isPluginWorkflowCustomViewDefinition,
  PluginWorkflowCustomView,
} from './plugin-workflow-custom-view';
import {
  NODE_COLORS,
  type WorkflowNodeData,
  type WorkflowCustomViewProps,
  type PluginNodeDefinitionMeta,
} from './workflow-node-types';
import { WorkflowNodeContextMenu } from './workflow-node-context-menu';
import { useWorkflowLogsCollapsed } from './workflow-logs-collapsed-context';
import {
  HANDLE_POSITION_MAP,
  getTargetHandleStyle,
  WORKFLOW_NODE_DRAG_HANDLE_CLASS,
  type HandleContext,
} from './workflow-node-handles';
import { WorkflowNodeExecutionLog } from './workflow-node-execution-log';
import {
  EXECUTION_DATA_KEY,
  EXECUTION_INPUT_FIELDS_KEY,
  EXECUTION_OUTPUTS_KEY,
} from './workflow-execution-snapshot-fields';
import { getEffectiveDataType } from './workflow-properties-utils';
import { JSON_PRESETS_KEY, SELECTED_JSON_PRESET_KEY, getJsonPresets } from './workflow-properties-utils';
import { VariableBadgeInput } from './workflow-variable-input';
import { WorkflowPropertiesPanel } from './workflow-properties-panel';
import { useWorkflowNodeActions } from './use-workflow-node-actions';
import { areWorkflowNodePropsEqual } from './workflow-node-memo';
import { CompatibilityHandle, useWorkflowNodeHandles } from './workflow-node-handles-render';
import { useWorkflowNodePropertyMode } from './workflow-node-property-mode';
import { WorkflowNodeToolbar } from './workflow-node-toolbar';
import {
  NodeBodyBadges,
  NodeBodyCornerControls,
  NodeBodyHeader,
  NodeBodySourceHandles,
  NodeBodyTargetHandles,
  NodeBodyIcons,
} from './workflow-node-body';
import { WorkflowNodeDefinitionIcon } from './workflow-node-icon';
import {
  COLLAPSED_NODE_SIZE,
  ICON_MODE_NODE_SIZE,
  COLLAPSED_OUTPUT_HANDLES_KEY,
  showFullNodeSelector,
  canvasZoomSelector,
  workflowNodesSelector,
  getWorkflowFields,
  getWorkflowFieldsSignature,
  getRecordValue,
  getVariableContextNodeLabel,
  type NodePreviewDragPhase,
} from './workflow-node-utils';
import { useWorkflowNodeInternals } from './use-workflow-node-internals';
import { useWorkflowNodeContentVisible, WorkflowNodeContentVisibilityContext } from './use-workflow-node-content-visible';
import type { WorkflowNodeRuntimeSizeEventDetail } from './workflow-canvas-types';

const EMPTY_WORKFLOW_NODES: ReturnType<typeof workflowNodesSelector> = [];

function WorkflowNodeComponent({ id, data, type, selected }: NodeProps) {
  const nodeData = data as WorkflowNodeData;
  const t = useTranslations('workflows');
  const showFullNode = useStore(showFullNodeSelector);
  const canvasZoom = useStore(canvasZoomSelector);
  const sharedVariableContext = nodeData.workflowVariableContext as {
    nodes: SharedWorkflowNode[]; edges: WorkflowEdge[];
  } | undefined;
  const workflowNodes = useStore(useCallback(
    (state: Parameters<typeof workflowNodesSelector>[0]) => sharedVariableContext ? EMPTY_WORKFLOW_NODES : workflowNodesSelector(state),
    [sharedVariableContext],
  ));
  const sourceData = getRecordValue(nodeData.executionLogData) ?? nodeData;
  const connectionState = useConnection();
  const workflowNodeType = typeof nodeData.nodeType === 'string' ? nodeData.nodeType : type;
  const scheduleNodeInternals = useWorkflowNodeInternals();
  useSyncExternalStore(
    subscribePluginNodesVersion,
    getPluginNodesVersion,
    getPluginNodesVersion,
  );
  const definition = useLocalizedNodeDefinition(workflowNodeType || 'unknown');
  const pluginMeta = definition as (typeof definition & PluginNodeDefinitionMeta);
  const iconDefinition = definition ? { ...definition, ...pluginMeta } : null;
  const pluginCustomView = isPluginWorkflowCustomViewDefinition(definition?.customView)
    ? definition.customView
    : null;
  const CustomView = !pluginCustomView
    ? definition?.customView as React.ComponentType<WorkflowCustomViewProps> | undefined
    : undefined;
  const hasCustomView = !!CustomView || !!pluginCustomView;
  const customViewData = getRecordValue(nodeData[EXECUTION_DATA_KEY]) ?? nodeData;

  const { collapsed: logsCollapsed } = useWorkflowLogsCollapsed();
  const [isLogExpanded, setIsLogExpanded] = useState(false);
  const [isNodeCollapsed, setIsNodeCollapsed] = useState(false);
  // 全局切换时同步本地状态
  useEffect(() => {
    setIsLogExpanded(!logsCollapsed);
  }, [logsCollapsed]);
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState('');
  const collapsedOutputKeysValue = nodeData[COLLAPSED_OUTPUT_HANDLES_KEY];
  // 折叠状态从 nodeData 读取（持久化）；写入逻辑见 actions 之后
  const collapsedOutputKeys = useMemo(() => {
    const raw = collapsedOutputKeysValue;
    return raw && typeof raw === 'object' && !Array.isArray(raw)
      ? raw as Record<string, boolean>
      : {};
  }, [collapsedOutputKeysValue]);
  const inputRef = useRef<HTMLInputElement>(null);
  const nodeBodyRef = useRef<HTMLDivElement>(null);
  const propertyContentRef = useRef<HTMLDivElement | null>(null);
  const [measuredPropertyHeight, setMeasuredPropertyHeight] = useState<number>(0);
  const rafCleanupRef = useRef<(() => void) | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

  const displayLabel = useMemo(
    () => {
      const raw = nodeData.label;
      const resolved = raw && !raw.startsWith('nodes.') ? raw : '';
      return resolved || definition?.label || workflowNodeType || '';
    },
    [nodeData.label, definition?.label, workflowNodeType],
  );

  const isStartNode = definition?.type === 'start';
  const isEndNode = definition?.type === 'end';
  const isBoundaryNode = isStartNode || isEndNode;
  const isLoopBody = definition?.type === LOOP_BODY_NODE_TYPE;
  const canDeleteNode = !isLoopBody;
  const isCanvasLocked = nodeData.isCanvasLocked;
  const selectedNodeIds = useMemo(
    () => Array.isArray(nodeData.selectedNodeIds) ? nodeData.selectedNodeIds : [],
    [nodeData.selectedNodeIds],
  );
  const canShowNodeToolbar = !isCanvasLocked;
  const handleColors = useMemo(() => {
    const raw = nodeData.handleColors;
    return raw && typeof raw === 'object' ? raw : {};
  }, [nodeData.handleColors]);

  React.useEffect(() => {
    if (isCanvasLocked) setIsEditing(false);
  }, [isCanvasLocked]);

  const showTargetHandle = definition?.handles?.target !== false;
  const showSourceHandle = definition?.handles?.source !== false;
  const targetConnectionCount = definition?.handles?.connectionCount ?? 1;
  const targetConnections = useNodeConnections({ id, handleType: 'target', handleId: 'target' });
  const isTargetConnectable = targetConnections.length < targetConnectionCount;
  const staticSourceHandles = definition?.handles?.sourceHandles || [];
  const handlePositionMode = nodeData.handlePosition || 'left-right';
  const handlePositions = HANDLE_POSITION_MAP[handlePositionMode] || HANDLE_POSITION_MAP['left-right'];
  const logPanelLayout = nodeData.logPanelLayout === 'tabs' ? 'tabs' : 'vertical';
  const nodeDisplayMode = nodeData.nodeDisplayMode === 'icon' ? 'icon' : 'properties';
  // 图标模式：纯图标卡片（固定尺寸，不可调节），循环节点体不参与
  const isIconMode = nodeDisplayMode === 'icon' && !isLoopBody;
  const propertyModeBadgePosition = nodeData.propertyModeBadgePosition === 'top' || nodeData.propertyModeBadgePosition === 'bottom'
    ? nodeData.propertyModeBadgePosition
    : 'center';
  const floatingHandles = !isNodeCollapsed && (nodeData.floatingHandles === true || nodeDisplayMode === 'properties');
  const floatingHandleClassName = floatingHandles ? 'workflow-node-floating-handle' : '';
  const floatingLabelClassName = floatingHandles ? 'workflow-node-floating-handle-label' : '';
  const inputFields = useMemo(() => getWorkflowFields(nodeData.inputFields), [nodeData.inputFields]);
  const outputFields = useMemo(() => getWorkflowFields(nodeData.outputs), [nodeData.outputs]);
  const propertyFields = useMemo(() => (
    definition?.properties?.filter(prop => !prop.visibleWhen || (
      'equals' in prop.visibleWhen
        ? nodeData[prop.visibleWhen.key] === prop.visibleWhen.equals
        : prop.visibleWhen.in?.includes(nodeData[prop.visibleWhen.key])
    )) ?? []
  ), [definition?.properties, nodeData]);
  const inputFieldsSignature = useMemo(() => getWorkflowFieldsSignature(inputFields), [inputFields]);
  const outputFieldsSignature = useMemo(() => getWorkflowFieldsSignature(outputFields), [outputFields]);
  const propertyFieldsSignature = useMemo(
    () => propertyFields.map((field, index) => {
      const value = nodeData[field.key];
      const itemCount = field.type === 'array' && Array.isArray(value) ? value.length : 0;
      const childKeys = field.fields?.map(child => child.key).join(',') ?? '';
      return `${index}:${field.key}:${getEffectiveDataType(field)}:${itemCount}:${childKeys}`;
    }).join('|'),
    [nodeData, propertyFields],
  );
  const collapsedOutputKeysSignature = useMemo(
    () => Object.entries(collapsedOutputKeys)
      .filter(([, collapsed]) => collapsed)
      .map(([key]) => key)
      .sort()
      .join('|'),
    [collapsedOutputKeys],
  );
  const canShowPropertyBadgeHandles = nodeDisplayMode === 'properties' && !isLoopBody && !isNodeCollapsed;
  const canShowPropertyNodeView = canShowPropertyBadgeHandles && !hasCustomView;
  const variableReferences = useMemo(
    () => Array.from(new Set(getWorkflowNodeVariableReferences(sourceData))),
    [sourceData],
  );
  const embeddedMode = nodeData.embeddedMode === 'issue' ? 'issue' : null;
  const variableContext = useMemo(() => sharedVariableContext ?? ({
    nodes: workflowNodes.map((node): SharedWorkflowNode => {
      const currentData = node.data as Record<string, unknown>;
      const currentType = typeof currentData.nodeType === 'string' ? currentData.nodeType : node.type || '';
      return {
        id: node.id,
        type: currentType,
        label: getVariableContextNodeLabel(currentType, currentData, node.id, t),
        position: node.position,
        data: currentData,
      };
    }),
    edges: Array.isArray(nodeData.workflowEdges) ? nodeData.workflowEdges as WorkflowEdge[] : [],
  }), [sharedVariableContext, nodeData.workflowEdges, workflowNodes, t]);

  // Dynamic handles for switch node
  const dynamicSource = definition?.handles?.dynamicSource;
  const dynamicHandles = useMemo(() => {
    if (!dynamicSource) return null;
    const conditions = (data as Record<string, unknown>)?.[dynamicSource.dataKey];
    const arr: unknown[] = Array.isArray(conditions) ? conditions : [];
    const extra = dynamicSource.extraCount || 0;
    const total = arr.length + extra;
    if (total === 0) return null;
    return Array.from({ length: total }, (_, i) => ({
      id: i < arr.length ? `case-${i}` : 'default',
      label: i < arr.length ? t('nodeUi.condition', { index: i + 1 }) : t('nodeUi.conditionDefault'),
      index: i,
      total,
    }));
  }, [dynamicSource, data, t]);

  const nodeSize = useMemo(
    () => getWorkflowNodeSize(definition, nodeData),
    [definition, nodeData],
  );
  const {
    minWidth: nodeMinWidth,
    minHeight: nodeMinHeight,
    width: nodeWidth,
    height: nodeHeight,
    sourceHandleCount,
  } = nodeSize;
  const displayNodeWidth = isNodeCollapsed
    ? COLLAPSED_NODE_SIZE
    : isIconMode ? ICON_MODE_NODE_SIZE : nodeWidth;
  const displayNodeHeight = isNodeCollapsed
    ? COLLAPSED_NODE_SIZE
    : isIconMode ? ICON_MODE_NODE_SIZE
      : (canShowPropertyNodeView && measuredPropertyHeight > 0 ? measuredPropertyHeight : nodeHeight);
  const isContentVisible = useWorkflowNodeContentVisible(nodeBodyRef, !hasCustomView && !isLoopBody);
  const shouldShowNodeContent = showFullNode && !isNodeCollapsed && !isIconMode && isContentVisible;
  // 连接点和外壳立即切换；复杂编辑器的首次渲染允许 React 分片并让出主线程。
  const deferredNodeContent = useDeferredValue(shouldShowNodeContent, false);
  const forceNodeContent = React.useContext(WorkflowNodeContentVisibilityContext);
  const canShowNodeContent = canShowPropertyNodeView ? forceNodeContent || deferredNodeContent : shouldShowNodeContent;
  const [keepPropertyContentMounted, setKeepPropertyContentMounted] = useState(false);
  useEffect(() => {
    if (!isContentVisible || isNodeCollapsed || hasCustomView || isLoopBody) {
      setKeepPropertyContentMounted(false);
    } else if (canShowPropertyNodeView && canShowNodeContent) {
      setKeepPropertyContentMounted(true);
    }
  }, [isContentVisible, isNodeCollapsed, hasCustomView, isLoopBody, canShowPropertyNodeView, canShowNodeContent]);
  const keepCustomViewMounted = hasCustomView && !isNodeCollapsed;
  const canShowVariableReferences = !isLoopBody && !hasCustomView && variableReferences.length > 0;
  const selectedJsonPresetId = typeof nodeData[SELECTED_JSON_PRESET_KEY] === 'string'
    ? nodeData[SELECTED_JSON_PRESET_KEY]
    : '';
  const selectedJsonPreset = selectedJsonPresetId
    ? getJsonPresets(nodeData[JSON_PRESETS_KEY]).find(preset => preset.id === selectedJsonPresetId) ?? null
    : null;

  React.useEffect(() => scheduleNodeInternals(id), [
    id, scheduleNodeInternals, sourceHandleCount, showTargetHandle, showSourceHandle,
    displayNodeWidth, displayNodeHeight, handlePositions.target, handlePositions.source,
    workflowNodeType, nodeDisplayMode, propertyModeBadgePosition,
    inputFieldsSignature, outputFieldsSignature, propertyFieldsSignature, collapsedOutputKeysSignature,
  ]);

  React.useEffect(() => {
    if (!canShowPropertyNodeView || measuredPropertyHeight <= 0) return;
    window.dispatchEvent(new CustomEvent<WorkflowNodeRuntimeSizeEventDetail>('workflow:update-node-runtime-size', {
      detail: {
        nodeId: id,
        width: displayNodeWidth,
        height: displayNodeHeight,
      },
    }));
  }, [canShowPropertyNodeView, displayNodeHeight, displayNodeWidth, id, measuredPropertyHeight]);

  // 属性模式：测量面板实际内容高度，动态撑开节点
  // 属性正文重新显示时，恢复测量和内容变化监听。
  React.useEffect(() => {
    if (!canShowPropertyNodeView || !canShowNodeContent || typeof ResizeObserver === 'undefined') return;
    const wrapper = propertyContentRef.current;
    if (!wrapper) return;
    let observedTarget: HTMLElement | null = null;
    let frame = 0;
    const resizeObserver = new ResizeObserver(() => scheduleUpdate());
    const observeCurrentTarget = () => {
      const nextTarget = wrapper.firstElementChild as HTMLElement | null;
      if (nextTarget === observedTarget) return nextTarget;
      if (observedTarget) resizeObserver.unobserve(observedTarget);
      observedTarget = nextTarget;
      if (observedTarget) resizeObserver.observe(observedTarget);
      return observedTarget;
    };
    // 用 scrollHeight 取完整内容高度（不受外层节点高度钳制），getBoundingClientRect 在长内容时会被 flex 链路限制
    const update = () => {
      const measureTarget = observeCurrentTarget();
      if (!measureTarget) return;
      const next = Math.ceil(measureTarget.scrollHeight);
      if (next > 0) setMeasuredPropertyHeight(prev => (prev === next ? prev : next));
    };
    const scheduleUpdate = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };
    // 首次延迟到布局稳定后测量（双 rAF 应对 panel 异步内容），ResizeObserver 负责后续变化
    const raf1 = requestAnimationFrame(() => {
      update();
      const raf2 = requestAnimationFrame(scheduleUpdate);
      rafCleanupRef.current = () => cancelAnimationFrame(raf2);
    });
    rafCleanupRef.current = () => cancelAnimationFrame(raf1);
    resizeObserver.observe(wrapper);
    observeCurrentTarget();
    const mutationObserver = new MutationObserver(scheduleUpdate);
    mutationObserver.observe(wrapper, { childList: true, subtree: true });
    return () => {
      rafCleanupRef.current?.();
      rafCleanupRef.current = null;
      if (frame) cancelAnimationFrame(frame);
      mutationObserver.disconnect();
      resizeObserver.disconnect();
    };
  }, [canShowPropertyNodeView, canShowNodeContent]);

  const handleCtx: HandleContext = useMemo(
    () => ({ isLoopBody, nodeHeight: displayNodeHeight, handlePositions }),
    [isLoopBody, displayNodeHeight, handlePositions],
  );

  const startEdit = useCallback(() => {
    if (isCanvasLocked) return;
    setEditLabel(displayLabel);
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [displayLabel, isCanvasLocked]);

  const finishEdit = useCallback(() => {
    setIsEditing(false);
    if (!isCanvasLocked && editLabel && editLabel !== displayLabel) {
      window.dispatchEvent(new CustomEvent('workflow:update-node-data', {
        detail: { nodeId: id, data: { label: editLabel } },
      }));
    }
  }, [editLabel, displayLabel, id, isCanvasLocked]);

  // Execution status is injected by WorkflowCanvas from the current execution log.
  const executionStep = nodeData.executionStep;
  const nodeStatus = nodeData.isRunning ? 'running' : executionStep?.status || 'idle';
  const currentNodeState = nodeData.nodeState || 'normal';
  const currentBreakpoint = nodeData.breakpoint || null;
  const isCurrentNodeDebugging = nodeData.debugNodeId === id && nodeData.debugStatus === 'running';
  const currentNodeDebugStatus = nodeData.debugNodeId === id ? nodeData.debugStatus : 'idle';
  const hasCurrentNodeDebugResult = nodeData.debugNodeId === id && currentNodeDebugStatus !== 'idle';
  const isDebugging = nodeData.debugStatus === 'running';
  const isExecutionBusy = nodeData.execStatus === 'running' || nodeData.execStatus === 'paused';
  const isDeleteDisabled = isExecutionBusy || isDebugging;
  const isPartialTesting = nodeData.execStatus === 'running' && nodeData.partialExecutionStartNodeId === id;
  const isPausedAtThisNode = nodeData.execStatus === 'paused'
    && nodeData.pausedNodeId === id
    && (
      nodeData.pausedReason === 'breakpoint-start'
      || nodeData.pausedReason === 'breakpoint-end'
      || !!currentBreakpoint
    );
  const debugExecutionStep = useMemo<ExecutionStep | undefined>(() => {
    if (!hasCurrentNodeDebugResult) return undefined;
    const status = currentNodeDebugStatus === 'error'
      ? 'error'
      : currentNodeDebugStatus === 'running' ? 'running' : 'completed';
    return {
      nodeId: id,
      nodeLabel: displayLabel,
      startedAt: 0,
      finishedAt: status === 'running' ? undefined : 0,
      status,
    };
  }, [currentNodeDebugStatus, displayLabel, hasCurrentNodeDebugResult, id]);
  const displayExecutionStep = executionStep ?? debugExecutionStep;
  const canContinueFromPreview = nodeData.isPreview === true
    && displayExecutionStep?.status === 'completed'
    && !isBoundaryNode;
  const canShowExecutionLog = !!displayExecutionStep
    && (
      displayExecutionStep.status === 'running'
      || displayExecutionStep.status === 'completed'
      || displayExecutionStep.status === 'error'
    );

  const stateBadge = currentNodeState === 'disabled'
    ? t('nodeUi.stateBadge.disabled')
    : currentNodeState === 'skipped' ? t('nodeUi.stateBadge.skipped') : '';
  const breakpointBadge = currentBreakpoint === 'start'
    ? t('nodeUi.breakpointBadge.start')
    : currentBreakpoint === 'end' ? t('nodeUi.breakpointBadge.end') : '';
  const nodeColor = NODE_COLORS.find(color => color.value === nodeData.nodeColor);
  const stateBackgroundClass = currentNodeState === 'disabled'
    ? 'bg-red-500/10'
    : currentNodeState === 'skipped' ? 'bg-yellow-500/10' : nodeColor?.backgroundClassName || 'bg-background';

  const statusColor = isPausedAtThisNode
    ? 'border-blue-600 ring-2 ring-blue-500 shadow-blue-500/40 shadow-md animate-pulse'
    : currentNodeDebugStatus === 'completed'
    ? 'border-green-500 shadow-green-500/15 shadow-sm'
    : currentNodeDebugStatus === 'error'
    ? 'border-destructive shadow-destructive/20 shadow-sm'
    : nodeStatus === 'running'
    ? 'border-blue-500 shadow-blue-500/30 shadow-md'
    : nodeStatus === 'completed'
      ? 'border-green-500/70 shadow-green-500/15 shadow-sm'
      : nodeStatus === 'error'
        ? 'border-destructive/70 shadow-destructive/15 shadow-sm'
        : nodeStatus === 'skipped'
          ? 'border-yellow-500'
    : nodeColor?.borderClassName || 'border-border';

  const actions = useWorkflowNodeActions({
    id,
    isCanvasLocked: !!isCanvasLocked,
    isBoundaryNode,
    isCurrentNodeDebugging,
    isExecutionBusy,
    isDeleteDisabled,
    selectedNodeIds,
    nodeMinWidth,
    nodeMinHeight,
  });

  // 折叠状态持久化到 nodeData
  const toggleOutputHandleCollapsed = useCallback((collapsedKey: string) => {
    actions.dispatchNodeUpdate({
      [COLLAPSED_OUTPUT_HANDLES_KEY]: { ...collapsedOutputKeys, [collapsedKey]: !collapsedOutputKeys[collapsedKey] },
    });
  }, [actions, collapsedOutputKeys]);

  const {
    getSourceHandleStyle,
    openHandleColorMenu,
    renderHandleColorPopover,
  } = useWorkflowNodeHandles({
    isCanvasLocked: !!isCanvasLocked,
    handleColors,
    handleCtx,
    dispatchNodeUpdate: actions.dispatchNodeUpdate,
    t,
  });

  const dispatchResizePreview = useCallback((rect: { left: number; top: number; width: number; height: number } | null) => {
    window.dispatchEvent(new CustomEvent('workflow:node-resize-preview', { detail: { rect } }));
  }, []);

  useEffect(() => () => {
    resizeCleanupRef.current?.();
    dispatchResizePreview(null);
  }, [dispatchResizePreview]);

  const handleResizePointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (isCanvasLocked) return;
    event.preventDefault();
    event.stopPropagation();

    const nodeRect = nodeBodyRef.current?.getBoundingClientRect();
    if (!nodeRect) return;

    resizeCleanupRef.current?.();
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = displayNodeWidth;
    const startHeight = displayNodeHeight;
    const zoom = canvasZoom || 1;
    let nextSize = { width: startWidth, height: startHeight };

    const updatePreview = (size: { width: number; height: number }) => {
      dispatchResizePreview({
        left: nodeRect.left,
        top: nodeRect.top,
        width: size.width * zoom,
        height: size.height * zoom,
      });
    };

    updatePreview(nextSize);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const width = Math.max(nodeMinWidth, Math.round(startWidth + (moveEvent.clientX - startX) / zoom));
      const height = Math.max(nodeMinHeight, Math.round(startHeight + (moveEvent.clientY - startY) / zoom));
      nextSize = { width, height };
      updatePreview(nextSize);
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      resizeCleanupRef.current = null;
    };

    const handlePointerUp = () => {
      cleanup();
      dispatchResizePreview(null);
      actions.handleResizeEnd(null, nextSize);
    };

    const handlePointerCancel = () => {
      cleanup();
      dispatchResizePreview(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    resizeCleanupRef.current = handlePointerCancel;
  }, [actions, canvasZoom, dispatchResizePreview, displayNodeHeight, displayNodeWidth, isCanvasLocked, nodeMinHeight, nodeMinWidth]);

  const dispatchNodePreviewDrag = useCallback((phase: NodePreviewDragPhase, screenDelta: { x: number; y: number }) => {
    window.dispatchEvent(new CustomEvent('workflow:node-preview-drag', {
      detail: { nodeId: id, phase, screenDelta },
    }));
  }, [id]);

  const handleCustomViewDragPointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (isCanvasLocked) return;
    event.preventDefault();
    event.stopPropagation();

    const pointerId = event.pointerId;
    const element = event.currentTarget;
    const start = { x: event.clientX, y: event.clientY };
    let frameId: number | null = null;
    let pendingScreenDelta = { x: 0, y: 0 };

    dispatchNodePreviewDrag('start', pendingScreenDelta);
    element.setPointerCapture(pointerId);

    const flushPreview = () => {
      frameId = null;
      dispatchNodePreviewDrag('move', pendingScreenDelta);
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      pendingScreenDelta = {
        x: moveEvent.clientX - start.x,
        y: moveEvent.clientY - start.y,
      };
      if (frameId === null) {
        frameId = requestAnimationFrame(flushPreview);
      }
    };

    const finishDrag = (phase: 'end' | 'cancel') => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      dispatchNodePreviewDrag(phase, pendingScreenDelta);
      if (element.hasPointerCapture(pointerId)) {
        element.releasePointerCapture(pointerId);
      }
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerCancel);
    };

    const handlePointerUp = () => finishDrag('end');
    const handlePointerCancel = () => finishDrag('cancel');

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerCancel);
  }, [dispatchNodePreviewDrag, isCanvasLocked]);

  const handleContinueFromPreview = useCallback((presetId: string) => {
    window.dispatchEvent(new CustomEvent('workflow:continue-from-preview-node', {
      detail: { nodeId: id, presetId },
    }));
  }, [id]);

  const handlePropertyPanelDataChange = useCallback((nodeId: string, nextData: Record<string, unknown>) => {
    window.dispatchEvent(new CustomEvent('workflow:update-node-data', {
      detail: { nodeId, data: nextData },
    }));
  }, []);

  const handlePropertyPanelDebug = useCallback((nodeId: string) => {
    if (isCanvasLocked || isBoundaryNode) return;
    window.dispatchEvent(new CustomEvent('workflow:debug-node', { detail: { nodeId } }));
  }, [isBoundaryNode, isCanvasLocked]);

  const handlePropertyPanelCancelDebug = useCallback(() => {
    window.dispatchEvent(new CustomEvent('workflow:cancel-debug-node', { detail: { nodeId: id } }));
  }, [id]);

  const handlePropertyPanelFieldKeyRename = useCallback<NonNullable<WorkflowNodeData['onFieldKeyRename']>>((params) => {
    nodeData.onFieldKeyRename?.(params);
  }, [nodeData.onFieldKeyRename]);
  const propertiesPanelNode = useMemo(() => ({
    id,
    type: workflowNodeType || 'unknown',
    label: displayLabel,
    position: { x: 0, y: 0 },
    data: sourceData,
    nodeState: currentNodeState,
    breakpoint: currentBreakpoint ?? undefined,
    nodeColor: typeof nodeData.nodeColor === 'string' ? nodeData.nodeColor : undefined,
  }), [currentBreakpoint, currentNodeState, displayLabel, id, sourceData, nodeData.nodeColor, workflowNodeType]);

  const {
    propertyModeLeftHandles,
    propertyModeRightHandles,
    propertyModeHiddenHandles,
    renderBadgeHandle: renderPropertyModeBadgeHandle,
  } = useWorkflowNodePropertyMode({
    id,
    canShowPropertyNodeView: canShowPropertyBadgeHandles,
    inputFields,
    outputFields,
    propertyFields,
    workflowNodeType,
    collapsedOutputKeys,
    workflowNodes: variableContext.nodes,
    connectionState,
    propertyModeBadgePosition,
    handleCtx,
    floatingHandleClassName,
    toggleOutputHandleCollapsed,
    openHandleColorMenu,
    renderHandleColorPopover,
  });

  const nodeBody = (
    <div
      ref={nodeBodyRef}
      className={`workflow-node-body border cursor-pointer relative flex flex-col overflow-visible rounded-[1.75rem]
        transition-[color,background-color,border-color,box-shadow,transform] duration-[220ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]
        hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-[0_12px_24px_-6px_rgba(20,21,23,0.08)]
        ${statusColor} ${selected ? 'outline-2 outline-offset-[3px] outline-foreground' : ''}
        ${floatingHandles ? 'workflow-node-has-floating-handles' : ''}
        ${selected || canShowPropertyBadgeHandles ? 'workflow-node-floating-handles-visible' : ''}
        ${!showFullNode ? WORKFLOW_NODE_DRAG_HANDLE_CLASS : ''}
        ${nodeData.isRunning ? 'workflow-node-running-pulse' : ''}
        ${stateBackgroundClass}`}
      style={{
        minWidth: isNodeCollapsed ? COLLAPSED_NODE_SIZE : isIconMode ? ICON_MODE_NODE_SIZE : nodeMinWidth,
        minHeight: isNodeCollapsed ? COLLAPSED_NODE_SIZE : isIconMode ? ICON_MODE_NODE_SIZE : nodeMinHeight,
        width: displayNodeWidth,
        height: displayNodeHeight,
      }}
    >
      {isCurrentNodeDebugging && (
        <BorderGlide
          className="absolute inset-0 z-20 rounded-[1.75rem] pointer-events-none"
          duration={2200}
          color="#22c55e"
          width="1.75rem"
          height="1.75rem"
          opacity={0.75}
          rx="1.75rem"
          ry="1.75rem"
        >
          <div className="h-full w-full" />
        </BorderGlide>
      )}
      {showFullNode && selected && !isIconMode ? (
        <button
          type="button"
          className="nodrag nopan absolute -left-2 -top-2 z-30 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background/95 text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
          title={isNodeCollapsed ? t('nodeUi.expand') : t('nodeUi.collapse')}
          aria-label={isNodeCollapsed ? t('nodeUi.expand') : t('nodeUi.collapse')}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsNodeCollapsed(prev => !prev);
          }}
        >
          {isNodeCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
      ) : null}

      <NodeBodyTargetHandles
        showTargetHandle={showTargetHandle}
        isTargetConnectable={isTargetConnectable}
        canShowPropertyNodeView={canShowPropertyBadgeHandles}
        isStartNode={isStartNode}
        inputFields={inputFields}
        propertyFields={propertyFields}
        outputFields={outputFields}
        handlePositions={handlePositions}
        handleCtx={handleCtx}
        floatingHandleClassName={floatingHandleClassName}
        getTargetHandleStyle={getTargetHandleStyle}
      />

      <NodeBodyCornerControls
        showFullNode={showFullNode}
        selected={selected}
        isCanvasLocked={!!isCanvasLocked}
        isNodeCollapsed={isNodeCollapsed}
        isIconMode={isIconMode}
        hasCustomView={hasCustomView}
        isLoopBody={isLoopBody}
        canShowPropertyNodeView={canShowPropertyNodeView}
        onCustomViewDragPointerDown={handleCustomViewDragPointerDown}
        onResizePointerDown={handleResizePointerDown}
      />

      <NodeBodyBadges
        showFullNode={showFullNode}
        stateBadge={stateBadge}
        breakpointBadge={breakpointBadge}
        currentNodeState={currentNodeState}
        currentBreakpoint={currentBreakpoint}
        isPausedAtThisNode={isPausedAtThisNode}
        onResumeFromBreakpoint={actions.handleResumeFromBreakpoint}
        onStopAtBreakpoint={actions.handleStopAtBreakpoint}
      />

      <NodeBodyIcons
        showFullNode={showFullNode}
        isNodeCollapsed={isNodeCollapsed}
        iconDefinition={iconDefinition}
      />

      {/* 图标模式：纯图标卡片（固定尺寸） */}
      {isIconMode ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-3">
          <WorkflowNodeDefinitionIcon definition={iconDefinition} className="h-9 w-9 text-muted-foreground" />
          <span className="w-full truncate text-center text-[11px] font-semibold leading-tight text-foreground" title={displayLabel}>
            {displayLabel}
          </span>
        </div>
      ) : null}

      {/* Header */}
      {canShowNodeContent && !isLoopBody && !hasCustomView && !canShowPropertyNodeView && (
        <NodeBodyHeader
          iconDefinition={iconDefinition}
          isEditing={isEditing}
          editLabel={editLabel}
          displayLabel={displayLabel}
          currentNodeState={currentNodeState}
          inputRef={inputRef}
          isFirstConnectedNode={!!nodeData.isFirstConnectedNode}
          isBoundaryNode={isBoundaryNode}
          isPreview={nodeData.isPreview === true}
          isExecutionBusy={isExecutionBusy}
          isPartialTesting={isPartialTesting}
          selectedJsonPreset={selectedJsonPreset}
          onEditLabelChange={setEditLabel}
          onFinishEdit={finishEdit}
          onStartEdit={startEdit}
          onPartialTest={actions.handlePartialTest}
        />
      )}

      {canShowPropertyBadgeHandles ? (
        <>
          {propertyModeHiddenHandles.map((handle, index) => (
            <CompatibilityHandle
              key={`property-mode-hidden-${handle.id}`}
              handleId={handle.id}
              handleType={handle.type}
              position={handle.side === 'left' ? Position.Left : Position.Right}
              index={index}
              total={Math.max(1, propertyModeHiddenHandles.length)}
              handleCtx={handleCtx}
            />
          ))}
          {propertyModeLeftHandles.map((handle, index) => renderPropertyModeBadgeHandle(handle, index, propertyModeLeftHandles.length))}
          {propertyModeRightHandles.map((handle, index) => renderPropertyModeBadgeHandle(handle, index, propertyModeRightHandles.length))}
        </>
      ) : null}

      {canShowPropertyNodeView || keepPropertyContentMounted ? (
        <div className={cn(
          'relative min-h-0 flex-1 overflow-hidden rounded-[1.75rem]',
          (!canShowPropertyNodeView || !canShowNodeContent) && 'hidden',
        )}>
          {canShowNodeContent || keepPropertyContentMounted ? (
            <div
              ref={propertyContentRef}
              className="w-full min-w-0 overflow-x-hidden bg-background"
              data-workflow-property-content="true"
              onWheelCapture={(event) => {
                if (event.ctrlKey || event.metaKey) return;
                event.stopPropagation();
              }}
            >
              <WorkflowPropertiesPanel
                node={propertiesPanelNode}
                nodes={variableContext.nodes}
                edges={variableContext.edges}
                variableContextWorkflow={variableContext}
                isPreview={nodeData.isPreview === true}
                onUpdateData={handlePropertyPanelDataChange}
                onPreviewUpdateData={handlePropertyPanelDataChange}
                onFieldKeyRename={handlePropertyPanelFieldKeyRename}
                debugNodeId={typeof nodeData.debugNodeId === 'string' ? nodeData.debugNodeId : null}
                debugStatus={nodeData.debugStatus}
                onDebugNode={handlePropertyPanelDebug}
                onCancelDebug={handlePropertyPanelCancelDebug}
                dragHandleClassName={WORKFLOW_NODE_DRAG_HANDLE_CLASS}
                contentScrollable={false}
                usePopoverSelect
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {canShowNodeContent && canShowVariableReferences && !canShowPropertyNodeView ? (
        <div className="flex w-full min-w-0 flex-wrap gap-1 overflow-hidden px-3 py-1.5">
          {variableReferences.map(reference => (
            <VariableBadgeInput
              key={reference}
              value={reference}
              readOnly
              showClear={false}
              className="min-w-0 max-w-full flex-none px-0"
              badgeClassName="h-4 max-w-full rounded px-1.5 text-[9px] font-normal"
              variableContext={variableContext}
              onClear={() => undefined}
            />
          ))}
        </div>
      ) : null}

      {keepCustomViewMounted && CustomView ? (
        <div className={cn(
          'absolute inset-0 overflow-hidden rounded-lg',
          (!showFullNode || isIconMode) && 'pointer-events-none opacity-0',
          isLoopBody && 'pointer-events-none',
        )}>
          <CustomView
            nodeId={id}
            data={customViewData}
            isRunning={nodeData.isRunning === true}
            isPreview={nodeData.isPreview === true}
          />
        </div>
      ) : null}

      {keepCustomViewMounted && pluginCustomView ? (
        <div className={cn(
          'absolute inset-0 overflow-hidden rounded-lg',
          (!showFullNode || isIconMode) && 'pointer-events-none opacity-0',
          isLoopBody && 'pointer-events-none',
        )}>
          <PluginWorkflowCustomView
            nodeId={id}
            data={customViewData}
            isRunning={nodeData.isRunning === true}
            isPreview={nodeData.isPreview === true}
            view={pluginCustomView}
          />
        </div>
      ) : null}

      <NodeBodySourceHandles
        showSourceHandle={showSourceHandle}
        canShowNodeContent={canShowNodeContent}
        dynamicHandles={dynamicHandles}
        staticSourceHandles={staticSourceHandles}
        handlePositions={handlePositions}
        handleCtx={handleCtx}
        floatingHandleClassName={floatingHandleClassName}
        floatingLabelClassName={floatingLabelClassName}
        getSourceHandleStyle={getSourceHandleStyle}
        openHandleColorMenu={openHandleColorMenu}
        renderHandleColorPopover={renderHandleColorPopover}
      />
    </div>
  );

  const hoverCardPanel = embeddedMode === 'issue' && !isLoopBody ? (
    <HoverCard openDelay={150} closeDelay={100}>
      <HoverCardTrigger render={nodeBody} />
      <HoverCardContent
        side="right"
        align="start"
        sideOffset={10}
        className="w-[440px] max-w-[min(440px,calc(100vw-2rem))] p-0"
      >
        <div className="max-h-[70vh] overflow-y-auto">
          <WorkflowPropertiesPanel
            node={propertiesPanelNode}
            nodes={variableContext.nodes}
            edges={variableContext.edges}
            variableContextWorkflow={variableContext}
            isPreview={nodeData.isPreview === true}
            onUpdateData={(_nodeId, _data) => undefined}
            onPreviewUpdateData={(_nodeId, _data) => undefined}
            debugNodeId={typeof nodeData.debugNodeId === 'string' ? nodeData.debugNodeId : null}
            debugStatus={nodeData.debugStatus}
            contentScrollable={false}
            usePopoverSelect
            readOnly
          />
        </div>
      </HoverCardContent>
    </HoverCard>
  ) : null;

  return (
    <>
      <WorkflowNodeToolbar
        visible={showFullNode && canShowNodeToolbar}
        isNodeCollapsed={isNodeCollapsed}
        isStartNode={isStartNode}
        isBoundaryNode={isBoundaryNode}
        isExecutionBusy={isExecutionBusy}
        isCurrentNodeDebugging={isCurrentNodeDebugging}
        showPartialTest={canShowPropertyNodeView && !!nodeData.isFirstConnectedNode && !isBoundaryNode && nodeData.isPreview !== true}
        isPartialTesting={isPartialTesting}
        canDeleteNode={canDeleteNode}
        isDeleteDisabled={isDeleteDisabled}
        canContinueFromPreview={canContinueFromPreview}
        anchorMode={canShowPropertyNodeView || isIconMode ? 'node-width' : 'center'}
        nodeWidth={displayNodeWidth}
        canvasZoom={canvasZoom || 1}
        onExecuteWorkflow={actions.handleExecuteWorkflow}
        onTestNode={actions.handleTestNode}
        onPartialTest={actions.handlePartialTest}
        onDelete={actions.handleDeleteWithoutReconnect}
        onContinueFromPreview={handleContinueFromPreview}
      />
      <WorkflowNodeContextMenu
        nodeId={id}
        selectedNodeIds={selectedNodeIds}
        isDeleteProtected={!canDeleteNode}
        isCanvasLocked={!!isCanvasLocked}
        style={{ width: displayNodeWidth, height: displayNodeHeight }}
        onSetColor={actions.setNodeColor}
        onSetState={actions.setNodeState}
        onSetBreakpoint={actions.setNodeBreakpoint}
        onShowInfo={actions.handleShowInfo}
        onCopy={actions.handleCopy}
        onClone={actions.handleClone}
        onStage={actions.handleStage}
        onMoveToStage={actions.handleMoveToStage}
        onDelete={actions.handleDelete}
        onMergeToWorkflow={actions.handleMergeToWorkflow}
        onMergeToGroup={actions.handleMergeToGroup}
        onBatchDelete={actions.handleBatchDelete}
      >
        {hoverCardPanel ?? nodeBody}
      </WorkflowNodeContextMenu>

      {/* Collapsible execution log card below the node */}
      {!isNodeCollapsed && canShowExecutionLog && displayExecutionStep ? (
        <WorkflowNodeExecutionLog
          nodeId={id}
          executionStep={displayExecutionStep}
          executionSteps={Array.isArray(nodeData.executionSteps) ? nodeData.executionSteps : undefined}
          nodeType={workflowNodeType}
          loopExecutionScopeId={nodeData.loopExecutionScopeId}
          data={getRecordValue(nodeData[EXECUTION_DATA_KEY] ?? nodeData.executionLogData)}
          inputFields={Array.isArray(nodeData[EXECUTION_INPUT_FIELDS_KEY])
            ? nodeData[EXECUTION_INPUT_FIELDS_KEY]
            : Array.isArray(nodeData.inputFields) ? nodeData.inputFields : []}
          outputs={Array.isArray(nodeData[EXECUTION_OUTPUTS_KEY])
            ? nodeData[EXECUTION_OUTPUTS_KEY]
            : Array.isArray(nodeData.outputs) ? nodeData.outputs : []}
          nodeWidth={displayNodeWidth}
          layout={logPanelLayout}
          isIconMode={isIconMode}
          isLogExpanded={isLogExpanded}
          showOutputPreview={nodeData.outputPreviewEnabled !== false}
          onToggleLog={() => setIsLogExpanded(prev => !prev)}
        />
      ) : null}

      <style>{`
        .handle-dot { transition: scale 0.2s ease, box-shadow 0.2s ease; }
        .handle-dot:hover { scale: 1.6; box-shadow: 0 0 6px currentColor; }
        /* 运行中节点：外扩脉冲（workflow_automation_ui nodePulse） */
        @keyframes workflow-node-pulse {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.45); }
          70% { box-shadow: 0 0 0 14px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        .workflow-node-running-pulse { animation: workflow-node-pulse 1s infinite; }
        /* 拖拽中的节点卡片：放大 + 抬升阴影 */
        .react-flow__node.dragging .workflow-node-body {
          transform: scale(1.05);
          box-shadow: 0 18px 34px -8px rgba(20, 21, 23, 0.16);
          z-index: 40;
        }
        .workflow-node-floating-handle,
        .workflow-node-floating-handle-label {
          opacity: 0;
          transition: opacity 0.16s ease, scale 0.2s ease, box-shadow 0.2s ease;
        }
        .workflow-node-has-floating-handles:hover .workflow-node-floating-handle,
        .workflow-node-has-floating-handles:hover .workflow-node-floating-handle-label,
        .workflow-node-floating-handles-visible .workflow-node-floating-handle,
        .workflow-node-floating-handles-visible .workflow-node-floating-handle-label,
        .workflow-canvas-show-floating-handles .workflow-node-floating-handle,
        .workflow-canvas-show-floating-handles .workflow-node-floating-handle-label {
          opacity: 1;
        }
        .workflow-node-floating-handle .react-flow__handle {
          width: auto;
          height: auto;
        }
        .react-flow.touch-flow .react-flow__handle.handle-dot {
          width: 20px !important;
          height: 20px !important;
        }
        .touch-flow .react-flow__handle-right {
          --translate: translate(50%, -50%);
        }
        .touch-flow .react-flow__handle-left {
          --translate: translate(-50%, -50%);
        }
        @keyframes workflow-touch-handle-bounce {
          0% {
            transform: var(--translate) scale(1);
          }
          50% {
            transform: var(--translate) scale(1.1);
          }
        }
        .react-flow.touch-flow .react-flow__handle.clickconnecting {
          animation: workflow-touch-handle-bounce 1600ms infinite ease-in;
        }
        .source-handle-label { position: absolute; display: flex; align-items: center; pointer-events: none; }
      `}</style>
    </>
  );
}

export const WorkflowNode = React.memo(WorkflowNodeComponent, areWorkflowNodePropsEqual);