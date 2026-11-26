import { createContext, useContext, useEffect, useState, type RefObject } from 'react';

export const WorkflowNodeContentVisibilityContext = createContext(false);

type VisibilityListener = (visible: boolean) => void;
const observers = new WeakMap<Element, {
  observer: IntersectionObserver;
  listeners: Map<Element, VisibilityListener>;
}>();

/** 只延迟昂贵的属性正文，节点外壳、尺寸和连接点始终保留。 */
export function useWorkflowNodeContentVisible(ref: RefObject<HTMLElement | null>, enabled: boolean): boolean {
  const forceVisible = useContext(WorkflowNodeContentVisibilityContext);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const target = ref.current;
    const root = target?.closest('.react-flow');
    if (!target || !root || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    let batch = observers.get(root);
    if (!batch) {
      const listeners = new Map<Element, VisibilityListener>();
      const observer = new IntersectionObserver(entries => {
        for (const entry of entries) listeners.get(entry.target)?.(entry.isIntersecting);
      }, { root, rootMargin: '200px' });
      batch = { observer, listeners };
      observers.set(root, batch);
    }
    batch.listeners.set(target, setVisible);
    batch.observer.observe(target);
    return () => {
      batch.observer.unobserve(target);
      batch.listeners.delete(target);
      if (batch.listeners.size === 0) {
        batch.observer.disconnect();
        observers.delete(root);
      }
    };
  }, [enabled, ref]);
  return forceVisible || !enabled || visible;
}
