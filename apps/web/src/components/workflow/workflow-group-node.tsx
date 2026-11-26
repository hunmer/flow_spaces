'use client';

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronRight, ListChecks, Lock, Unlock, Trash2 } from 'lucide-react';
import type { WorkflowGroup } from '@flow-spaces/shared';
import { ColorPicker } from '@/components/ui/color-picker';
import { WorkflowAutoLayoutMenu, type WorkflowAutoLayoutOptions } from './workflow-auto-layout-menu';

/**
 * 从屏幕坐标找到落点处的 ReactFlow 节点 id。
 * 节点 DOM 形如 `<div class="react-flow__node ..." data-id="<nodeId>">`，
 * 用 elementsFromPoint 取落点处所有元素，向上找最近的带 data-id 的 react-flow__node。
 * 跳过 group 自身（group 是 overlay，不是 ReactFlow 节点，没有 data-id，天然不会被命中）。
 */
function getNodeAtScreenPoint(x: number, y: number): string | null {
  const els = document.elementsFromPoint(x, y);
  for (const el of els) {
    if (!(el instanceof Element)) continue;
    const nodeEl = el.closest('.react-flow__node[data-id]') as (Element & { getAttribute: (n: string) => string | null }) | null;
    if (nodeEl) {
      const id = nodeEl.getAttribute('data-id');
      if (id) return id;
    }
  }
  return null;
}

interface GroupConnectTarget {
  element: HTMLElement;
  kind: 'group' | 'node';
  id: string;
  x: number;
  y: number;
  handleId?: string | null;
}

/** 使用屏幕坐标计算最近输入点，吸附距离不受画布缩放影响。 */
function getConnectTargetAtScreenPoint(
  x: number, y: number, radius: number, root: ParentNode, excludedIds: Set<string>,
): GroupConnectTarget | null {
  let closest: GroupConnectTarget | null = null;
  let closestDistance = Math.max(0, radius);
  const handles = root.querySelectorAll<HTMLElement>(
    '[data-group-connect-id]:not(:disabled), .react-flow__handle.target.connectable.connectableend',
  );
  for (const element of handles) {
    const groupId = element.dataset.groupConnectId;
    const id = groupId || element.closest('.react-flow__node[data-id]')?.getAttribute('data-id');
    if (!id || excludedIds.has(id)) continue;
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distance = Math.hypot(x - centerX, y - centerY);
    if (distance > closestDistance) continue;
    closestDistance = distance;
    closest = { element, kind: groupId ? 'group' : 'node', id, x: centerX, y: centerY, handleId: element.getAttribute('data-handleid') };
  }
  return closest;
}

/**
 * GroupNode — visual container overlay for grouping nodes on the canvas.
 * Rendered as an absolute-positioned div behind child nodes.
 */

interface GroupOverlayProps {
  group: WorkflowGroup;
  childNodes: Array<{ id: string; position: { x: number; y: number }; width?: number; height?: number }>;
  collapsed: boolean;
  isSelected: boolean;
  isDropTarget: boolean;
  onCollapsedChange: (groupId: string, collapsed: boolean) => void;
  onSelect: (groupId: string) => void;
  onSelectNodes?: (groupId: string) => void;
  headerRight?: React.ReactNode;
  onDelete: (groupId: string) => void;
  onUpdate: (groupId: string, updates: Partial<WorkflowGroup>) => void;
  onMove: (groupId: string, delta: { x: number; y: number }, options?: { pushUndo?: boolean }) => void;
  onAutoLayout?: (direction: 'LR' | 'TB', options?: WorkflowAutoLayoutOptions) => void;
  layoutEngine?: string;
  onDragPreviewChange?: (preview: {
    groupId: string;
    bounds: { x: number; y: number; width: number; height: number };
    delta: { x: number; y: number };
  } | null) => void;
  screenDeltaToFlowDelta: (delta: { x: number; y: number }) => { x: number; y: number };
  /** 默认关闭；开启后显示左侧输入和右侧输出连接点。 */
  handlesEnabled?: boolean;
  /** 执行期间可禁用连接点，保留其显示。 */
  handlesDisabled?: boolean;
  /** 屏幕像素单位，与节点拖线一样靠近后吸附，松手完成连接。 */
  connectionRadius?: number;
  /** 输出拖到组外节点时，由调用方连接分组输出。 */
  onConnect?: (groupId: string, targetNodeId: string, targetHandle?: string | null) => void;
  /** 输入接收上游分组输出，由接收方绑定 GroupExecution 输入。 */
  onReceiveConnect?: (targetGroupId: string, sourceGroupId: string) => void;
  /** 兼容调用方从输出侧处理组间连接。 */
  onConnectGroup?: (sourceGroupId: string, targetGroupId: string) => void;
}

