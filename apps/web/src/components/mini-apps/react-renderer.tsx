/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { Component as ReactComponent, useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import * as ReactJsxRuntime from 'react/jsx-runtime';
import * as ReactJsxDevRuntime from 'react/jsx-dev-runtime';
import { evaluateMiniAppDist } from '@/lib/mini-app-dist';
// @babel/standalone 体积很大（渲染后 5.5MB），且只在编译自定义 React 视图时
// 才需要：动态 import 拆成按需加载的独立 chunk，避免拖累首屏 vendor 体积。
// （旧 Next.js/webpack 项目里此处的 require('@babel/standalone') 会被打包器编译掉）
type BabelStandalone = typeof import('@babel/standalone');
let babelModulePromise: Promise<BabelStandalone> | null = null;
function loadBabel(): Promise<BabelStandalone> {
  babelModulePromise ??= import('@babel/standalone');
  return babelModulePromise;
}
import useEmblaCarousel from 'embla-carousel-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  DragOverlay,
  defaultDropAnimationSideEffects,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  ControlButton,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
  getConnectedEdges,
  NodeResizer,
  NodeToolbar,
  EdgeLabelRenderer,
  useReactFlow,
  useUpdateNodeInternals,
  useNodes,
  ViewportPortal,
  getSimpleBezierPath,
  getBezierPath,
  getSmoothStepPath,
  getViewportForBounds,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre, { graphlib } from '@dagrejs/dagre';
import * as htmlToImagePkg from 'html-to-image';
import * as diffPkg from 'diff';
import * as pinyinPkg from 'tiny-pinyin';
import * as FlowSpacesUI from '@/lib/ui-exports';
import { LocaleIntlProvider, useLocale } from '@/components/layout/locale-provider';
import { getTranslator } from 'next-intl';

interface RenderErrorBoundaryProps {
  onError: (error: string | null) => void;
  children?: React.ReactNode;
}

interface RenderErrorBoundaryState {
  error: Error | null;
  errorDetail: string;
}

class RenderErrorBoundary extends ReactComponent<RenderErrorBoundaryProps, RenderErrorBoundaryState> {
  state: RenderErrorBoundaryState = { error: null, errorDetail: '' };

  static getDerivedStateFromError(error: Error) {
    return { error, errorDetail: error.stack || error.message };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      errorDetail: `${error.toString()}\n\nComponent stack:${errorInfo.componentStack}`,
    });
  }

  render() {
    if (this.state.error) {
      const handleCopy = () => navigator.clipboard?.writeText(this.state.errorDetail);
      const t = getTranslator('mini-apps');
      return (
        <div className="flex flex-col items-center justify-center h-full text-destructive text-sm gap-2">
          <div className="flex items-start gap-2 max-w-full">
            <p className="break-all">{this.state.error.message}</p>
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 p-1 rounded hover:bg-destructive/10 text-destructive/70 hover:text-destructive transition-colors"
              title={t('renderer.copyFullError')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
              </svg>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

type MiniAppRootRecord = {
  root: ReactDOM.Root;
  unmountTimer: ReturnType<typeof setTimeout> | null;
};

const miniAppRootRecords = new WeakMap<HTMLDivElement, MiniAppRootRecord>();

function getMiniAppRoot(container: HTMLDivElement): ReactDOM.Root {
  const existing = miniAppRootRecords.get(container);
  if (existing) {
    if (existing.unmountTimer) {
      clearTimeout(existing.unmountTimer);
      existing.unmountTimer = null;
    }
    return existing.root;
  }

  const record: MiniAppRootRecord = {
    root: ReactDOM.createRoot(container),
    unmountTimer: null,
  };
  miniAppRootRecords.set(container, record);
  return record.root;
}

export function unmountMiniAppReactRoot(container: HTMLDivElement) {
  const record = miniAppRootRecords.get(container);
  if (!record) return;
  if (record.unmountTimer) {
    clearTimeout(record.unmountTimer);
    record.unmountTimer = null;
  }
  miniAppRootRecords.delete(container);
  try { record.root.unmount(); } catch { /* ignore */ }
}

function scheduleMiniAppReactRootUnmount(container: HTMLDivElement) {
  const record = miniAppRootRecords.get(container);
  if (!record || record.unmountTimer) return;
  record.unmountTimer = setTimeout(() => {
    if (miniAppRootRecords.get(container) !== record) return;
    record.unmountTimer = null;
    unmountMiniAppReactRoot(container);
  }, 0);
}

function resolveExternalModule(id: string) {
  if (id === 'react') return React;
  if (id === 'react/jsx-runtime') return ReactJsxRuntime;
  if (id === 'react/jsx-dev-runtime') return ReactJsxDevRuntime;
  if (id === 'react-dom' || id === 'react-dom/client') return ReactDOM;
  if (id === 'embla-carousel-react') {
    return { __esModule: true, default: useEmblaCarousel };
  }
  if (id === '@dnd-kit/core') {
    return {
      __esModule: true,
      DndContext,
      closestCenter,
      PointerSensor,
      TouchSensor,
      KeyboardSensor,
      DragOverlay,
      defaultDropAnimationSideEffects,
      useDroppable,
      useSensor,
      useSensors,
    };
  }
  if (id === '@dnd-kit/sortable') {
    return {
      __esModule: true,
      SortableContext,
      useSortable,
      arrayMove,
      verticalListSortingStrategy,
      horizontalListSortingStrategy,
      sortableKeyboardCoordinates,
    };
  }
  if (id === '@dnd-kit/utilities') {
    return { __esModule: true, CSS };
  }
  if (id === '@tiptap/react') {
    return { __esModule: true, useEditor, EditorContent };
  }
  if (id === '@tiptap/starter-kit') {
    return { __esModule: true, default: StarterKit };
  }
  if (id === '@tiptap/extension-placeholder') {
    return { __esModule: true, default: Placeholder };
  }
  if (id === '@tiptap/extension-task-list') {
    return { __esModule: true, default: TaskList };
  }
  if (id === '@tiptap/extension-task-item') {
    return { __esModule: true, default: TaskItem };
  }
  if (id === '@xyflow/react') {
    return {
      __esModule: true,
      ReactFlow,
      ReactFlowProvider,
      Background,
      BackgroundVariant,
      Controls,
      MiniMap,
      ControlButton,
      useNodesState,
      useEdgesState,
      addEdge,
      Handle,
      Position,
      applyNodeChanges,
      applyEdgeChanges,
      MarkerType,
      getConnectedEdges,
      NodeResizer,
      NodeToolbar,
      EdgeLabelRenderer,
      useReactFlow,
      useUpdateNodeInternals,
      useNodes,
      ViewportPortal,
      getSimpleBezierPath,
      getBezierPath,
      getSmoothStepPath,
      getViewportForBounds,
    };
  }
  if (id === 'html-to-image') return { __esModule: true, ...htmlToImagePkg };
  if (id === '@dagrejs/dagre') {
    return { __esModule: true, default: dagre, graphlib };
  }
  if (id === '@flow-spaces/ui' || id === '@flow-spaces/ui') {
    // 兼容旧 mini-app 的 @flow-spaces/ui 导入别名（window.FlowSpacesUI 全局同名保留）
    return { __esModule: true, ...FlowSpacesUI };
  }
  if (id === 'diff') {
    return { __esModule: true, ...diffPkg };
  }
  if (id === 'tiny-pinyin') {
    return { __esModule: true, ...pinyinPkg };
  }
  return undefined;
}

interface UseMiniAppReactRendererOptions {
  enabled: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  sourceCode: string;
  onError: (error: string | null) => void;
  componentProps?: Record<string, unknown>;
  files?: Record<string, string>;
  mainFile?: string;
  compiled?: boolean;
}

export function useMiniAppReactRenderer({
  enabled,
  containerRef,
  sourceCode,
  onError,
  componentProps,
  files,
  mainFile,
  compiled: precompiled = false,
}: UseMiniAppReactRendererOptions) {
  const { locale } = useLocale();
  const reactComponentRef = useRef<React.ComponentType<Record<string, unknown>> | null>(null);
  const componentPropsRef = useRef<Record<string, unknown> | undefined>(componentProps);
  const filesRef = useRef<Record<string, string>>(files || {});
  const mainFileRef = useRef<string>(mainFile || 'index.jsx');
  const onErrorRef = useRef(onError);

  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  // Host callbacks can change on every render; they must not recompile and remount the app.
  const reportError = useCallback((error: string | null) => onErrorRef.current(error), []);

  useEffect(() => { componentPropsRef.current = componentProps; }, [componentProps]);
  useEffect(() => { filesRef.current = files || {}; }, [files]);
  useEffect(() => { mainFileRef.current = mainFile || 'index.jsx'; }, [mainFile]);

  useEffect(() => {
    const container = containerRef.current;
    return () => {
      if (container) scheduleMiniAppReactRootUnmount(container);
    };
  }, [containerRef]);

  const renderCompiledReact = useCallback(() => {
    const container = containerRef.current;
    const Component = reactComponentRef.current;
    if (!container || !Component) return;

    const root = getMiniAppRoot(container);
    root.render(
      React.createElement(RenderErrorBoundary, { onError: reportError },
        React.createElement(LocaleIntlProvider, { locale },
          React.createElement(Component, componentPropsRef.current)
        )
      )
    );
    reportError(null);
  }, [containerRef, locale, reportError]);

  const compileReact = useCallback(async (code: string) => {
    if (!containerRef.current) return;

    try {
      if (precompiled) {
        reactComponentRef.current = evaluateMiniAppDist(code, resolveExternalModule, React, ReactDOM) as React.ComponentType<Record<string, unknown>>;
        renderCompiledReact();
        return;
      }
      const Babel = await loadBabel();
      const localFiles = filesRef.current;
      const entryFile = mainFileRef.current;
      const moduleCache = new Map<string, { exports: Record<string, any> }>();

      function resolveLocalPath(fromFile: string, importId: string): string | null {
        if (!importId.startsWith('.')) return null;

        const dir = fromFile.includes('/') ? fromFile.substring(0, fromFile.lastIndexOf('/')) : '';
        let resolved = dir ? `${dir}/${importId}` : importId;
        const parts = resolved.split('/');
        const normalized: string[] = [];
        for (const part of parts) {
          if (part === '' || part === '.') continue;
          if (part === '..') { normalized.pop(); continue; }
          normalized.push(part);
        }
        resolved = normalized.join('/');

        if (localFiles[resolved] !== undefined) return resolved;
        for (const ext of ['.jsx', '.js', '.tsx', '.ts']) {
          const withExt = resolved + ext;
          if (localFiles[withExt] !== undefined) return withExt;
        }
        for (const ext of ['.jsx', '.js']) {
          const idx = resolved + '/index' + ext;
          if (localFiles[idx] !== undefined) return idx;
        }

        return null;
      }

      function compileModule(filePath: string): Record<string, any> {
        const cached = moduleCache.get(filePath);
        if (cached) return cached.exports;

        const modExports: Record<string, any> = {};
        moduleCache.set(filePath, { exports: modExports });

        const source = localFiles[filePath];
        if (source === undefined) throw new Error(`Module not found: ${filePath}`);

        const compiled = Babel.transform(source, {
          presets: ['react'],
          plugins: ['transform-modules-commonjs'],
          filename: filePath,
          sourceType: 'module',
        }).code;

        const localRequire = (id: string) => {
          const externalModule = resolveExternalModule(id);
          if (externalModule !== undefined) return externalModule;
          const resolved = resolveLocalPath(filePath, id);
          if (resolved) return compileModule(resolved);
          return undefined;
        };

        const fn = new Function('React', 'ReactDOM', 'exports', 'require', compiled!);
        fn(React, ReactDOM, modExports, localRequire);
        return modExports;
      }

      const moduleExports: Record<string, any> = {};
      const mainRequire = (id: string) => {
        const externalModule = resolveExternalModule(id);
        if (externalModule !== undefined) return externalModule;
        const resolved = resolveLocalPath(entryFile, id);
        if (resolved) return compileModule(resolved);
        return undefined;
      };

      const compiled = Babel.transform(code, {
        presets: ['react'],
        plugins: ['transform-modules-commonjs'],
        filename: entryFile,
        sourceType: 'module',
      }).code;

      const fn = new Function('React', 'ReactDOM', 'exports', 'require', compiled!);
      fn(React, ReactDOM, moduleExports, mainRequire);

      const Component = moduleExports.default;
      if (!Component) {
        reportError('React custom view must export a default component.');
        return;
      }

      reactComponentRef.current = Component as React.ComponentType<Record<string, unknown>>;
      renderCompiledReact();
      reportError(null);
    } catch (err: any) {
      reportError(err.message || String(err));
    }
  }, [containerRef, reportError, renderCompiledReact, precompiled]);

  useEffect(() => {
    if (!enabled || !sourceCode) return;
    compileReact(sourceCode);
  }, [enabled, sourceCode, compileReact]);

  useEffect(() => {
    if (!enabled) return;
    renderCompiledReact();
  }, [enabled, componentProps, renderCompiledReact]);

  return {
    clearReactRenderer: useCallback(() => {
      const container = containerRef.current;
      if (container) unmountMiniAppReactRoot(container);
      reactComponentRef.current = null;
    }, [containerRef]),
  };
}
