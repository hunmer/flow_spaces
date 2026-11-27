"use client";

import { useEffect } from "react";

function updateViewportInsets() {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  const visualViewportHeight = viewport?.height ?? window.innerHeight;
  const visualKeyboardHeight = viewport
    ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
    : 0;
  const keyboardHeight = visualKeyboardHeight;
  const viewportHeight = visualKeyboardHeight > 0
    ? visualViewportHeight
    : Math.max(0, window.innerHeight - keyboardHeight);
  const contentHeight = viewportHeight;

  root.style.setProperty("--app-viewport-height", `${viewportHeight}px`);
  root.style.setProperty("--app-content-height", `${contentHeight}px`);
  root.style.setProperty("--keyboard-inset-height", `${keyboardHeight}px`);
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return target.matches("input, textarea, [contenteditable='true'], [contenteditable='']");
}

function refreshAfterEditableFocus(target: EventTarget | null) {
  if (!isEditableTarget(target)) return;

  const element = target as HTMLElement;
  const refresh = () => {
    updateViewportInsets();
    element.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  refresh();
  window.setTimeout(refresh, 60);
  window.setTimeout(refresh, 180);
  window.setTimeout(refresh, 360);
}

export function ViewportInsets() {
  useEffect(() => {
    updateViewportInsets();

    const handleFocusIn = (event: FocusEvent) => refreshAfterEditableFocus(event.target);
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", updateViewportInsets);
    viewport?.addEventListener("scroll", updateViewportInsets);
    window.addEventListener("resize", updateViewportInsets);
    window.addEventListener("orientationchange", updateViewportInsets);
    document.addEventListener("focusin", handleFocusIn);

    return () => {
      viewport?.removeEventListener("resize", updateViewportInsets);
      viewport?.removeEventListener("scroll", updateViewportInsets);
      window.removeEventListener("resize", updateViewportInsets);
      window.removeEventListener("orientationchange", updateViewportInsets);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, []);

  return null;
}