const GROUP_COLORS = [
  { name: '蓝色', bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.3)', header: 'rgba(59,130,246,0.1)' },
  { name: '绿色', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.3)', header: 'rgba(16,185,129,0.1)' },
  { name: '紫色', bg: 'rgba(139,92,246,0.06)', border: 'rgba(139,92,246,0.3)', header: 'rgba(139,92,246,0.1)' },
  { name: '橙色', bg: 'rgba(249,115,22,0.06)', border: 'rgba(249,115,22,0.3)', header: 'rgba(249,115,22,0.1)' },
  { name: '粉色', bg: 'rgba(236,72,153,0.06)', border: 'rgba(236,72,153,0.3)', header: 'rgba(236,72,153,0.1)' },
];

function isCustomGroupColor(color?: string): color is string {
  return /^#[0-9a-f]{6}$/i.test(color || '');
}

function getGroupColor(color?: string) {
  const preset = GROUP_COLORS.find(c => c.name === color);
  if (preset) return preset;
  if (!isCustomGroupColor(color)) return GROUP_COLORS[0];
  return { name: '自定义', bg: `${color}0f`, border: `${color}4d`, header: `${color}1a` };
}

export function WorkflowGroupOverlay({
  group, childNodes, collapsed, isSelected, isDropTarget,
  onCollapsedChange, onSelect, onDelete, onUpdate, onMove, onAutoLayout, layoutEngine, onDragPreviewChange, screenDeltaToFlowDelta,
  handlesEnabled = false, handlesDisabled = false, connectionRadius = 20, onConnect, onReceiveConnect, onConnectGroup, onSelectNodes, headerRight,
}: GroupOverlayProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const t = useTranslations('workflows.group');
  const isDraggingRef = useRef(false);
  const inputHandleRef = useRef<HTMLButtonElement>(null);
  const connectDisabled = handlesDisabled || group.locked;

  React.useEffect(() => {
    const handle = inputHandleRef.current;
    if (!handlesEnabled || connectDisabled || !handle || !onReceiveConnect) return;
    const receive = (event: Event) => {
      const { sourceGroupId } = (event as CustomEvent<{ sourceGroupId: string }>).detail;
      if (sourceGroupId === group.id) return;
      event.preventDefault();
      onReceiveConnect(group.id, sourceGroupId);
    };
    handle.addEventListener('workflow-group-connect', receive);
    return () => handle.removeEventListener('workflow-group-connect', receive);
  }, [handlesEnabled, connectDisabled, group.id, onReceiveConnect]);
  const colors = getGroupColor(group.color);
  const layoutNodeIds = useMemo(() => childNodes.map(node => node.id), [childNodes]);

  const bounds = useMemo(() => {
    if (childNodes.length === 0) {
      return { x: group.x ?? 50, y: group.y ?? 50, width: group.width ?? 300, height: group.height ?? 200 };
    }
    const padding = 30;
    const headerHeight = 28;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of childNodes) {
      minX = Math.min(minX, node.position.x - padding);
      minY = Math.min(minY, node.position.y - headerHeight - padding);
      maxX = Math.max(maxX, node.position.x + (node.width || 200) + padding);
      maxY = Math.max(maxY, node.position.y + (node.height || 100) + padding);
    }
    return {
      x: minX,
      y: minY,
      width: Math.max(200, maxX - minX),
      height: collapsed ? headerHeight + padding : Math.max(100, maxY - minY),
    };
  }, [childNodes, collapsed, group.x, group.y, group.width, group.height]);

  React.useEffect(() => {
    // console.debug('[WorkflowGroupBoundsDebug] render group bounds', {
    //   groupId: group.id,
    //   storedBounds: {
    //     x: group.x,
    //     y: group.y,
    //     width: group.width,
    //     height: group.height,
    //   },
    //   renderedBounds: bounds,
    //   childNodes,
    // });
  }, [bounds, childNodes, group.height, group.id, group.width, group.x, group.y]);

  const handleToggleCollapse = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onCollapsedChange(group.id, !collapsed);
  }, [collapsed, group.id, onCollapsedChange]);

  const handleToggleLock = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate(group.id, { locked: !group.locked });
  }, [group.id, group.locked, onUpdate]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as Element;
    // Header captures the pointer while dragging. After capture, the browser
    // may dispatch dblclick on the header instead of the name span.
    if (target.closest('button,input')) return;
    e.stopPropagation();
    setEditName(group.name);
    setIsEditing(true);
  }, [group.name]);

  const finishEdit = useCallback(() => {
    setIsEditing(false);
    if (editName !== group.name) {
      onUpdate(group.id, { name: editName });
    }
  }, [editName, group.name, group.id, onUpdate]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(group.id);
  }, [group.id, onDelete]);

  const stopButtonPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
  }, []);

  const handleHeaderPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (group.locked || isEditing) return;
    const target = event.target as Element;
    if (target.closest('button,input')) return;
    // 放行 ReactFlow 的连线手柄 / 调整大小手柄：否则 header 的 pointer-events-auto 区域
    // 会劫持落在这些控件上的 pointerdown，导致拖 handle 变成拖整组（尤其子节点为图片展示节点、
    // Handle 位于 header 覆盖区域时）。
    if (target.closest('.react-flow__handle, .react-flow__resize-control')) return;

    event.preventDefault();
    event.stopPropagation();
    onSelect(group.id);

    let last = { x: event.clientX, y: event.clientY };
    let frameId: number | null = null;
    let totalFlowDelta = { x: 0, y: 0 };
    let pendingPreviewDelta = { x: 0, y: 0 };
    const pointerId = event.pointerId;
    const element = event.currentTarget;
    isDraggingRef.current = true;
    onDragPreviewChange?.({ groupId: group.id, bounds, delta: { x: 0, y: 0 } });
    element.setPointerCapture(pointerId);

    const flushPreview = () => {
      frameId = null;
      onDragPreviewChange?.({ groupId: group.id, bounds, delta: pendingPreviewDelta });
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const screenDelta = {
        x: moveEvent.clientX - last.x,
        y: moveEvent.clientY - last.y,
      };
      const flowDelta = screenDeltaToFlowDelta(screenDelta);
      last = { x: moveEvent.clientX, y: moveEvent.clientY };
      if (screenDelta.x === 0 && screenDelta.y === 0) return;
      totalFlowDelta = {
        x: totalFlowDelta.x + flowDelta.x,
        y: totalFlowDelta.y + flowDelta.y,
      };
      pendingPreviewDelta = totalFlowDelta;
      if (frameId === null) {
        frameId = requestAnimationFrame(flushPreview);
      }
    };

    const finishDrag = (applyMove: boolean) => {
      isDraggingRef.current = false;
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      onDragPreviewChange?.(null);
      if (element.hasPointerCapture(pointerId)) {
        element.releasePointerCapture(pointerId);
      }
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerCancel);
      if (applyMove && (totalFlowDelta.x !== 0 || totalFlowDelta.y !== 0)) {
        onMove(group.id, totalFlowDelta);
      }
    };

    const handlePointerUp = () => finishDrag(true);
    const handlePointerCancel = () => finishDrag(false);

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerCancel);
  }, [bounds, group.id, group.locked, isEditing, onDragPreviewChange, onMove, onSelect, screenDeltaToFlowDelta]);

  // —— 分组输出连线手柄：拖拽到某节点松手后，onConnect 回调由调用方建边 ——
  // group 不是 ReactFlow 节点，无法用 <Handle>，这里自实现 pointer 拖拽：
  // pointerdown 时阻止冒泡（不触发分组移动）并 setPointerCapture 锁定后续事件，
  // pointerup 时用 elementsFromPoint 找落点节点 id，命中非组内节点则 onConnect。
  const [connectDrag, setConnectDrag] = useState<{ x: number; y: number } | null>(null);
  const connectStartRef = useRef<{ x: number; y: number } | null>(null);
  const connectCleanupRef = useRef<(() => void) | null>(null);
  React.useEffect(() => () => connectCleanupRef.current?.(), []);
  React.useEffect(() => {
    if (!handlesEnabled || connectDisabled) connectCleanupRef.current?.();
  }, [handlesEnabled, connectDisabled]);

  const handleConnectPointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (!handlesEnabled || connectDisabled || event.button !== 0) return;
    connectCleanupRef.current?.();
    event.preventDefault();
    event.stopPropagation();
    const pointerId = event.pointerId;
    const element = event.currentTarget;
    console.info('[GroupConnectDebug] drag start', { groupId: group.id, connectionRadius });
    element.setPointerCapture(pointerId);
    const root = element.closest('.react-flow') || document;
    const excludedIds = new Set([group.id, ...group.childNodeIds]);
    const findTarget = (x: number, y: number) => (
      getConnectTargetAtScreenPoint(x, y, connectionRadius, root, excludedIds)
    );
    const rect = element.getBoundingClientRect();
    connectStartRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    setConnectDrag({ x: event.clientX, y: event.clientY });

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const target = findTarget(moveEvent.clientX, moveEvent.clientY);
      setConnectDrag(target
        ? { x: target.x, y: target.y }
        : { x: moveEvent.clientX, y: moveEvent.clientY });
    };
    const cleanup = () => {
      if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerCancel);
      connectCleanupRef.current = null;
      setConnectDrag(null);
    };
    const handlePointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      cleanup();
      const target = findTarget(upEvent.clientX, upEvent.clientY);
      console.info('[GroupConnectDebug] drop', { groupId: group.id, targetId: target?.id, kind: target?.kind, targetHandle: target?.handleId, x: upEvent.clientX, y: upEvent.clientY });
      if (target?.kind === 'group') {
        const receiveEvent = new CustomEvent('workflow-group-connect', {
          detail: { sourceGroupId: group.id }, cancelable: true,
        });
        if (target.element.dispatchEvent(receiveEvent)) onConnectGroup?.(group.id, target.id);
        return;
      }
      if (target?.kind === 'node') {
        onConnect?.(group.id, target.id, target.handleId);
        return;
      }
      const targetId = getNodeAtScreenPoint(upEvent.clientX, upEvent.clientY);
      if (targetId && targetId !== group.id && !group.childNodeIds.includes(targetId)) {
        onConnect?.(group.id, targetId);
      }
    };
    const handlePointerCancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId === pointerId) cleanup();
    };
    connectCleanupRef.current = cleanup;
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerCancel);
  }, [handlesEnabled, connectDisabled, connectionRadius, group.id, group.childNodeIds, onConnect, onConnectGroup]);

  return (
    <div
      data-workflow-group-id={group.id}
      className={`pointer-events-none absolute transition-shadow ${isSelected ? 'ring-2 ring-primary ring-offset-1' : ''}`}
      style={{
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
        backgroundColor: colors.bg,
        border: `2px ${isDropTarget ? 'solid' : 'dashed'} ${isSelected || isDropTarget ? 'var(--primary)' : colors.border}`,
        boxShadow: isDropTarget ? '0 0 0 2px color-mix(in srgb, var(--primary) 25%, transparent)' : undefined,
        borderRadius: 8,
        overflow: handlesEnabled ? 'visible' : 'hidden',
        zIndex: 0,
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(group.id); }}
    >
      <div
        className={`pointer-events-auto rounded-t-md flex h-10 select-none items-center gap-1 px-2 pb-2 backdrop-blur-sm ${group.locked ? 'cursor-default' : 'cursor-move'}`}
        style={{ backgroundColor: colors.header }}
        onPointerDown={handleHeaderPointerDown}
        onDoubleClick={handleDoubleClick}
      >
        <button className="p-0 hover:bg-black/5 rounded" onPointerDown={stopButtonPointerDown} onClick={handleToggleCollapse}>
          {collapsed
            ? <ChevronRight className="h-3 w-3 text-muted-foreground" />
            : <ChevronDown className="h-3 w-3 text-muted-foreground" />
          }
        </button>

        {isEditing ? (
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={finishEdit}
            onKeyDown={(e) => { if (e.key === 'Enter') finishEdit(); }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 text-[10px] bg-transparent outline-none border-b border-primary min-w-0"
            autoFocus
          />
        ) : (
          <span
            className="text-[10px] font-medium truncate flex-1"
          >
            {group.name || t('unnamed')}
          </span>
        )}

        {headerRight && (
          <div
            className="flex shrink-0 items-center"
            onPointerDown={stopButtonPointerDown}
            onClick={(event) => event.stopPropagation()}
          >
            {headerRight}
          </div>
        )}

        <div className="flex items-center gap-0.5">
            {GROUP_COLORS.map(c => (
              <button
                key={c.name}
                className={`size-2 rounded-full shrink-0 border transition-all ${
                  group.color === c.name ? 'border-foreground/80 scale-125' : 'border-transparent hover:scale-110'
                }`}
                style={{ backgroundColor: c.border }}
                onPointerDown={stopButtonPointerDown}
                onClick={(e) => { e.stopPropagation(); onUpdate(group.id, { color: c.name }); }}
              />
            ))}
            <div title={t('customColor')}>
              <ColorPicker
                colors={[]}
                value={isCustomGroupColor(group.color) ? group.color : ''}
                onChange={(color) => onUpdate(group.id, { color })}
                className="gap-0 [&>button]:size-2.5 [&>button]:border [&>button>span]:text-[8px]"
              />
            </div>
            <div className="mx-0.5 h-3 w-px bg-border/50" />
            {onSelectNodes && (
              <button
                type="button"
                title={t('selectAll')}
                className="flex size-5 items-center justify-center rounded p-0 hover:bg-black/10"
                onPointerDown={stopButtonPointerDown}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectNodes(group.id);
                }}
              >
                <ListChecks className="size-3 text-muted-foreground" />
              </button>
            )}
            <WorkflowAutoLayoutMenu
              onAutoLayout={onAutoLayout}
              layoutEngine={layoutEngine}
              nodeIds={layoutNodeIds}
              disabled={group.locked || layoutNodeIds.length === 0}
              buttonClassName="size-5 p-0 hover:bg-black/10 rounded"
              iconClassName="size-3 text-muted-foreground"
            />
            <button className="flex size-5 items-center justify-center rounded p-0 hover:bg-black/10" onPointerDown={stopButtonPointerDown} onClick={handleToggleLock}>
              {group.locked
                ? <Lock className="size-3 text-orange-500" />
                : <Unlock className="size-3 text-muted-foreground" />
              }
            </button>
            <button className="flex size-5 items-center justify-center rounded p-0 hover:bg-black/10" onPointerDown={stopButtonPointerDown} onClick={handleDelete}>
              <Trash2 className="size-3 text-destructive" />
            </button>

        </div>
      </div>
      {handlesEnabled && (
        <>
          <button
            ref={inputHandleRef}
            type="button"
            aria-label={t('inputHandle')}
            title={t('inputHandle')}
            data-group-connect-id={group.id}
            disabled={connectDisabled || !onReceiveConnect && !onConnectGroup}
            onPointerDown={stopButtonPointerDown}
            onClick={(event) => event.stopPropagation()}
            className="nodrag nopan pointer-events-auto absolute size-5 rounded-full border-2 border-background-primary-default bg-notification-information-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:pointer-events-none disabled:opacity-40"
            style={{ left: 0, top: 0, transform: 'translate(-50%, -50%)' }}
          />
          <button
            type="button"
            aria-label={t('connectTooltip')}
            title={t('connectTooltip')}
            disabled={connectDisabled}
            onPointerDown={handleConnectPointerDown}
            onClick={(event) => event.stopPropagation()}
            className="nodrag nopan pointer-events-auto absolute size-5 cursor-crosshair rounded-full border-2 border-background-primary-default bg-notification-success-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:pointer-events-none disabled:opacity-40"
            style={{ right: 0, top: 0, transform: 'translate(50%, -50%)' }}
          />
        </>
      )}
      {/* 拖拽连线指示线：portal 到 body，避免被 group overlay 的 overflow:hidden / 父级 transform 裁剪。
          fixed 坐标用 connectDrag 屏幕坐标，SVG 直线连接手柄起始点和当前指针位置。 */}
      {connectDrag && connectStartRef.current && createPortal(
        (
          <svg className="pointer-events-none fixed inset-0 z-[9999] h-full w-full">
            <line
              x1={connectStartRef.current.x}
              y1={connectStartRef.current.y}
              x2={connectDrag.x}
              y2={connectDrag.y}
              stroke="var(--primary, hsl(var(--primary)))"
              strokeWidth={2}
              strokeDasharray="5,5"
            />
            <circle cx={connectDrag.x} cy={connectDrag.y} r={4} fill="var(--primary, hsl(var(--primary)))" />
          </svg>
        ),
        document.body,
      )}
    </div>
  );
}

