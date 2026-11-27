"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Puzzle, Zap } from 'lucide-react';
import { sdk } from '@/lib/sdk';
import type { MiniAppProject } from '@flow-spaces/sdk';
import { MiniAppPreview } from './mini-app-preview';
import { MiniAppChat } from './mini-app-chat';
import { useMiniAppHostApi } from './use-mini-app-host-api';
import { PluginToolDialog } from '@/components/workflow/plugin-tool-dialog';
import { BackButton } from '@/components/common/back-button';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { isSkippableAsset } from '@/lib/utils';
import { loadMiniAppDist, type MiniAppDistBundle } from '@/lib/mini-app-dist';
import { useMiniAppFastLoading } from '@/stores/mini-app-loading';

const FILE_POLL_INTERVAL_MS = 2000;

async function readFiles(projectId: string, files: string[]): Promise<Record<string, string>> {
    const contents: Record<string, string> = {};
    for (const file of files) {
        // 跳过二进制/资源文件：utf-8 读取无意义且会触发大体积 fetch（wasm 38MB、pck 12MB、glb 等），
        // 这些运行时资源不会被源码 import 解析，按需懒加载即可。
        if (isSkippableAsset(file)) continue;
        try {
            const { content } = await sdk.miniApp.readFile(projectId, file);
            contents[file] = content;
        } catch { /* skip unreadable files */ }
    }
    return contents;
}

