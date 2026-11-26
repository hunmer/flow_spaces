import type { Node } from '@xyflow/react';

/** 同一帧内每个节点只保留最后一次更新，避免逐节点通知整个画布。 */
export function createWorkflowFrameBatch<T>(
  flush: (updates: Map<string, T>) => void,
  requestFrame: (callback: FrameRequestCallback) => number = requestAnimationFrame,
  cancelFrame: (frame: number) => void = cancelAnimationFrame,
) {
  const pending = new Map<string, { value: T }>();
  let frame: number | null = null;

  const cancel = () => {
    if (frame !== null) cancelFrame(frame);
    frame = null;
    pending.clear();
  };

  const enqueue = (id: string, value: T) => {
    const entry = { value };
    pending.set(id, entry);
    if (frame === null) {
      frame = requestFrame(() => {
        frame = null;
        const updates = new Map(Array.from(pending, ([key, item]) => [key, item.value]));
        pending.clear();
        flush(updates);
      });
    }
    return () => {
      // 旧 effect 的清理不能删除同一节点刚排入的新更新。
      if (pending.get(id) !== entry) return;
      pending.delete(id);
      if (pending.size === 0) cancel();
    };
  };

  return { enqueue, cancel };
}

export function applyRuntimeNodeSizes(nodes: Node[], sizes: Map<string, { width: number; height: number }>): Node[] {
  if (sizes.size === 0) return nodes;

  let changed = false;
  const nextNodes = nodes.map((node) => {
    const size = sizes.get(node.id);
    const data = node.data as Record<string, unknown> | undefined;
    if (!size || data?.nodeDisplayMode !== 'properties') return node;
    if (
      node.width === size.width
      && node.height === size.height
      && node.initialWidth === size.width
      && node.initialHeight === size.height
      && node.measured?.width === size.width
      && node.measured?.height === size.height
    ) {
      return node;
    }

    changed = true;
    return {
      ...node,
      width: size.width,
      height: size.height,
      initialWidth: size.width,
      initialHeight: size.height,
      measured: { width: size.width, height: size.height },
      style: {
        ...node.style,
        width: size.width,
        height: size.height,
      },
      data: {
        ...data,
        width: size.width,
        height: size.height,
      },
    };
  });

  return changed ? nextNodes : nodes;
}
