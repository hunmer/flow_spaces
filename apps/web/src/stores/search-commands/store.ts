import { create } from 'zustand';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * 全局命令面板（Command Palette）状态。
 *
 * 职责刻意保持最小：
 *  - open/openPalette/closePalette/togglePalette：面板开合（顶栏按钮、⌘K 等触发方共享）
 *  - registerCommands/unregisterCommands：外部命令注册表，供其它模块向面板注入命令
 *    （例如工作流编辑器注册画布操作）。内置命令（导航/数据/动作）由
 *    components/command-palette/command-palette.tsx 直接构建，不走注册表。
 */
export interface PaletteCommand {
  /** 稳定唯一 id（建议带来源前缀，如 `editor:layout.auto`） */
  id: string;
  /** 展示标签（需自行本地化后传入） */
  label: string;
  /** 分组 id；面板按 `groups.<value>` 查 locale 标签，未命中原样展示 */
  group: string;
  icon?: LucideIcon;
  shortcut?: string;
  keywords?: string[];
  description?: ReactNode;
  perform: () => void | Promise<void>;
}

interface SearchCommandsStore {
  open: boolean;
  /** 最近一次开合来源，供埋点/调试 */
  openedBy: 'shortcut' | 'trigger' | 'api' | null;
  registered: PaletteCommand[];
  openPalette: (by?: SearchCommandsStore['openedBy']) => void;
  closePalette: () => void;
  togglePalette: (by?: SearchCommandsStore['openedBy']) => void;
  setOpen: (open: boolean) => void;
  registerCommands: (sourceId: string, commands: PaletteCommand[]) => void;
  unregisterCommands: (sourceId: string) => void;
}

/**
 * 注册表 keyed by source：同一 source 重复注册为覆盖（upsert），
 * 避免热更新/重挂载导致的重复命令。
 */
const registry = new Map<string, PaletteCommand[]>();

function flattenRegistry(): PaletteCommand[] {
  return [...registry.values()].flat();
}

export const useSearchCommands = create<SearchCommandsStore>((set, get) => ({
  open: false,
  openedBy: null,
  registered: [],

  openPalette: (by = 'api') => {
    if (get().open) return;
    set({ open: true, openedBy: by });
  },
  closePalette: () => {
    if (!get().open) return;
    set({ open: false, openedBy: null });
  },
  togglePalette: (by = 'api') => {
    set((s) => ({ open: !s.open, openedBy: s.open ? null : by }));
  },
  setOpen: (open: boolean) => set({ open, openedBy: open ? get().openedBy ?? 'api' : null }),

  registerCommands: (sourceId, commands) => {
    registry.set(sourceId, commands);
    set({ registered: flattenRegistry() });
  },
  unregisterCommands: (sourceId) => {
    if (!registry.has(sourceId)) return;
    registry.delete(sourceId);
    set({ registered: flattenRegistry() });
  },
}));

/** 便捷引用（组件外使用，如 ⌘K 全局监听） */
export const searchCommands = {
  open: (by?: SearchCommandsStore['openedBy']) => useSearchCommands.getState().openPalette(by),
  close: () => useSearchCommands.getState().closePalette(),
  toggle: (by?: SearchCommandsStore['openedBy']) => useSearchCommands.getState().togglePalette(by),
};
