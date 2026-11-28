import { useCallback, useEffect, useRef, useState } from "react";
import { Inspector, gotoServerEditor } from "react-dev-inspector";
import { MousePointer2 } from "lucide-react";
import { sdk } from "@/lib/sdk";

/**
 * 开发态组件源码定位器（移植自 agent_spaces packages/web/src/components/layout/dev-inspector.tsx）。
 *
 * 依赖两处 dev 配置（见 apps/web/vite.config.ts）：
 *   - @react-dev-inspector/babel-plugin：往 JSX 根元素注入
 *     data-inspector-relative-path / -line / -column 属性（getCodeInfo 第一优先级来源）；
 *   - @react-dev-inspector/vite-plugin 的 inspectorServer()：dev server 挂载
 *     launchEditorMiddleware，gotoServerEditor 请求 /__launch-editor 打开编辑器。
 *
 * 使用：右下角鼠标按钮切换，或热键 Mac: Ctrl+Shift+Cmd+C / 其他: Ctrl+Shift+Alt+C。
 * 生产构建（NODE_ENV !== "development"）整体不渲染。
 */

type ReactFiber = {
  return?: ReactFiber | null;
  _debugSource?: {
    fileName?: string;
    lineNumber?: number;
    columnNumber?: number;
  };
  _debugOwner?: ReactFiber | null;
};

type FiberElement = Element & {
  [key: string]: ReactFiber | undefined;
};

function getFiber(element: Element | null): ReactFiber | undefined {
  if (!element) return undefined;

  const fiberKey = Object.keys(element).find(
    (key) =>
      key.startsWith("__reactFiber$") ||
      key.startsWith("__reactInternalInstance$")
  );

  if (fiberKey) return (element as FiberElement)[fiberKey];
  return getFiber(element.parentElement);
}

function getCodeInfo(element: Element) {
  const sourceElement = element.closest(
    "[data-inspector-relative-path]"
  );

  const relativePath = sourceElement?.getAttribute("data-inspector-relative-path");
  if (relativePath) {
    return {
      relativePath,
      lineNumber: sourceElement?.getAttribute("data-inspector-line") ?? "1",
      columnNumber: sourceElement?.getAttribute("data-inspector-column") ?? "1",
    };
  }

  let fiber = getFiber(element);

  while (fiber) {
    const source = fiber._debugSource ?? fiber._debugOwner?._debugSource;

    if (source?.fileName && source.lineNumber) {
      return {
        absolutePath: source.fileName,
        lineNumber: String(source.lineNumber),
        columnNumber: String(source.columnNumber ?? 1),
      };
    }

    fiber = fiber.return ?? undefined;
  }

  return undefined;
}

export function DevInspector() {
  const [active, setActive] = useState(false);
  const [mounted, setMounted] = useState(false);
  const inspectedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const inspectElement = useCallback(async (target: Element) => {
    // 原生捕获监听与 Inspector 回调可能处理同一次点击。
    if (inspectedRef.current) return;
    inspectedRef.current = true;
    setActive(false);
    const miniAppSource = target.closest("[data-mini-app-source-file]");
    if (miniAppSource) {
      try {
        const absolutePath = await sdk.miniApp.getSourceFileAbsolutePath(
          miniAppSource.getAttribute("data-mini-app-source-project")!,
          miniAppSource.getAttribute("data-mini-app-source-file")!,
        );
        gotoServerEditor({
          absolutePath,
          lineNumber: miniAppSource.getAttribute("data-mini-app-source-line") ?? "1",
          columnNumber: miniAppSource.getAttribute("data-mini-app-source-column") ?? "1",
        });
      } catch (error) {
        console.error("[dev-inspector] 无法解析 miniapp 源码位置", error);
      }
      return;
    }

    const codeInfo = getCodeInfo(target);

    if (codeInfo) {
      gotoServerEditor(codeInfo);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    inspectedRef.current = false;

    const handleClick = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.target instanceof Element) void inspectElement(event.target);
    };

    window.addEventListener("click", handleClick, true);
    return () => window.removeEventListener("click", handleClick, true);
  }, [active, inspectElement]);

  if (process.env.NODE_ENV !== "development") return null;
  if (!mounted) return null;

  const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
  const inspectorKeys = isMac
    ? ["Ctrl", "Shift", "Command", "C"]
    : ["Ctrl", "Shift", "Alt", "C"];
  const hotkey = inspectorKeys.join(" + ");

  return (
    <>
      <Inspector
        keys={inspectorKeys}
        active={active}
        onActiveChange={setActive}
        onClickElement={({ element }) => { void inspectElement(element); }}
        onInspectElement={() => {}}
      />
      <button
        type="button"
        // React Aria Modal 会将弹窗外元素设为 inert，顶层标记保留定位入口。
        data-react-aria-top-layer=""
        onClick={() => setActive((value) => !value)}
        aria-pressed={active}
        title={`Inspect React component source (${hotkey})`}
        className="fixed bottom-3 right-3 z-[2147483647] flex h-8 w-8 items-center justify-center rounded border border-border bg-background shadow hover:bg-muted"
      >
        <MousePointer2 className={active ? "text-primary" : "text-muted-foreground"} size={16} />
      </button>
    </>
  );
}
