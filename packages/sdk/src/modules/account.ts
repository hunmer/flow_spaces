import type { HttpClient } from '../client';

export interface UserProfile {
  name: string;
  avatarUrl: string | null;
}

export function createAccountApi(http: HttpClient) {
  return {
    /** 获取用户资料（name / avatarUrl） */
    getProfile: (): Promise<UserProfile> =>
      http.get('/api/account/profile'),

    /** 更新昵称（trim 非空且 ≤32 字符，服务端 400 校验） */
    updateProfile: (name: string): Promise<UserProfile> =>
      http.put('/api/account/profile', { name }),

    /** 上传头像（png/jpg/jpeg/webp/gif，≤5MB），字段名 file */
    uploadAvatar: (file: File): Promise<{ url: string }> => {
      const formData = new FormData();
      formData.append('file', file);
      return http.upload('/api/account/avatar', formData);
    },

    /** 删除头像 */
    removeAvatar: (): Promise<{ ok: boolean }> =>
      http.deleteOf('/api/account/avatar'),
  };
}