// ---- Group management hook ----

export function useGroupManagement() {
  const [groups, setGroups] = useState<WorkflowGroup[]>([]);

  const addGroup = useCallback((name: string, color?: string, childNodeIds?: string[]) => {
    const group: WorkflowGroup = {
      id: `group_${Date.now()}`,
      name,
      color: color || '蓝色',
      childNodeIds: childNodeIds || [],
      childGroupIds: [],
      locked: false,
      disabled: false,
      savedNodeStates: {},
    };
    setGroups(prev => [...prev, group]);
    return group;
  }, []);

  const updateGroup = useCallback((id: string, updates: Partial<WorkflowGroup>) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
  }, []);

  const deleteGroup = useCallback((id: string) => {
    setGroups(prev => prev.filter(g => g.id !== id));
  }, []);

  const addNodeToGroup = useCallback((groupId: string, nodeId: string) => {
    setGroups(prev => prev.map(g =>
      g.id === groupId && !g.childNodeIds.includes(nodeId)
        ? { ...g, childNodeIds: [...g.childNodeIds, nodeId] }
        : g
    ));
  }, []);

  const removeNodeFromGroup = useCallback((nodeId: string) => {
    setGroups(prev => prev.map(g =>
      g.childNodeIds.includes(nodeId)
        ? { ...g, childNodeIds: g.childNodeIds.filter(id => id !== nodeId) }
        : g
    ));
  }, []);

  return { groups, setGroups, addGroup, updateGroup, deleteGroup, addNodeToGroup, removeNodeFromGroup };
}