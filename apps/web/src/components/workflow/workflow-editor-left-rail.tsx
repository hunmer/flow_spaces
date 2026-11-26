'use client';

import React from 'react';
import { AnimatePresence, motion as m } from 'motion/react';
import { useTranslations } from 'next-intl';
import { Braces, PanelLeftClose, Palette, Waypoints, type LucideIcon } from 'lucide-react';
// fs-rail-tokens (rail-tokens.css): scoped uiarc design tokens shared with the
// app SidebarRail — the collapsed rail look requested for this panel.
import '@/components/sidebar-rail/rail-tokens.css';
import { Tooltip } from '@/components/sidebar-rail/Tooltip';

export type WorkflowLeftPanelId = 'node-sidebar' | 'canvas-style' | 'variables';

const PANEL_WIDTH = 284;

export const WORKFLOW_LEFT_PANELS: { id: WorkflowLeftPanelId; icon: LucideIcon; labelKey: 'nodesTab' | 'styleTab' | 'variablesTab' }[] = [
  { id: 'node-sidebar', icon: Waypoints, labelKey: 'nodesTab' },
  { id: 'canvas-style', icon: Palette, labelKey: 'styleTab' },
  { id: 'variables', icon: Braces, labelKey: 'variablesTab' },
];

/**
 * Floating vertical quick rail living INSIDE the canvas (workflow_automation_ui
 * style: absolute top-left column of 38px round buttons). Clicking an icon
 * switches / collapses the in-flow sidebar panel (WorkflowEditorLeftPanel).
 */
export function WorkflowEditorLeftRail({
  activePanel,
  onSelectPanel,
}: {
  activePanel: WorkflowLeftPanelId | null;
  onSelectPanel: (panel: WorkflowLeftPanelId | null) => void;
}) {
  const t = useTranslations('workflows.editor');

  return (
    <div className="fs-rail-tokens pointer-events-none absolute left-5 top-6 z-30 flex flex-col gap-3">
      <style>{`
        .workflow-left-rail-btn {
          width: 38px;
          height: 38px;
          border-radius: 9999px;
          border: 1px solid var(--border);
          background: var(--surface-muted);
          color: var(--foreground);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .workflow-left-rail-btn:hover {
          background: color-mix(in oklab, var(--foreground) 8%, var(--surface-muted));
          transform: scale(1.08);
        }
        .workflow-left-rail-btn:active { transform: scale(0.96); }
        .workflow-left-rail-btn[data-active='true'] {
          background: var(--foreground);
          border-color: var(--foreground);
          color: var(--background);
        }
        .workflow-left-rail-btn[data-active='true']:hover {
          background: var(--foreground);
        }
      `}</style>

      {WORKFLOW_LEFT_PANELS.map(panel => {
        const Icon = panel.icon;
        const active = activePanel === panel.id;
        const button = (
          <button
            type="button"
            className="workflow-left-rail-btn nodrag nopan pointer-events-auto"
            data-active={active}
            title={t(panel.labelKey)}
            aria-label={t(panel.labelKey)}
            aria-pressed={active}
            onClick={() => onSelectPanel(active ? null : panel.id)}
          >
            <Icon className="h-[17px] w-[17px]" strokeWidth={1.75} />
          </button>
        );
        // Tooltips only while collapsed (matches SidebarRail collapsed rail UX)
        return activePanel === null ? (
          <Tooltip key={panel.id} content={t(panel.labelKey)} side="right">
            {button}
          </Tooltip>
        ) : (
          <React.Fragment key={panel.id}>{button}</React.Fragment>
        );
      })}
    </div>
  );
}

/**
 * In-flow left sidebar card (SidebarRail collapsed style: fs-rail-tokens,
 * 14px radius, --rail surface, raised shadow). Participates in the flex row —
 * expanding it shrinks the canvas region instead of floating above it.
 */
export function WorkflowEditorLeftPanel({
  activePanel,
  onSelectPanel,
  children,
}: {
  activePanel: WorkflowLeftPanelId | null;
  onSelectPanel: (panel: WorkflowLeftPanelId | null) => void;
  children: React.ReactNode;
}) {
  const t = useTranslations('workflows.editor');
  const activeDef = WORKFLOW_LEFT_PANELS.find(panel => panel.id === activePanel) ?? null;

  return (
    <div className="fs-rail-tokens flex h-full min-h-0 shrink-0 items-stretch">
      <style>{`
        .workflow-left-rail-panel {
          --rail: color-mix(in oklab, var(--surface-muted) 55%, var(--surface));
          background: var(--rail);
        }
        :root.dark .workflow-left-rail-panel,
        :root[data-theme="dark"] .workflow-left-rail-panel {
          --rail: color-mix(in oklab, var(--background) 60%, var(--surface));
        }
      `}</style>

      <AnimatePresence initial={false}>
        {activePanel && activeDef ? (
          <m.aside
            key="workflow-left-rail-panel"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: PANEL_WIDTH, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="h-full shrink-0 overflow-hidden"
          >
            <div
              className="workflow-left-rail-panel flex h-full flex-col overflow-hidden rounded-[14px] border text-[var(--foreground)]"
              style={{
                width: PANEL_WIDTH,
                borderColor: 'var(--border)',
                boxShadow: 'var(--shadow-raised)',
              }}
            >
              <header className="flex h-11 flex-none items-center gap-2 border-b px-3" style={{ borderColor: 'var(--border-subtle)' }}>
                <activeDef.icon className="h-4 w-4 flex-none" strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {t(activeDef.labelKey)}
                </span>
                <button
                  type="button"
                  className="nodrag nopan inline-flex h-6 w-6 flex-none cursor-pointer items-center justify-center rounded-md transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  title={t('collapseLeftPanel')}
                  aria-label={t('collapseLeftPanel')}
                  onClick={() => onSelectPanel(null)}
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </header>
              {/* Neutralize the embedded panels' own edge borders so they sit
                  flush inside the rounded card (node-sidebar has border-r). */}
              <div className="min-h-0 flex-1 overflow-hidden [&>div]:border-r-0">
                {children}
              </div>
            </div>
          </m.aside>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
