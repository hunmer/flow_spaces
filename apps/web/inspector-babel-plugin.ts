import { InspectorBabelPlugin as inspectorPlugin } from "@react-dev-inspector/babel-plugin";

// React Refresh 会重新访问 memo/forwardRef 内的 JSX；上游插件每次都追加标记。
export default function inspectorPluginOnce(
  ...args: Parameters<typeof inspectorPlugin>
): ReturnType<typeof inspectorPlugin> {
  const plugin = inspectorPlugin(...args);
  const visitor = plugin.visitor?.JSXOpeningElement;
  if (!visitor || typeof visitor !== "object" || typeof visitor.enter !== "function") {
    throw new Error("Inspector JSX visitor is unavailable");
  }
  const inject = visitor.enter;
  visitor.enter = function (path, state) {
    const hasSource = path.node.attributes.some(
      (attribute) => attribute.type === "JSXAttribute"
        && attribute.name.type === "JSXIdentifier"
        && attribute.name.name === "data-inspector-relative-path",
    );
    if (!hasSource) inject.call(this, path, state);
  };
  return plugin;
}
