'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useSearchParams, type ReadonlyURLSearchParams } from 'next/navigation';
import { sdk } from '@/lib/sdk';
import type { MiniAppProject } from '@flow-spaces/sdk';
import { MiniAppPreview } from '@/components/mini-apps/mini-app-preview';
import { MiniAppDependencyGuard } from '@/components/mini-apps/mini-app-dependency-guard';
import { useMiniAppHostApi } from '@/components/mini-apps/use-mini-app-host-api';
import { isSkippableAsset } from '@/lib/utils';
import { loadMiniAppDist, type MiniAppDistBundle } from '@/lib/mini-app-dist';
import { useMiniAppFastLoading } from '@/stores/mini-app-loading';
import { Loader2 } from 'lucide-react';

const MINI_APP_RUNTIME_INIT_SOURCE = 'flow-spaces:mini-app-runtime:init';
const MINI_APP_RUNTIME_EVENT = 'flow-spaces:mini-app-runtime';
const MINI_APP_RUNTIME_READY_SOURCE = 'flow-spaces:mini-app-runtime:ready';

type MiniAppRuntimeContext = {
  route: string;
  params: Record<string, unknown>;
};

function runtimeContextEquals(a: MiniAppRuntimeContext, b: MiniAppRuntimeContext): boolean {
  return a.route === b.route && JSON.stringify(a.params) === JSON.stringify(b.params);
}

function decodeRouteParam(value: string) {
  try { return decodeURIComponent(value); }
  catch { return value; }
}

