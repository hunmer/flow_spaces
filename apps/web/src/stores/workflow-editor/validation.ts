import type { Workflow } from '@flow-spaces/shared';
import { getTranslator } from 'next-intl';

export function validateWorkflowExecution(wf: Workflow): string | null {
  const nodeIds = new Set(wf.nodes.map(n => n.id));
  const hasConnectedNodes = wf.edges.some(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target));
  if (!hasConnectedNodes) return getTranslator('workflows.execution')('connectNodesFirst');

  for (const edge of wf.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
  }
  return null;
}