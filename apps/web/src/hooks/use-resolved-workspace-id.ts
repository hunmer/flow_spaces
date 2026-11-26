'use client';

import { useEffect, useState } from 'react';
import { sdk } from '@/lib/sdk';
import { useWorkspaceStore } from '@/stores/workspace';

/**
 * Resolve the workspace id used to open execution WS channels in the workflow editor.
 *
 * - Workspace store already populated (host embedding): keep existing behavior,
 *   use the first workspace id.
 * - Store empty: fetch workspaces from the server once. If the server has any,
 *   populate the store (so the whole app benefits); if none exist (standalone
 *   deployment ships zero workspaces) or the request fails, fall back to the
 *   shared 'workflows' pseudo channel — the same channel the workflow share
 *   page already uses for execution events.
 * - While resolving, returns undefined (same as the previous always-undefined
 *   behavior, so nothing regresses during the short loading window).
 */
export function useResolvedWorkspaceId(): string | undefined {
  const storedWorkspaces = useWorkspaceStore((store) => store.workspaces);
  const setWorkspaces = useWorkspaceStore((store) => store.setWorkspaces);
  // undefined = still resolving; null = resolved as "no workspaces available"
  const [fallback, setFallback] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (storedWorkspaces.length > 0) return;
    let cancelled = false;
    sdk.workspace
      .list()
      .then((list) => {
        if (cancelled) return;
        if (list.length > 0) {
          setWorkspaces(list);
        } else {
          setFallback(null);
        }
      })
      .catch(() => {
        if (!cancelled) setFallback(null);
      });
    return () => {
      cancelled = true;
    };
  }, [storedWorkspaces.length, setWorkspaces]);

  if (storedWorkspaces.length > 0) return storedWorkspaces[0]?.id;
  return fallback === null ? 'workflows' : undefined;
}
