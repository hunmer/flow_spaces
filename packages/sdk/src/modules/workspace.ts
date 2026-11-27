import type { HttpClient } from '../client';

export function createWorkspaceApi(http: HttpClient) {
  return {
    list: (): Promise<import('@flow-spaces/shared').Workspace[]> =>
      http.get('/api/workspaces'),

    /** Check folder permissions */
    checkPermissions: (path: string): Promise<{ readable: boolean; writable: boolean }> =>
      http.get(`/api/folder/check-permissions?path=${encodeURIComponent(path)}`),

    /** Create a new folder */
    createFolder: (path: string): Promise<void> =>
      http.postVoid('/api/folder/create', { path }),
  };
}