/** 同进程渲染：mini-app 路由直接落在宿主 URL（?route= 或 hash），初始读取一次即可。 */
function readInitialRoute(): string {
    if (typeof window === 'undefined') return '';
    try {
        return new URLSearchParams(window.location.search).get('route') || window.location.hash.replace(/^#/, '');
    } catch { return ''; }
}

interface MiniAppEditorProps {
    projectId: string;
}

export function MiniAppEditor({ projectId }: MiniAppEditorProps) {
    const t = useTranslations('mini-apps');
    const commonT = useTranslations('common');
    const [project, setProject] = useState<MiniAppProject | null>(null);
    const [sourceCode, setSourceCode] = useState('');
    const [distBundle, setDistBundle] = useState<MiniAppDistBundle | null>(null);
    const fastLoading = useMiniAppFastLoading(projectId);
    const [allFiles, setAllFiles] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [pluginDialogOpen, setPluginDialogOpen] = useState(false);
    // 外部文件变化 → 递增触发 MiniAppPreview 重载（重新拉文件 + 重挂载渲染器）
    const [reloadSignal, setReloadSignal] = useState(0);
    // Agent Chat 的代码上下文（入口文件；入口缺失时退回首个文件）
    const [chatFilePath, setChatFilePath] = useState('');
    const [chatFileContent, setChatFileContent] = useState('');

    const [runtimeContext] = useState(() => ({
        route: readInitialRoute() || '/',
        params: {} as Record<string, unknown>,
    }));
    const host = useMiniAppHostApi(projectId, runtimeContext);

    const filesContentRef = useRef<Record<string, string>>({});
    const fileMtimeRef = useRef<Record<string, number>>({});
    const loadVersionRef = useRef(0);

    const shareUrl = (() => {
        if (typeof window === 'undefined') return '';
        const base = `${window.location.origin}/mini-apps-preview?id=${encodeURIComponent(projectId)}`;
        try {
            const route = new URLSearchParams(window.location.search).get('route') || window.location.hash;
            if (!route) return base;
            return route.startsWith('#')
                ? `${base}${route}`
                : `${base}&route=${encodeURIComponent(route)}`;
        } catch { return base; }
    })();

    // 全量拉取项目与文件（初次加载 + 每次重载）
    const loadFiles = useCallback(async (onProgress?: (loaded: number, total: number) => void) => {
        const version = ++loadVersionRef.current;
        try {
            const p = await sdk.miniApp.get(projectId);
            const dist = fastLoading && p.type === 'react' ? await loadMiniAppDist(sdk.miniApp, projectId) : null;
            if (dist) {
                let content = '';
                try { content = (await sdk.miniApp.readFile(projectId, p.mainFile)).content; } catch { /* dist-only install */ }
                if (version !== loadVersionRef.current) return;
                setDistBundle(dist);
                setProject(p);
                setSourceCode(dist.code);
                setAllFiles({});
                setError(null);
                fileMtimeRef.current = {};
                filesContentRef.current = {};
                // Agent 上下文仍使用源码入口，避免将 bundle 当作待编辑源码。
                setChatFilePath(p.mainFile);
                setChatFileContent(content);
                onProgress?.(1, 1);
                return;
            }
            const manifest = await sdk.miniApp.getFileManifest(projectId);

            const mtimeMap: Record<string, number> = {};
            const tree: string[] = [];
            for (const entry of manifest) {
                mtimeMap[entry.path] = entry.mtimeMs;
                tree.push(entry.path);
            }

            onProgress?.(0, tree.length);
            const files: Record<string, string> = {};
            let loaded = 0;
            for (const file of tree) {
                if (!isSkippableAsset(file)) {
                    try {
                        const { content } = await sdk.miniApp.readFile(projectId, file);
                        files[file] = content;
                    } catch { /* skip */ }
                }
                loaded += 1;
                onProgress?.(loaded, tree.length);
            }

            if (version !== loadVersionRef.current) return;
            setDistBundle(null);
            fileMtimeRef.current = mtimeMap;
            filesContentRef.current = files;
            setAllFiles(files);
            setProject(p);

            // mainFile 在 tree 里找不到通常是导入时多余的顶层目录没剥掉，不静默 fallback，
            // 否则会渲染错误入口（chat 上下文仍退回首个文件保证可用）。
            const entry = tree.find((f) => f === p.mainFile);
            if (!entry) {
                setError(
                    commonT('entryFileNotFound', { file: p.mainFile, tree: tree.slice(0, 20).join('\n') }) +
                    (tree.length > 20 ? commonT('entryFileTruncated', { count: tree.length }) : ''),
                );
                setChatFilePath(tree[0] ?? '');
                setChatFileContent(files[tree[0] ?? ''] ?? '');
                return;
            }
            setError(null);
            setSourceCode(files[entry] ?? '');
            setChatFilePath(entry);
            setChatFileContent(files[entry] ?? '');
        } catch (err) {
            if (version !== loadVersionRef.current) return;
            setError(err instanceof Error ? err.message : String(err));
            console.error('Failed to load mini-app files:', err);
        }
    }, [projectId, commonT, fastLoading]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        loadFiles().finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [loadFiles]);

    // Poll files written outside this page (e.g. workflow/chat agents) and auto-refresh the preview.
    useEffect(() => {
        if (!project || distBundle) return;
        const interval = setInterval(() => {
            (async () => {
                try {
                    const manifest = await sdk.miniApp.getFileManifest(projectId);
                    const nextMtime: Record<string, number> = {};
                    for (const entry of manifest) nextMtime[entry.path] = entry.mtimeMs;

                    const changed = manifest
                        .filter((entry) => fileMtimeRef.current[entry.path] !== entry.mtimeMs)
                        .map((entry) => entry.path);
                    fileMtimeRef.current = nextMtime;
                    if (changed.length === 0) return;

                    const fetched = await readFiles(projectId, changed);
                    let contentChanged = false;
                    for (const [file, content] of Object.entries(fetched)) {
                        if (filesContentRef.current[file] !== content) contentChanged = true;
                        filesContentRef.current[file] = content;
                    }
                    if (chatFilePath && fetched[chatFilePath] !== undefined) setChatFileContent(fetched[chatFilePath]);
                    if (contentChanged && autoRefresh) setReloadSignal((key) => key + 1);
                } catch { /* ignore transient poll errors */ }
            })();
        }, FILE_POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [project, projectId, autoRefresh, chatFilePath, distBundle]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!project) {
        return <div className="p-4 text-muted-foreground">{t('editor.notFound')}</div>;
    }

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
            {host}
            <div className="min-h-0 flex-1">
                <MiniAppPreview
                    type={project.type}
                    sourceCode={sourceCode}
                    error={error}
                    onError={setError}
                    projectId={project.id}
                    projectName={project.name}
                    onReload={loadFiles}
                    reloadSignal={reloadSignal}
                    enabledPlugins={project.enabledPlugins}
                    enableAgents={project.enableAgents}
                    agentChatPlacement={project.agentChatPlacement}
                    devices={project.devices}
                    files={allFiles}
                    mainFile={project.mainFile}
                    compiled={Boolean(distBundle)}
                    compiledCss={distBundle?.css}
                    shareUrl={shareUrl}
                    headerStart={(
                        <>
                            <BackButton />
                            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">
                                {project.type === 'react' ? 'React' : 'HTML'}
                            </span>
                        </>
                    )}
                    toolbarExtra={(
                        <>
                            <div className="mr-1 flex items-center gap-1.5">
                                <Switch
                                    id="editor-auto-refresh"
                                    checked={autoRefresh}
                                    onCheckedChange={setAutoRefresh}
                                    className="scale-75"
                                />
                                <Label htmlFor="editor-auto-refresh" className="cursor-pointer text-xs text-muted-foreground">
                                    <Zap className="mr-1 inline h-3 w-3" />
                                    {t('preview.autoPreview')}
                                </Label>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                onClick={() => setPluginDialogOpen(true)}
                                title={t('preview.plugins')}
                                aria-label={t('preview.plugins')}
                            >
                                <Puzzle className="h-4 w-4" />
                            </Button>
                        </>
                    )}
                />
            </div>

            <MiniAppChat
                project={project}
                activeFilePath={chatFilePath}
                fileContent={chatFileContent}
                onUpdateProject={(updates) => {
                    if (project) {
                        sdk.miniApp.update(project.id, updates);
                        setProject({ ...project, ...updates });
                    }
                }}
            />

            <PluginToolDialog
                open={pluginDialogOpen}
                onOpenChange={setPluginDialogOpen}
                projectId={project.id}
                enabledPlugins={project.enabledPlugins ?? []}
                onEnabledPluginsChange={(plugins) => {
                    if (project) setProject({ ...project, enabledPlugins: plugins });
                }}
            />
        </div>
    );
}
