import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface MiniAppLoadingState {
  fastLoading: boolean;
  overrides: Record<string, boolean>;
  setFastLoading: (enabled: boolean) => void;
  setAppFastLoading: (projectId: string, enabled: boolean | undefined) => void;
}

export function resolveMiniAppFastLoading(global: boolean, override?: boolean): boolean {
  return override ?? global;
}

export const useMiniAppLoadingStore = create<MiniAppLoadingState>()(persist((set) => ({
  fastLoading: import.meta.env?.PROD ?? false,
  overrides: {},
  setFastLoading: (fastLoading) => set({ fastLoading }),
  setAppFastLoading: (projectId, enabled) => set((state) => {
    const overrides = { ...state.overrides };
    if (enabled === undefined) delete overrides[projectId];
    else overrides[projectId] = enabled;
    return { overrides };
  }),
}), {
  name: 'flow-spaces:mini-app-loading',
  storage: createJSONStorage(() => localStorage),
  partialize: ({ fastLoading, overrides }) => ({ fastLoading, overrides }),
}));

export function useMiniAppFastLoading(projectId?: string): boolean {
  return useMiniAppLoadingStore((state) => resolveMiniAppFastLoading(
    state.fastLoading, projectId ? state.overrides[projectId] : undefined,
  ));
}

// 独立预览窗口同样响应设置页与其他窗口的偏好变更。
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === 'flow-spaces:mini-app-loading' || event.key === null) {
      void useMiniAppLoadingStore.persist.rehydrate();
    }
  });
}
