"use client";

import * as React from "react";
import { cx } from "@/utils/cx";

/**
 * Local, dependency-free replacement for Base UI's `useRender` / `mergeProps`
 * (the polymorphic `render={<Element/>}` pattern), so UI components can drop
 * the Base UI dependency while keeping their exact prop surface.
 *
 * Semantics (matching how this codebase uses Base UI):
 * - `mergeProps(a, b, …)` shallow-merges; `className` is concatenated with
 *   cx() and `style` objects are combined; later arguments win otherwise.
 * - `useRender({ defaultTagName, props, render, state })`:
 *   - no `render` → renders `defaultTagName` with the merged props;
 *   - `render` as a ReactElement → cloneElement with merged props
 *     (element's own props lose to the incoming ones except className/style,
 *     which are combined; children come from the incoming props unless the
 *     element provides its own);
 *   - `render` as a function → called with (props, state).
 * - `state` keys become `data-*` attributes (kebab-cased; `true` → empty
 *   string, falsy keys are omitted), e.g. `{ slot: "x", sidebar: "y" }` →
 *   `data-slot="x" data-sidebar="y"`.
 */

export type RenderProp =
  | React.ReactElement
  | ((props: Record<string, unknown>, state?: Record<string, unknown>) => React.ReactElement);

type AnyRecord = Record<string, any> | undefined;

function mergePair(a: AnyRecord, b: AnyRecord): Record<string, any> {
  if (!a) return { ...(b ?? {}) };
  if (!b) return { ...a };
  const out: Record<string, any> = { ...a, ...b };
  if (a.className != null || b.className != null) {
    out.className = cx(a.className, b.className);
  }
  if (a.style != null || b.style != null) {
    out.style = { ...a.style, ...b.style };
  }
  return out;
}

export function mergeProps<E = unknown>(...sets: AnyRecord[]): Record<string, any> {
  return sets.reduce<Record<string, any>>((acc, cur) => mergePair(acc, cur), {});
}

function stateToAttrs(state?: Record<string, unknown>): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};
  if (!state) return attrs;
  for (const [key, value] of Object.entries(state)) {
    if (value === false || value == null) continue;
    const kebab = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    attrs[`data-${kebab}`] = value === true ? "" : value;
  }
  return attrs;
}

export interface UseRenderOptions {
  defaultTagName: keyof React.JSX.IntrinsicElements;
  props?: Record<string, any>;
  render?: RenderProp;
  state?: Record<string, unknown>;
}

export function useRender({
  defaultTagName,
  props,
  render,
  state,
}: UseRenderOptions): React.ReactElement {
  const finalProps = mergePair(stateToAttrs(state), props);

  if (render == null) {
    return React.createElement(defaultTagName, finalProps);
  }

  if (typeof render === "function") {
    return render(finalProps, state);
  }

  const element = render as React.ReactElement<Record<string, any>>;
  const elementProps = (element.props ?? {}) as Record<string, any>;
  const { children: elementChildren, ...restElementProps } = elementProps;
  const merged = mergePair(restElementProps, finalProps);
  if (elementChildren !== undefined && finalProps.children === undefined) {
    merged.children = elementChildren;
  }
  return React.cloneElement(element, merged);
}

export declare namespace useRender {
  type ComponentProps<E extends keyof React.JSX.IntrinsicElements> = React.ComponentProps<E> & {
    render?: RenderProp;
  };
}
