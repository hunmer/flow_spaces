'use client';

import type { WorkflowNode } from '@flow-spaces/shared';
import type { WorkflowTemplatePreset } from '@/components/workflows/workflow-templates';
import { resolveStoreUrl } from './agent-store';
import { sdk } from './sdk';
import { workflowApi } from './workflow-api';

/**
 * 安装工作流模板（商店/导入共用）：
 * - 模板携带的 agents 按 templateId 去重——已存在的 preset 复用，缺的按 createPreset 创建；
 * - 节点上的 agentConfigId 按新旧 id 映射重写；
 * - targetWorkflowId 传入时视为「更新」分支（覆盖同名工作流），否则新建工作流。
 * 提取自 workflows-page 的 handleImportTemplate，供依赖一键安装复用。
 */
export async function installWorkflowTemplate(
  templateData: WorkflowTemplatePreset['data'],
  targetWorkflowId?: string,
): Promise<void> {
  const { name, description, nodes, edges, agents } = templateData;
  const idMap: Record<string, string> = {};

  // 获取已有 agent，按 templateId 去重
  const existingAgents = await sdk.agent.listPresets();
  const byTemplateId = new Map<string, string>();
  for (const agent of existingAgents) {
    if (agent.templateId) {
      byTemplateId.set(agent.templateId, agent.id);
    }
  }

  if (agents) {
    for (const [oldId, agentConfig] of Object.entries(agents)) {
      // 已有同 templateId 的 agent 则复用，不重复创建
      if (agentConfig.templateId && byTemplateId.has(agentConfig.templateId)) {
        idMap[oldId] = byTemplateId.get(agentConfig.templateId)!;
        continue;
      }
      const { id: _oldId, enabled: _en, ...createBody } = agentConfig;
      try {
        const created = await sdk.agent.createPreset(createBody);
        idMap[oldId] = created.id;
      } catch { /* ignore */ }
    }
  }

  const remappedNodes = nodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      agentConfigId: idMap[n.data.agentConfigId as string] ?? n.data.agentConfigId,
    },
  }));

  // 已安装（更新）：覆盖同名工作流的节点/边/描述；未安装（导入）：新建工作流
  if (targetWorkflowId) {
    await workflowApi.update(targetWorkflowId, {
      name,
      description,
      nodes: remappedNodes as unknown as WorkflowNode[],
      edges,
    });
  } else {
    await sdk.workflow.create({ name, description, nodes: remappedNodes as unknown as WorkflowNode[], edges });
  }
}

/**
 * 从商店索引条目安装工作流模板：拉取模板 JSON（统一走 resolveStoreUrl，
 * 默认路由到 flow-spaces-workflows 仓库 raw）后落库。
 */
export async function installWorkflowTemplateFromStore(
  item: { filename: string },
  targetWorkflowId?: string,
): Promise<void> {
  const url = resolveStoreUrl(`workflows/${item.filename}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
  const template: WorkflowTemplatePreset = await res.json();
  await installWorkflowTemplate(template.data, targetWorkflowId);
}
