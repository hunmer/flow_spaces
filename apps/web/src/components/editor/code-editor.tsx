"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorSelection, Prec, StateEffect, StateField, type Extension } from "@codemirror/state";
import {
  EditorView,
  Decoration,
  drawSelection,
  dropCursor,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  type DecorationSet,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab, redo, undo } from "@codemirror/commands";
import { bracketMatching, defaultHighlightStyle, foldGutter, foldKeymap, indentOnInput, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { openSearchPanel, search, searchKeymap } from "@codemirror/search";
import { oneDark } from "@codemirror/theme-one-dark";
import { languageExtension } from "@/lib/code-languages";
import { useTheme } from "@/components/layout/theme-provider";

/**
 * CodeMirror 6 编辑器（Monaco 替代品）。
 *
 * 兼容旧 Monaco 用法的 props（value/language/height/theme/options/onChange），
 * 深层 Monaco API（模型缓存/动作注册/goto-definition）不再提供。
 */

export type CodeEditorTheme = "light" | "dark" | "vs" | "vs-dark";

export interface CodeEditorOptions {
  /** 只读：光标与选区保留，可复制；不可编辑。 */
  readOnly?: boolean;
  fontSize?: number;
  wordWrap?: boolean | "on" | "off";
  lineNumbers?: boolean | "on" | "off" | "relative" | "interval";
  folding?: boolean;
  renderLineHighlight?: "none" | "line" | "gutter" | "all";
  padding?: { top?: number; bottom?: number };
  /** Monaco 兼容：以下常见选项被接受但忽略。 */
  minimap?: unknown;
  scrollBeyondLastLine?: boolean;
  domReadOnly?: boolean;
  automaticLayout?: boolean;
  glyphMargin?: boolean;
  formatOnPaste?: boolean;
  bracketPairColorization?: unknown;
  renderValidationDecorations?: unknown;
  overviewRulerLanes?: number;
  quickSuggestions?: unknown;
  [key: string]: unknown;
}

export interface CodeEditorSelection {
  text: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}

export type CodeEditorAction =
  | "undo"
  | "redo"
  | "find"
  | "replace"
  | "copy"
  | "cut"
  | "paste";

export interface CodeEditorHandle {
  focus(): void;
  getDomNode(): HTMLDivElement | null;
  getValue(): string;
  setValue(value: string): void;
  getSelection(): CodeEditorSelection | null;
  setSelection(line: number, column?: number, endLine?: number, endColumn?: number, options?: { flash?: boolean }): void;
  revealLineInCenter(line: number): void;
  runAction(action: CodeEditorAction): boolean;
}

export interface CodeEditorProps {
  value?: string;
  language?: string;
  path?: string;
  height?: string;
  theme?: CodeEditorTheme;
  options?: CodeEditorOptions;
  placeholder?: string;
  onChange?: (value: string) => void;
  onSave?: () => void;
  onMount?: (handle: CodeEditorHandle) => void;
}

/** pendingJump 命中时的短暂高亮（对齐 Monaco symbolHighlight 视觉）。 */
const flashEffect = StateEffect.define<{ from: number; to: number } | null>();

const flashField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    value = value.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(flashEffect)) {
        return effect.value
          ? Decoration.set([Decoration.mark({ class: "cm-flash-selection" }).range(effect.value.from, effect.value.to)])
          : Decoration.none;
      }
    }
    return value;
  },
  provide: (field) => EditorView.decorations.from(field),
});

function normalizeTheme(theme: CodeEditorTheme | undefined, resolvedTheme: "light" | "dark"): "light" | "dark" {
  if (theme === "dark" || theme === "vs-dark") return "dark";
  if (theme === "light" || theme === "vs") return "light";
  return resolvedTheme;
}

function buildBaseTheme(fontSize: number, padding?: { top?: number; bottom?: number }): Extension {
  return EditorView.theme({
    "&": {
      fontSize: `${fontSize}px`,
      height: "100%",
    },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": {
      fontFamily: "var(--font-mono), ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
      lineHeight: 1.6,
    },
    ".cm-content": {
      paddingTop: `${padding?.top ?? 4}px`,
      paddingBottom: `${padding?.bottom ?? 12}px`,
    },
    ".cm-scroller::-webkit-scrollbar": { width: "10px", height: "10px" },
    ".cm-scroller::-webkit-scrollbar-thumb": {
      backgroundColor: "rgba(128,128,128,0.25)",
      borderRadius: "5px",
    },
    ".cm-scroller::-webkit-scrollbar-thumb:hover": { backgroundColor: "rgba(128,128,128,0.4)" },
    ".cm-scroller::-webkit-scrollbar-track": { backgroundColor: "transparent" },
  });
}

