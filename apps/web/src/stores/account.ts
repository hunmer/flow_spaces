import { create } from 'zustand';
import { getProfile } from '@/lib/account-api';

/**
 * 账号 store（T2）：侧边栏 Profile 与设置【账号】Tab 共享。
 * 401 由 fetchWithAuth 统一跳登录，这里不处理鉴权分支。
 */

interface AccountStore {
  name: string;
  avatarUrl: string | null;
  loaded: boolean;
  /** 拉取个人资料；once 语义（含并发去重，兼容 StrictMode 双调）。 */
  load: () => Promise<void>;
  /** 用已知 profile 即时刷新（保存/上传/移除成功后调用）。 */
  applyProfile: (profile: { name: string; avatarUrl: string | null }) => void;
}

let inflight: Promise<void> | null = null;

export const useAccountStore = create<AccountStore>((set, get) => ({
  name: 'Flow Spaces',
  avatarUrl: null,
  loaded: false,

  load: () => {
    if (get().loaded) return Promise.resolve();
    if (!inflight) {
      inflight = (async () => {
        try {
          const profile = await getProfile();
          set({ name: profile.name, avatarUrl: profile.avatarUrl, loaded: true });
        } catch {
          // 拉取失败保持默认展示，不打断界面
        } finally {
          inflight = null;
        }
      })();
    }
    return inflight;
  },

  applyProfile: (profile) =>
    set({ name: profile.name, avatarUrl: profile.avatarUrl, loaded: true }),
}));
