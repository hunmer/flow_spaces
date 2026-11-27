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
): unknown {
  const module = { exports: {} as { default?: unknown } };
  const require = (id: string) => {
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
