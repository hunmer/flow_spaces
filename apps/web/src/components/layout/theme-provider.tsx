'use client'

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";
import { useServerInsertedHTML } from "next/navigation";

type Theme = 'light' | 'dark' | 'system';

const DEFAULT_ACCENT = 'blue';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
  /** 当前主题色 key（THEME_ACCENTS 之一）。 */
  accent: string;
  setAccent: (accent: string) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  setTheme: () => {},
  resolvedTheme: 'light',
  accent: DEFAULT_ACCENT,
  setAccent: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

const STORAGE_KEY = 'flow-spaces-theme';
const ACCENT_STORAGE_KEY = 'flow-spaces-accent';
const FONT_STORAGE_KEY = 'customFont';
const CUSTOM_FONTS_KEY = 'customFonts';

export interface ThemeAccentOption {
  key: string;
  /** 圆点展示色 = accent ramp 基色（Tailwind 500 档，与 globals.css [data-accent] 的 --color-accent-500 一致）。 */
  swatch: string;
}

/** 可选主题色（accent）；生效的 CSS 变量覆盖规则在 globals.css 的 [data-accent] 段。 */
export const THEME_ACCENTS: readonly ThemeAccentOption[] = [
  { key: 'blue', swatch: '#3b82f6' },
  { key: 'violet', swatch: '#8b5cf6' },
  { key: 'cyan', swatch: '#06b6d4' },
  { key: 'emerald', swatch: '#10b981' },
  { key: 'amber', swatch: '#f59e0b' },
  { key: 'orange', swatch: '#f97316' },
  { key: 'red', swatch: '#ef4444' },
  { key: 'pink', swatch: '#ec4899' },
];

/** SSR 防闪烁脚本内嵌的合法 accent key 列表。 */
const ACCENT_KEY_LIST = JSON.stringify(THEME_ACCENTS.map((accent) => accent.key));

function isAccentKey(value: string | null): value is string {
  return value !== null && THEME_ACCENTS.some((accent) => accent.key === value);
}

function readAccent(): string {
  if (typeof window === 'undefined') return DEFAULT_ACCENT;
  const stored = localStorage.getItem(ACCENT_STORAGE_KEY);
  return isAccentKey(stored) ? stored : DEFAULT_ACCENT;
}

function applyAccent(accent: string) {
  document.documentElement.dataset.accent = accent;
}
const THEME_COLORS = {
  light: '#ffffff',
  dark: '#0f1117',
} as const;

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  const resolved = theme === 'system' ? getSystemTheme() : theme;
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolved);
  root.style.colorScheme = resolved;
  applyNativeTheme(resolved);
}

function applyNativeTheme(resolved: 'light' | 'dark') {
  let themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!themeColor) {
    themeColor = document.createElement('meta');
    themeColor.name = 'theme-color';
    document.head.appendChild(themeColor);
  }
  themeColor.content = THEME_COLORS[resolved];
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
}: {
  children: React.ReactNode;
  attribute?: string;
  defaultTheme?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
}) {
  // Inject theme script during SSR only — prevents FOUC without triggering React 19 warning
  useServerInsertedHTML(() => (
    <script
      key="theme-init"
      dangerouslySetInnerHTML={{
        __html: `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');var d=t==='dark'||((!t||t==='system')&&matchMedia('(prefers-color-scheme:dark)').matches);var r=d?'dark':'light';document.documentElement.classList.add(r);document.documentElement.style.colorScheme=r;var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement('meta');m.name='theme-color';document.head.appendChild(m)}m.content=d?'${THEME_COLORS.dark}':'${THEME_COLORS.light}';var a=localStorage.getItem('${ACCENT_STORAGE_KEY}');if(a&&${ACCENT_KEY_LIST}.indexOf(a)>=0){document.documentElement.dataset.accent=a}var f=localStorage.getItem('${FONT_STORAGE_KEY}');document.documentElement.dataset.customFont=f?'true':'false';if(f){var ff=f;try{var c=JSON.parse(localStorage.getItem('${CUSTOM_FONTS_KEY}')||'[]');var cf=Array.isArray(c)&&c.find(function(x){return x&&x.name===f});if(cf&&cf.url){ff=f.replace(/\\.\\w+$/,'');var id='font-'+f.replace(/[^a-zA-Z0-9]/g,'-');if(!document.getElementById(id)){var s=document.createElement('style');s.id=id;s.textContent='@font-face { font-family: "'+ff.replace(/"/g,'\\\\22 ')+'"; src: url("'+String(cf.url).replace(/"/g,'\\\\22 ')+'"); }';document.head.appendChild(s)}}}catch(e){}var v=ff==='system-ui'||ff==='monospace'?ff:'"'+ff.replace(/"/g,'\\\\22 ')+'"';['--font-app','--font-sans','--font-heading','--font-mid','--font-mono'].forEach(function(k){document.documentElement.style.setProperty(k,v)})}}catch(e){}})()`,
      }}
    />
  ));

  const systemTheme = useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => getSystemTheme(),
    () => 'light' as const,
  );

  const storedTheme = useSyncExternalStore(
    (cb) => {
      window.addEventListener('storage', cb);
      return () => window.removeEventListener('storage', cb);
    },
    () => (localStorage.getItem(STORAGE_KEY) as Theme) || (defaultTheme as Theme),
    () => defaultTheme as Theme,
  );

  const theme = storedTheme;
  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  const storedAccent = useSyncExternalStore(
    (cb) => {
      window.addEventListener('storage', cb);
      return () => window.removeEventListener('storage', cb);
    },
    readAccent,
    () => DEFAULT_ACCENT,
  );

  const setTheme = useCallback((newTheme: Theme) => {
    localStorage.setItem(STORAGE_KEY, newTheme);
    applyTheme(newTheme);
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
  }, []);

  const setAccent = useCallback((newAccent: string) => {
    if (!isAccentKey(newAccent)) return;
    localStorage.setItem(ACCENT_STORAGE_KEY, newAccent);
    applyAccent(newAccent);
    window.dispatchEvent(new StorageEvent('storage', { key: ACCENT_STORAGE_KEY }));
  }, []);

  useEffect(() => {
    applyAccent(storedAccent);
  }, [storedAccent]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme, systemTheme]);

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, resolvedTheme, accent: storedAccent, setAccent }}
    >
      {children}
    </ThemeContext.Provider>
  );
}