export function CodeEditor(props: CodeEditorProps) {
  const { value, language, path, height = "100%", theme, options = {}, placeholder, onChange, onSave, onMount } = props;
  const { resolvedTheme } = useTheme();

  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const onMountRef = useRef(onMount);
  const mountedRef = useRef(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
    onSaveRef.current = onSave;
    onMountRef.current = onMount;
  });

  const isReadOnly = options.readOnly === true;
  const fontSize = typeof options.fontSize === "number" ? options.fontSize : 13;
  const wordWrap = options.wordWrap === true || options.wordWrap === "on";
  const showLineNumbers = options.lineNumbers !== "off" && options.lineNumbers !== false;
  const folding = options.folding !== false; // 默认开启
  const lineHighlight = options.renderLineHighlight ?? "line";
  const isDark = normalizeTheme(theme, resolvedTheme) === "dark";

  const extensions = useMemo<Extension[]>(() => {
    const list: Extension[] = [];
    if (onSave) {
      list.push(
        Prec.high(
          keymap.of([
            {
              key: "Mod-s",
              preventDefault: true,
              run: () => {
                onSaveRef.current?.();
                return true;
              },
            },
          ])
        )
      );
    }
    list.push(
      history(),
      drawSelection(),
      dropCursor(),
      indentOnInput(),
      indentUnit.of("  "),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      bracketMatching(),
      closeBrackets(),
      search({ top: true }),
      keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...searchKeymap, ...foldKeymap, indentWithTab]),
      flashField,
      buildBaseTheme(fontSize, options.padding)
    );
    if (wordWrap) list.push(EditorView.lineWrapping);
    if (showLineNumbers) list.push(lineNumbers());
    if (folding) list.push(foldGutter());
    if (lineHighlight !== "none") {
      if (lineHighlight === "gutter") list.push(highlightActiveLineGutter());
      else list.push(highlightActiveLine(), highlightActiveLineGutter());
    }
    const langExt = languageExtension(language, path);
    if (langExt) list.push(langExt);
    if (isDark) list.push(oneDark);
    return list;
  }, [folding, fontSize, isDark, language, lineHighlight, onSave, options.padding, path, showLineNumbers, wordWrap]);

  const getHandle = useCallback((): CodeEditorHandle => {
    const getView = () => viewRef.current;
    return {
      focus: () => getView()?.focus(),
      getDomNode: () => getView()?.dom as HTMLDivElement | null ?? null,
      getValue: () => getView()?.state.doc.toString() ?? "",
      setValue: (next: string) => {
        const view = getView();
        if (!view) return;
        const current = view.state.doc.toString();
        if (current !== next) {
          view.dispatch({ changes: { from: 0, to: current.length, insert: next } });
        }
      },
      getSelection: () => {
        const view = getView();
        if (!view) return null;
        const { from, to } = view.state.selection.main;
        if (from === to) return null;
        const start = view.state.doc.lineAt(from);
        const end = view.state.doc.lineAt(to);
        return {
          text: view.state.sliceDoc(from, to),
          line: start.number,
          column: from - start.from + 1,
          endLine: end.number,
          endColumn: to - end.from + 1,
        };
      },
      setSelection: (line, column = 1, endLine, endColumn, selectOptions) => {
        const view = getView();
        if (!view) return;
        const total = view.state.doc.lines;
        const startLine = Math.min(Math.max(1, Math.floor(line)), total);
        const start = view.state.doc.line(startLine);
        const from = Math.min(start.from + Math.max(0, Math.floor(column) - 1), start.to);
        let head = from;
        if (endLine !== undefined) {
          const targetLine = Math.min(Math.max(1, Math.floor(endLine)), total);
          const target = view.state.doc.line(targetLine);
          head = Math.min(target.from + Math.max(0, Math.floor(endColumn ?? 1) - 1), target.to);
        }
        const effects: StateEffect<unknown>[] = [EditorView.scrollIntoView(head, { y: "center" })];
        if (selectOptions?.flash !== false) {
          effects.push(flashEffect.of({ from, to: Math.max(head, from) }));
        }
        view.dispatch({
          selection: EditorSelection.single(from, head),
          effects,
        });
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => {
          const current = viewRef.current;
          if (current) current.dispatch({ effects: flashEffect.of(null) });
        }, 700);
      },
      revealLineInCenter: (line) => {
        const view = getView();
        if (!view) return;
        const target = Math.min(Math.max(1, Math.floor(line)), view.state.doc.lines);
        const pos = view.state.doc.line(target).from;
        view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: "center" }) });
      },
      runAction: (action) => {
        const view = getView();
        if (!view) return false;
        switch (action) {
          case "undo":
            return undo(view);
          case "redo":
            return redo(view);
          case "find":
          case "replace":
            openSearchPanel(view);
            return true;
          case "copy":
          case "cut": {
            const selection = view.state.selection.main;
            if (selection.empty) return false;
            const text = view.state.sliceDoc(selection.from, selection.to);
            void navigator.clipboard?.writeText(text);
            if (action === "cut" && !view.state.readOnly) {
              view.dispatch({ changes: { from: selection.from, to: selection.to } });
            }
            return true;
          }
          case "paste": {
            if (view.state.readOnly) return false;
            void navigator.clipboard
              ?.readText()
              .then((text) => {
                if (text) {
                  const current = viewRef.current;
                  if (!current) return;
                  const selection = current.state.selection.main;
                  current.dispatch({
                    changes: { from: selection.from, to: selection.to, insert: text },
                    selection: { anchor: selection.from + text.length },
                  });
                }
              })
              .catch(() => undefined);
            return true;
          }
          default:
            return false;
        }
      },
    };
  }, []);

  const handleCreateEditor = useCallback(
    (view: EditorView) => {
      viewRef.current = view;
      if (!mountedRef.current) {
        mountedRef.current = true;
        onMountRef.current?.(getHandle());
      }
    },
    [getHandle]
  );

  const handleChangeInternal = useCallback((next: string) => {
    onChangeRef.current?.(next);
  }, []);

  useEffect(
    () => () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      viewRef.current = null;
    },
    []
  );

  return (
    <CodeMirror
      value={value ?? ""}
      height={height}
      theme="none"
      extensions={extensions}
      placeholder={placeholder}
      readOnly={isReadOnly}
      editable={!isReadOnly}
      basicSetup={false}
      onChange={handleChangeInternal}
      onCreateEditor={handleCreateEditor}
    />
  );
}

export default CodeEditor;
