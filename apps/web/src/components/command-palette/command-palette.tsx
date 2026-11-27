'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  AppWindow,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CornerDownLeft,
  Languages,
  LayoutDashboard,
  Moon,
  Plus,
  Sparkles,
  Workflow as WorkflowIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandCollection,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandShortcut,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { useAutocompleteFilter } from '@/components/ui/autocomplete';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
// BoardUI 迁移：skeleton 改用 base 版本
import { Skeleton } from '@/components/base/skeleton/skeleton';
import { useLocale } from '@/components/layout/locale-provider';
import { useTheme } from '@/components/layout/theme-provider';
import { nativeNavigate } from '@/lib/navigate';
import { miniAppPreviewUrl } from '@/lib/mini-app-preview';
import { sdk } from '@/lib/sdk';
import { workflowApi } from '@/lib/workflow-api';
import { useWorkflowStore } from '@/stores/workflow';
import { useSearchCommands, type PaletteCommand } from '@/stores/search-commands/store';
import { askAI, markdownToSafeHTML, type AIReferenceLink } from './ask-ai';

/** 面板内部条目（含分组 id）；value 即条目唯一 id */
interface PaletteItem {
  value: string;
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  keywords?: string[];
  onSelect: () => void | Promise<void>;
}

interface PaletteGroup {
  value: string;
  items: PaletteItem[];
}

type AIMode = 'search' | 'ai';

interface AIState {
  mode: AIMode;
  query: string;
  submittedQuery: string | null;
  response: string | null;
  referenceLinks: AIReferenceLink[];
  isGenerating: boolean;
  error: string | null;
}

const INITIAL_AI_STATE: AIState = {
  mode: 'search',
  query: '',
  submittedQuery: null,
  response: null,
  referenceLinks: [],
  isGenerating: false,
  error: null,
};

