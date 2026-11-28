import type { packages } from '@babel/standalone';

/** 浏览器源码编译专用；仅给原生元素标记，避免依赖组件透传 props。 */
export function miniAppInspectorPlugin(projectId: string, filePath: string) {
  return ({ types: t }: { types: typeof packages.types }) => ({
    visitor: {
      JSXOpeningElement({ node }: { node: ReturnType<typeof t.jsxOpeningElement> }) {
        if (!t.isJSXIdentifier(node.name) || !/^[a-z]/.test(node.name.name) || !node.loc) return;
        const attributes = {
          'data-mini-app-source-project': projectId,
          'data-mini-app-source-file': filePath,
          'data-mini-app-source-line': String(node.loc.start.line),
          'data-mini-app-source-column': String(node.loc.start.column + 1),
        };
        for (const [name, value] of Object.entries(attributes)) {
          node.attributes.push(t.jsxAttribute(t.jsxIdentifier(name), t.stringLiteral(value)));
        }
      },
    },
  });
}
