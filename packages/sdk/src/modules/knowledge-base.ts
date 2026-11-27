import type { HttpClient } from '../client';
import type {
  KnowledgeBase, KbFile, KnowledgeBaseStats, KbQueryResult, KbAddFileBody,
} from '@flow-spaces/shared';

export function createKnowledgeBaseApi(http: HttpClient) {
  return {
    list: (workspaceId: string): Promise<KnowledgeBase[]> =>
      http.get(`/api/workspaces/${workspaceId}/knowledge-bases`),

    create: (workspaceId: string, data: { name: string; description?: string; chunkSize?: number; chunkOverlap?: number }): Promise<KnowledgeBase> =>
      http.post(`/api/workspaces/${workspaceId}/knowledge-bases`, data),

    update: (workspaceId: string, kbId: string, data: Partial<Pick<KnowledgeBase, 'name' | 'description' | 'embeddingModelId' | 'chunkSize' | 'chunkOverlap'>>): Promise<KnowledgeBase> =>
      http.put(`/api/workspaces/${workspaceId}/knowledge-bases/${kbId}`, data),

    delete_: (workspaceId: string, kbId: string): Promise<void> =>
      http.delete(`/api/workspaces/${workspaceId}/knowledge-bases/${kbId}`),

    bindEmbeddingModel: (workspaceId: string, kbId: string, embeddingModelId: string | null): Promise<KnowledgeBase> =>
      http.put(`/api/workspaces/${workspaceId}/knowledge-bases/${kbId}/embedding-model`, { embeddingModelId }),

    listFiles: (workspaceId: string, kbId: string): Promise<KbFile[]> =>
      http.get(`/api/workspaces/${workspaceId}/knowledge-bases/${kbId}/files`),

    /** 上传浏览器 File(走 multipart/form-data,字段名 file),服务端走 sourceType='upload' 分支 */
    uploadFile: (workspaceId: string, kbId: string, file: File): Promise<KbFile> => {
      const fd = new FormData();
      fd.append('file', file);
      return http.upload(`/api/workspaces/${workspaceId}/knowledge-bases/${kbId}/files`, fd);
    },

    deleteFile: (workspaceId: string, kbId: string, fileId: string): Promise<void> =>
      http.delete(`/api/workspaces/${workspaceId}/knowledge-bases/${kbId}/files/${fileId}`),

    reindexFile: (workspaceId: string, kbId: string, fileId: string): Promise<KbFile> =>
      http.post(`/api/workspaces/${workspaceId}/knowledge-bases/${kbId}/files/${fileId}/reindex`),

  };
}