function parseRuntimeParams(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function readRuntimeContextFromSearchParams(searchParams: ReadonlyURLSearchParams): MiniAppRuntimeContext {
  return {
    route: searchParams.get('route') || '/',
    params: parseRuntimeParams(searchParams.get('payload')),
  };
}

export default function MiniAppPreviewPageClient() {
  const t = useTranslations('common');
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get('id');
  const routeProjectId = params.id ? decodeRouteParam(params.id) : '';
  const projectId = queryProjectId || routeProjectId;
  const embedded = searchParams.get('embedded') === '1';
  const [project, setProject] = useState<MiniAppProject | null>(null);
  const [sourceCode, setSourceCode] = useState('');
  const [distBundle, setDistBundle] = useState<MiniAppDistBundle | null>(null);
  const fastLoading = useMiniAppFastLoading(projectId);
  const [allFiles, setAllFiles] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [runtimeContext, setRuntimeContext] = useState<MiniAppRuntimeContext>(() => readRuntimeContextFromSearchParams(searchParams));
  const runtimeContextRef = useRef<MiniAppRuntimeContext>(runtimeContext);
  const loadProjectInFlightRef = useRef<{ projectId: string; fastLoading: boolean; promise: Promise<void> } | null>(null);
  const loadVersionRef = useRef(0);
  // 依赖守卫：声明了插件/工作流依赖时先核查，缺失展示一键安装空态（MiniAppDependencyGuard），
  // 通过（齐全/安装完成/用户跳过）后才渲染真正的预览
  const [depsReady, setDepsReady] = useState(false);

  const host = useMiniAppHostApi(projectId, runtimeContext);

  const loadProject = useCallback((onProgress?: (loaded: number, total: number) => void) => {
    const inFlight = loadProjectInFlightRef.current;
    if (inFlight?.projectId === projectId && inFlight.fastLoading === fastLoading) return inFlight.promise;
    const version = ++loadVersionRef.current;

    const request = (async () => {
      try {
        const p = await sdk.miniApp.get(projectId);

        const dist = fastLoading && p.type === 'react' ? await loadMiniAppDist(sdk.miniApp, projectId) : null;
        if (dist) {
          if (version !== loadVersionRef.current) return;
          setProject(p);
          setDistBundle(dist);
          setError(null);
          setSourceCode(dist.code);
          setAllFiles({});
          onProgress?.(1, 1);
          return;
        }

        // Load ALL files for multi-file import resolution.
        // 跳过二进制/资源文件：这些不会被源码 import 解析，utf-8 读取无意义，
        // 且会在初始化时触发大体积 fetch（如 vendor/pixelorama-web/index.wasm 38MB、index.pck 12MB）。
        // 运行时资源（iframe 加载的 wasm/glb、fetch+eval 的 vendor js）按需懒加载，无需预读。
        const tree = (await sdk.miniApp.getFileTree(projectId)).filter(file => !isSkippableAsset(file));
        onProgress?.(0, tree.length);
        const files: Record<string, string> = {};
        let loaded = 0;
        for (const file of tree) {
          try {
            const { content } = await sdk.miniApp.readFile(projectId, file);
            files[file] = content;
          } catch { /* skip */ }
          loaded += 1;
          onProgress?.(loaded, tree.length);
        }
        if (version !== loadVersionRef.current) return;
        setProject(p);
        setDistBundle(null);
        setError(null);
        setAllFiles(files);

        // mainFile 在 tree 里找不到通常是导入时多余的顶层目录没剥掉
        // （源码落在 src/<wrapper>/src/... 而 mainFile 是裸文件名）。
        // 不静默 fallback 到 tree[0]，否则会渲染错误入口，模块解析全乱。
        const mainFile = tree.find(f => f === p.mainFile);
        if (!mainFile) {
          setError(
            t('entryFileNotFound', { file: p.mainFile, tree: tree.slice(0, 20).join('\n') }) +
            (tree.length > 20 ? t('entryFileTruncated', { count: tree.length }) : ''),
          );
          return;
        }
        setSourceCode(files[mainFile] || '');
      } catch (err: unknown) {
        if (version !== loadVersionRef.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load project');
      } finally {
        if (version === loadVersionRef.current) setLoading(false);
      }
    })();

    loadProjectInFlightRef.current = { projectId, fastLoading, promise: request };
    void request.finally(() => {
      if (loadProjectInFlightRef.current?.promise === request) loadProjectInFlightRef.current = null;
    });
    return request;
  }, [projectId, t, fastLoading]);

  useEffect(() => {
    setLoading(true);
    void loadProject();
  }, [loadProject]);

  // 切换项目时重置依赖守卫，重新核查
  useEffect(() => { setDepsReady(false); }, [projectId]);

  // 打开预览即记录一次「最后启动时间」（后端集中存于 mini-apps/launch-times.json）
  useEffect(() => {
    if (!projectId) return;
    sdk.miniApp.markLaunched(projectId).catch(() => {});
  }, [projectId]);

  // Electron 标题栏展示 mini-app 自己的图标与名称（electron-titlebar.tsx 监听）
  useEffect(() => {
    if (!project) return;
    window.dispatchEvent(
      new CustomEvent('electron-titlebar:meta', {
        detail: {
          title: project.name,
          icon: project.icon,
          avatarUrl: project.avatarUrl ? sdk.miniApp.getAvatarUrl(project.id) : undefined,
        },
      }),
    );
    return () => {
      window.dispatchEvent(new CustomEvent('electron-titlebar:meta', { detail: null }));
    };
  }, [project]);

  useEffect(() => {
    runtimeContextRef.current = runtimeContext;
  }, [runtimeContext]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      const data = event.data;
      if (!data || data.source !== MINI_APP_RUNTIME_INIT_SOURCE) return;
      console.debug('[mini-app-preview] received runtime init', data);
      const nextRuntimeContext = {
        route: typeof data.route === 'string' && data.route.trim() ? data.route : '/',
        params: data.params && typeof data.params === 'object' && !Array.isArray(data.params)
          ? data.params as Record<string, unknown>
          : {},
      };
      if (runtimeContextEquals(runtimeContextRef.current, nextRuntimeContext)) {
        console.debug('[mini-app-preview] runtime init unchanged, skip update', nextRuntimeContext);
        return;
      }
      setRuntimeContext(nextRuntimeContext);
    };

    window.addEventListener('message', handleMessage);
    window.parent?.postMessage({
      source: MINI_APP_RUNTIME_READY_SOURCE,
      projectId,
      currentRuntimeContext: runtimeContextRef.current,
    }, '*');
    console.debug('[mini-app-preview] runtime listener ready', { projectId, runtimeContext: runtimeContextRef.current });
    return () => window.removeEventListener('message', handleMessage);
  }, [projectId]);

  useEffect(() => {
    (window as typeof window & { __FLOW_SPACES_MINIAPP_RUNTIME__?: MiniAppRuntimeContext }).__FLOW_SPACES_MINIAPP_RUNTIME__ = runtimeContext;
    console.debug('[mini-app-preview] broadcast runtime context', runtimeContext);
    window.dispatchEvent(new CustomEvent(MINI_APP_RUNTIME_EVENT, { detail: runtimeContext }));
  }, [runtimeContext]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(var(--app-content-height)-var(--electron-titlebar-height,0px))]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return <div className="flex items-center justify-center h-[calc(var(--app-content-height)-var(--electron-titlebar-height,0px))] text-muted-foreground">Project not found</div>;
  }

  // 声明了插件/工作流依赖才走守卫核查；未声明的项目直接渲染（避免多一帧核查 loading）
  const hasDeclaredDeps = Boolean(project.enabledPlugins?.length || project.enabledWorkflows?.length);

  return (
    <div className={`h-[calc(var(--app-content-height)-var(--electron-titlebar-height,0px))] flex flex-col ${embedded ? 'overflow-auto' : 'overflow-hidden'}`}>
      {host}
      <div className={`flex-1 min-h-0 ${embedded ? 'overflow-auto' : 'overflow-hidden'}`}>
        {depsReady || !hasDeclaredDeps ? (
          <MiniAppPreview
            type={project.type}
            sourceCode={sourceCode}
            error={error}
            onError={setError}
            projectId={project.id}
            projectName={project.name}
            hideHeader={embedded}
            onReload={loadProject}
            enabledPlugins={project.enabledPlugins}
            enableAgents={project.enableAgents}
            agentChatPlacement={project.agentChatPlacement}
            devices={project.devices}
            files={allFiles}
            mainFile={project.mainFile}
            compiled={Boolean(distBundle)}
            compiledCss={distBundle?.css}
            allowScroll={embedded}
          />
        ) : (
          <MiniAppDependencyGuard project={project} onPass={() => setDepsReady(true)} />
        )}
      </div>
    </div>
  );
}