export function CommandPalette() {
  const t = useTranslations('commandPalette');
  const tWorkflow = useTranslations('workflows');
  const router = useRouter();
  const { locale, setLocale } = useLocale();
  const { resolvedTheme, setTheme } = useTheme();
  const { contains } = useAutocompleteFilter({ sensitivity: 'base' });

  const open = useSearchCommands((s) => s.open);
  const closePalette = useSearchCommands((s) => s.closePalette);
  const registeredCommands = useSearchCommands((s) => s.registered);

  const workflows = useWorkflowStore((s) => s.workflows);
  const loadWorkflows = useWorkflowStore((s) => s.loadWorkflows);
  const upsertWorkflow = useWorkflowStore((s) => s.upsertWorkflow);

  const [searchQuery, setSearchQuery] = useState('');
  const [aiState, setAiState] = useState<AIState>(INITIAL_AI_STATE);
  const [miniApps, setMiniApps] = useState<{ id: string; name: string; description?: string }[]>([]);

  const aiInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  /** AI→搜索切换后重挂 Command，重置高亮与内部过滤 */
  const commandResetKeyRef = useRef(0);
  const [commandResetKey, setCommandResetKey] = useState(0);

  // ── 数据懒加载（打开时拉取） ───────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (!useWorkflowStore.getState().workflows.length) {
      loadWorkflows().catch(() => {});
    }
    let cancelled = false;
    sdk.miniApp
      .list()
      .then((list) => {
        if (!cancelled) setMiniApps(list.map((p) => ({ id: p.id, name: p.name, description: p.description })));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, loadWorkflows]);

  // ── 全局 ⌘K / Ctrl+K ─────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        useSearchCommands.getState().togglePalette('shortcut');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // ── AI 模式：Escape 返回搜索（捕获，优先于 Dialog 关闭） ────────────────
  useEffect(() => {
    if (!open || aiState.mode !== 'ai') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        backToSearch();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, aiState.mode]);

  // ── AI 模式聚焦输入框 ─────────────────────────────────────────────────
  useEffect(() => {
    if (open && aiState.mode === 'ai') {
      // 等待 Dialog 打开动画后聚焦
      const timer = requestAnimationFrame(() => aiInputRef.current?.focus());
      return () => cancelAnimationFrame(timer);
    }
  }, [open, aiState.mode]);

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  const run = useCallback(
    (item: PaletteItem) => {
      closePalette();
      void Promise.resolve(item.onSelect()).catch(() => {});
    },
    [closePalette],
  );

  const openRoute = useCallback(
    (href: string) => {
      closePalette();
      nativeNavigate(router, href);
    },
    [closePalette, router],
  );

  const handleCreateWorkflow = useCallback(async () => {
    const created = await workflowApi.create({
      name: tWorkflow('defaultWorkflow.name'),
      nodes: [
        { id: `node_${Date.now()}_start`, type: 'start', label: tWorkflow('defaultWorkflow.startLabel'), position: { x: 250, y: 50 }, data: {} },
        { id: `node_${Date.now()}_end`, type: 'end', label: tWorkflow('defaultWorkflow.endLabel'), position: { x: 250, y: 400 }, data: {} },
      ],
      edges: [],
    });
    upsertWorkflow(created);
    workflowApi.recordOpen(created.id).then((updated) => upsertWorkflow(updated)).catch(() => {});
    nativeNavigate(router, `/workflows/${created.id}`);
  }, [tWorkflow, upsertWorkflow, router]);

  // ── 分组条目 ─────────────────────────────────────────────────────────
  const groups = useMemo<PaletteGroup[]>(() => {
    const navItems: PaletteItem[] = [
      { value: 'nav.home', label: t('nav.home'), icon: LayoutDashboard, shortcut: 'G H', keywords: ['home', 'dashboard', '首页'], onSelect: () => openRoute('/home') },
      { value: 'nav.workflows', label: t('nav.workflows'), icon: WorkflowIcon, shortcut: 'G W', keywords: ['workflows', 'list', '工作流'], onSelect: () => openRoute('/workflows') },
      { value: 'nav.miniApps', label: t('nav.miniApps'), icon: AppWindow, shortcut: 'G M', keywords: ['mini apps', 'apps', '小应用'], onSelect: () => openRoute('/mini-apps') },
    ];

    const workflowItems: PaletteItem[] = workflows.map((wf) => ({
      value: `workflow:${wf.id}`,
      label: wf.name,
      icon: WorkflowIcon,
      keywords: [wf.description ?? '', ...(wf.tags ?? [])].filter(Boolean),
      onSelect: () => {
        workflowApi.recordOpen(wf.id).then((updated) => upsertWorkflow(updated)).catch(() => {});
        nativeNavigate(router, `/workflows/${wf.id}`);
      },
    }));

    const miniAppItems: PaletteItem[] = miniApps.map((app) => ({
      value: `miniapp:${app.id}`,
      label: app.name,
      icon: AppWindow,
      keywords: [app.description ?? ''].filter(Boolean),
      onSelect: () => { window.open(miniAppPreviewUrl(app.id), '_blank'); },
    }));

    const actionItems: PaletteItem[] = [
      {
        value: 'action:newWorkflow',
        label: t('actions.newWorkflow'),
        icon: Plus,
        keywords: ['new', 'create', 'workflow', '新建', '创建'],
        onSelect: handleCreateWorkflow,
      },
      {
        value: 'action:toggleDark',
        label: t('actions.toggleDark'),
        icon: Moon,
        keywords: ['dark', 'light', 'theme', '深色', '浅色', '主题'],
        onSelect: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'),
      },
      {
        value: 'action:toggleLanguage',
        label: t('actions.toggleLanguage'),
        icon: Languages,
        keywords: ['english', 'language', 'i18n', '中文', '语言', 'zh', 'en'],
        onSelect: () => setLocale(locale === 'zh' ? 'en' : 'zh'),
      },
    ];

    const result: PaletteGroup[] = [
      { value: 'navigation', items: navItems },
      { value: 'workflows', items: workflowItems },
      { value: 'miniApps', items: miniAppItems },
      { value: 'actions', items: actionItems },
    ];

    // 外部注册命令按 group 聚合
    if (registeredCommands.length) {
      const byGroup = new Map<string, PaletteItem[]>();
      for (const cmd of registeredCommands as PaletteCommand[]) {
        const list = byGroup.get(cmd.group) ?? [];
        list.push({
          value: cmd.id,
          label: cmd.label,
          icon: cmd.icon,
          shortcut: cmd.shortcut,
          keywords: cmd.keywords,
          onSelect: cmd.perform,
        });
        byGroup.set(cmd.group, list);
      }
      for (const [group, items] of byGroup) {
        result.push({ value: group, items });
      }
    }

    return result;
  }, [t, workflows, miniApps, registeredCommands, openRoute, handleCreateWorkflow, resolvedTheme, setTheme, locale, setLocale, upsertWorkflow, router]);

  // ── 过滤（与 Command 内部一致的谓词，用于 Enter 询问 AI 判定） ─────────
  const itemSearchText = useCallback(
    (item: unknown) => {
      const it = item as PaletteItem;
      return [it.label, ...(it.keywords ?? [])].join(' ');
    },
    [],
  );
  const hasResults = useMemo(() => {
    const query = searchQuery.trim();
    if (!query) return true;
    return groups.some((group) => group.items.some((item) => contains(item, query, itemSearchText)));
  }, [groups, searchQuery, contains, itemSearchText]);

  // ── AI 状态机 ─────────────────────────────────────────────────────────
  const resetAIState = useCallback(() => {
    abortControllerRef.current?.abort();
    setAiState(INITIAL_AI_STATE);
  }, []);

  const backToSearch = useCallback(() => {
    resetAIState();
    setSearchQuery('');
    commandResetKeyRef.current += 1;
    setCommandResetKey(commandResetKeyRef.current);
  }, [resetAIState]);

  const handleAskAI = useCallback(
    (query?: string) => {
      const q = (query ?? searchQuery).trim();
      if (!q) return;
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setAiState({
        mode: 'ai',
        query: q,
        submittedQuery: q,
        response: null,
        referenceLinks: [],
        isGenerating: true,
        error: null,
      });
      askAI(q, { signal: controller.signal, locale })
        .then((answer) => {
          setAiState((s) =>
            s.submittedQuery === q
              ? { ...s, response: answer.response, referenceLinks: answer.referenceLinks, isGenerating: false }
              : s,
          );
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setAiState((s) =>
            s.submittedQuery === q ? { ...s, isGenerating: false, error: err instanceof Error ? err.message : 'error' } : s,
          );
        });
    },
    [searchQuery, locale],
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) return;
      closePalette();
      setSearchQuery('');
      resetAIState();
    },
    [closePalette, resetAIState],
  );

  const groupLabel = useCallback(
    (groupValue: string) => (t.has(`groups.${groupValue}` as never) ? t(`groups.${groupValue}` as never) : groupValue),
    [t],
  );

  if (!open) return null;

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <CommandDialogPopup>
        {aiState.mode === 'search' ? (
          <Command
            key={commandResetKey}
            items={groups}
            filter={(item, query) => contains(item as PaletteItem, query, itemSearchText)}
            value={searchQuery}
            onValueChange={setSearchQuery}
          >
            <div className="flex items-center gap-2 border-b border-border px-3">
              <CommandInput
                className="flex-1"
                placeholder={t('placeholder')}
                onKeyDown={(event) => {
                  if (event.key === 'Tab') {
                    event.preventDefault();
                    handleAskAI();
                  } else if (event.key === 'Enter' && !hasResults && searchQuery.trim()) {
                    event.preventDefault();
                    handleAskAI();
                  }
                }}
              />
            </div>
            <CommandPanel>
              <CommandEmpty>
                {searchQuery.trim() ? t('emptyAskAbout', { query: searchQuery.trim() }) : t('empty')}
              </CommandEmpty>
              <CommandList className="h-72 max-h-72">
                {(group) => {
                  const g = group as PaletteGroup;
                  return (
                  <Fragment key={g.value}>
                    <CommandGroup items={g.items}>
                      <CommandGroupLabel>{groupLabel(g.value)}</CommandGroupLabel>
                      <CommandCollection>
                        {(item) => {
                          const paletteItem = item as PaletteItem;
                          return (
                            <CommandItem
                              key={paletteItem.value}
                              onClick={(event) => {
                                event.preventDefault();
                                run(paletteItem);
                              }}
                            >
                              {paletteItem.icon ? <paletteItem.icon className="size-4 shrink-0 text-muted-foreground" /> : null}
                              <span className="truncate">{paletteItem.label}</span>
                              {paletteItem.shortcut ? <CommandShortcut>{paletteItem.shortcut}</CommandShortcut> : null}
                            </CommandItem>
                          );
                        }}
                      </CommandCollection>
                    </CommandGroup>
                  </Fragment>
                  );
                }}
              </CommandList>
              <CommandFooter>
                <KbdGroup className="justify-start">
                  <Kbd>
                    <ArrowUp className="size-3" />
                    <ArrowDown className="size-3" />
                  </Kbd>
                  {t('footer.navigate')}
                  <Kbd>
                    <CornerDownLeft className="size-3" />
                  </Kbd>
                  {t('footer.open')}
                  <Kbd>Esc</Kbd>
                  {t('footer.close')}
                </KbdGroup>
              </CommandFooter>
            </CommandPanel>
          </Command>
        ) : (
          <div className="flex min-h-0 flex-col">
            <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
              <div className="relative min-w-0 flex-1">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 start-0 z-10 flex items-center ps-3 text-muted-foreground"
                >
                  <Sparkles className="size-4" />
                </div>
                <Input
                  ref={aiInputRef}
                  value={aiState.query}
                  onChange={(event) => setAiState((s) => ({ ...s, query: event.target.value }))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleAskAI(aiState.query);
                    }
                  }}
                  placeholder={t('ai.placeholder')}
                  className="h-10 border-transparent bg-transparent pl-9 shadow-none focus-visible:ring-0"
                />
              </div>
              <Button size="sm" variant="ghost" className="gap-1.5" onClick={backToSearch}>
                <ArrowLeft />
                <span className="hidden sm:inline">{t('ai.backToSearch')}</span>
                <Kbd className="font-sans">Esc</Kbd>
              </Button>
            </div>

            <CommandPanel className="min-h-0 flex-1">
              <ScrollArea className="h-72 max-h-72">
                {aiState.isGenerating ? (
                  <div className="space-y-4 p-4">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                      </div>
                    ))}
                  </div>
                ) : aiState.error ? (
                  <div className="flex flex-col items-center gap-1 p-8 text-center">
                    <span className="text-sm font-medium text-destructive">{t('ai.error')}</span>
                    <span className="text-xs text-muted-foreground">{aiState.error}</span>
                  </div>
                ) : aiState.response ? (
                  <div className="space-y-4 p-4">
                    <div
                      className="space-y-3 text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: markdownToSafeHTML(aiState.response) }}
                    />
                    {aiState.referenceLinks.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {aiState.referenceLinks.map((link) => (
                          <Button key={link.to} size="sm" variant="outline" onClick={() => openRoute(link.to)}>
                            {link.title}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
                    <Sparkles className="size-5" />
                    <span className="text-sm">{t('ai.initialHint')}</span>
                  </div>
                )}
              </ScrollArea>
            </CommandPanel>

            <CommandFooter>
              {aiState.isGenerating ? (
                <span className="flex items-center gap-2">
                  <Spinner className="size-3" />
                  {t('footer.generating')}…
                </span>
              ) : (
                <span className="truncate">{t('footer.youAsked', { query: aiState.submittedQuery ?? '' })}</span>
              )}
              <span className="flex items-center gap-1.5">
                <Kbd>
                  <CornerDownLeft className="size-3" />
                </Kbd>
                {t('footer.ask')}
              </span>
            </CommandFooter>
          </div>
        )}
      </CommandDialogPopup>
    </CommandDialog>
  );
}
