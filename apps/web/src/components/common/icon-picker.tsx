"use client";

import { useState } from "react";
import type { UIEvent } from "react";
import { cx } from "@/utils/cx";
import { ScrollFade, useScrollFade } from "@/components/foundations/scroll-fade/scroll-fade";

/**
 * 轻量内置 emoji 图标选择器（替代 emoji-picker-react，≈40MB 依赖归零）。
 * 静态精选分组、零运行时数据依赖；颜色全部走 BoardUI 语义 token，
 * 深浅色主题由 token 自动翻转，无需外部 Theme 传入。
 */

interface EmojiGroup {
  /** 分类 tab 展示的代表 emoji。 */
  tab: string;
  /** 无障碍/提示标签。 */
  label: string;
  emojis: readonly string[];
}

const EMOJI_GROUPS: readonly EmojiGroup[] = [
  {
    tab: "😀",
    label: "Smileys",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂",
      "🙂", "😉", "😊", "😇", "🥰", "😍", "🤩", "😘",
      "😋", "😛", "😜", "🤪", "🤓", "😎", "🥳", "🤔",
      "🤗", "🤭", "😴", "🤤", "😢", "😭", "😤", "🥺",
    ],
  },
  {
    tab: "🐶",
    label: "Animals",
    emojis: [
      "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼",
      "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🦄",
      "🐝", "🦋", "🐢", "🐍", "🐙", "🦀", "🐬", "🐳",
      "🐋", "🦈", "🐊", "🦓", "🦒", "🐘", "🦔", "🐔",
    ],
  },
  {
    tab: "🍎",
    label: "Food",
    emojis: [
      "🍎", "🍏", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇",
      "🍓", "🫐", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝",
      "🍅", "🥑", "🥕", "🌽", "🍄", "🍞", "🥐", "🧀",
      "🍔", "🍟", "🍕", "🌮", "🍣", "🍜", "🍰", "🍫",
    ],
  },
  {
    tab: "🌿",
    label: "Nature",
    emojis: [
      "🌿", "🌸", "🌺", "🌷", "🌹", "🌻", "🌼", "🌱",
      "🪴", "🌲", "🌳", "🌴", "🌵", "🍁", "🍂", "🍃",
      "💐", "⭐", "🌟", "✨", "⚡", "🔥", "🌈", "☀️",
      "🌙", "☁️", "❄️", "⛄", "🌊", "💧", "🌍", "🏔",
    ],
  },
  {
    tab: "💻",
    label: "Objects",
    emojis: [
      "💻", "🖥", "⌨️", "🖱", "📱", "⌚", "🔋", "🔌",
      "💡", "🔦", "📷", "📹", "📺", "⏰", "⌛", "⏳",
      "🔍", "🔒", "🔑", "🛠", "🔧", "🔨", "⚙️", "🧲",
      "🎁", "🎈", "🎉", "🎊", "🧸", "🎮", "🎲", "🎨",
    ],
  },
  {
    tab: "❤️",
    label: "Symbols",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
      "💔", "💝", "💕", "💞", "💓", "💗", "💖", "💘",
      "✅", "❌", "❗", "❓", "⚜️", "🔱", "⚛️", "♾",
      "💠", "🚩", "🏁", "🏆", "🥇", "👑", "💎", "🔔",
    ],
  },
];

export interface IconPickerProps {
  /** 选中 emoji 字符后回调（父组件负责关闭浮层）。 */
  onSelect: (emoji: string) => void;
  className?: string;
}

export function IconPicker({ onSelect, className }: IconPickerProps) {
  const [groupIndex, setGroupIndex] = useState(0);
  const fade = useScrollFade();
  const group = EMOJI_GROUPS[groupIndex];

  const handleScroll = (event: UIEvent<HTMLElement>) => fade.onScroll(event);

  return (
    <div className={cx("w-[280px]", className)} role="group" aria-label="Select an icon">
      {/* 分类 tab */}
      <div className="flex items-center gap-0.5 border-b border-separator-border px-2 py-1.5">
        {EMOJI_GROUPS.map((g, index) => (
          <button
            key={g.label}
            type="button"
            title={g.label}
            aria-label={g.label}
            aria-pressed={index === groupIndex}
            className={cx(
              "flex size-7 cursor-pointer items-center justify-center rounded-md text-base outline-none transition-colors focus-visible:ring-2 focus-visible:ring-border-focus-ring",
              index === groupIndex
                ? "bg-background-secondary-default"
                : "hover:bg-background-primary-hover",
            )}
            onClick={() => {
              setGroupIndex(index);
              fade.reset();
            }}
          >
            <span aria-hidden>{g.tab}</span>
          </button>
        ))}
      </div>

      {/* 网格：切换分类时重建滚动容器，归零 scrollTop；顶部渐隐复用 ScrollFade */}
      <div className="relative h-[256px]">
        <div key={groupIndex} className="h-full overflow-y-auto px-2 py-2" onScroll={handleScroll}>
          <div className="grid grid-cols-8 gap-0.5">
            {group.emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                title={emoji}
                className="flex size-8 cursor-pointer items-center justify-center rounded-md text-xl leading-none outline-none transition-colors hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                onClick={() => onSelect(emoji)}
              >
                <span aria-hidden>{emoji}</span>
              </button>
            ))}
          </div>
        </div>
        <ScrollFade progress={fade.progress} />
      </div>
    </div>
  );
}
