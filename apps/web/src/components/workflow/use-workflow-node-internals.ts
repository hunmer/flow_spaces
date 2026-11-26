import { useCallback, useMemo } from 'react';
import { useStoreApi, useUpdateNodeInternals } from '@xyflow/react';
import { createWorkflowFrameBatch } from './workflow-canvas-update-batch';

type InternalsBatch = ReturnType<typeof createWorkflowFrameBatch<undefined>>;

// 不同画布（包括嵌入编辑器）使用各自的 React Flow store，不能混合测量。
// useStoreApi 的包装对象每个 hook 都不同，getState 才是同一画布共享的稳定标识。
const batches = new WeakMap<ReturnType<typeof useStoreApi>['getState'], InternalsBatch>();

export function useWorkflowNodeInternals() {
  const store = useStoreApi();
  const updateNodeInternals = useUpdateNodeInternals();
  const batch = useMemo(() => {
    let existing = batches.get(store.getState);
    if (!existing) {
      existing = createWorkflowFrameBatch<undefined>((updates) => {
        updateNodeInternals(Array.from(updates.keys()));
      });
      batches.set(store.getState, existing);
    }
    return existing;
  }, [store, updateNodeInternals]);

  return useCallback((id: string) => batch.enqueue(id, undefined), [batch]);
}
