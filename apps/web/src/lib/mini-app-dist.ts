export interface MiniAppDistBundle {
  code: string;
  css?: string;
}

/** 与源码模式使用相同宿主实例执行 CommonJS 组件，不加载 Babel。 */
export function evaluateMiniAppDist(
  code: string,
  resolveExternal: (id: string) => unknown,
  react: unknown,
  reactDom: unknown,
  inspectorProjectId?: string,
): unknown {
  const module = { exports: {} as { default?: unknown } };
  const require = (id: string) => {
    if (id === '@flow-spaces/mini-app-inspector/jsx-dev-runtime') {
      const host = react as {
        Fragment: unknown;
        createElement: (type: unknown, props: Record<string, unknown>) => unknown;
      };
      return {
        Fragment: host.Fragment,
        jsxDEV: (type: unknown, props: Record<string, unknown>, key: unknown, _static: boolean,
          source?: { fileName: string; lineNumber: number; columnNumber: number }) => {
          const filePath = source?.fileName.replace(/\\/g, '/');
          const inspectable = inspectorProjectId && typeof type === 'string' && filePath
            && !filePath.startsWith('/') && !filePath.includes(':') && !filePath.split('/').includes('..');
          return host.createElement(type, {
            ...props,
            ...(key === undefined ? {} : { key }),
            ...(inspectable ? {
              'data-mini-app-source-project': inspectorProjectId,
              'data-mini-app-source-file': filePath,
              'data-mini-app-source-line': String(source!.lineNumber),
              'data-mini-app-source-column': String(source!.columnNumber),
            } : {}),
          });
        },
      };
    }
    const value = resolveExternal(id);
    if (value === undefined) throw new Error(`Unsupported dist external module: ${id}`);
    return value;
  };
  const fn = new Function('React', 'ReactDOM', 'exports', 'require', 'module', code);
  fn(react, reactDom, module.exports, require, module);
  if (!module.exports.default) throw new Error('React custom view must export a default component.');
  return module.exports.default;
}

/** 缺少 dist 或连接旧版服务器时继续使用源码加载。 */
export async function loadMiniAppDist(
  api: { getDist: (id: string) => Promise<MiniAppDistBundle | null> },
  projectId: string,
): Promise<MiniAppDistBundle | null> {
  try {
    const bundle = await api.getDist(projectId);
    return bundle && typeof bundle.code === 'string' && bundle.code.trim() ? bundle : null;
  } catch (error) {
    console.warn('[mini-app] dist unavailable, loading source', { projectId, error });
    return null;
  }
}
