import { useLLMStore } from '@/stores/llm';
import { getTranslator } from 'next-intl';

/**
 * 构造让 agent 自动生成多 agent 协作 workflow 的提示词。
 *
 * 与 issue 创建流程共享同一份逻辑，保证从「issue 新建工作流」
 * 与「workflows 页面智能创建」入口生成的提示词完全一致。
 */
export function buildWorkflowPrompt(opts: {
  /** workflow 的描述（注释），可为空 */
  workflowDescription?: string;
  /** 对应的 issue/需求文本（标题或描述），可为空 */
  issuePrompt?: string;
}): string {
  const { workflowDescription = '', issuePrompt = '' } = opts;
  const { models, providers } = useLLMStore.getState();
  const t = getTranslator('workflows.workflowPrompt');

  // 关联供应商，得到每个模型可直接写入 agent_run 节点配置的字段（providerId/modelId/modelProvider）
  const providerByName = new Map(providers.map((p) => [p.name, p]));
  const modelOptions = models
    .map((m) => {
      const provider = providerByName.get(m.provider);
      if (!provider) return null;
      const tags: string[] = [];
      if (m.reasoning) tags.push(t('tagReasoning'));
      if (m.vision) tags.push(t('tagVision'));
      if (m.embedding) tags.push(t('tagEmbedding'));
      if (m.thinkingEnabled) tags.push(t('tagThinking', { effort: m.thinkingEffort }));
      const costInfo = m.cost ? t('costInfo', { input: m.cost.inputPerMillion, output: m.cost.outputPerMillion }) : t('costUnknown');
      const ctx = m.maxContextTokens ? t('ctxKnown', { tokens: m.maxContextTokens }) : t('ctxUnknown');
      return {
        name: m.name,
        modelId: m.modelId,
        providerId: provider.id,
        modelProvider: provider.modelProvider ?? '',
        tags,
        costInfo,
        ctx,
      };
    })
    .filter(Boolean) as Array<{
      name: string;
      modelId: string;
      providerId: string;
      modelProvider: string;
      tags: string[];
      costInfo: string;
      ctx: string;
    }>;

  // 按能力粗分档：具备推理或高强度思考的归为核心/复杂任务模型，其余为常规/轻量任务模型
  const heavy = modelOptions.filter((m) => m.tags.includes(t('tagReasoning')) || m.tags.some((tag) => tag.startsWith(t('tagThinking', { effort: 'high' }))));
  const light = modelOptions.filter((m) => !heavy.includes(m));

  const modelSection = modelOptions.length
    ? [
        t('modelsHeader'),
        ...modelOptions.map(
          (m) => t('modelLine', { name: m.name, providerId: m.providerId, modelId: m.modelId, modelProvider: m.modelProvider, tags: m.tags.join('/') || t('capabilitiesNone'), ctx: m.ctx, costInfo: m.costInfo }),
        ),
        heavy.length ? t('heavyLine', { models: heavy.map((m) => m.name).join('、') }) : '',
        light.length ? t('lightLine', { models: light.map((m) => m.name).join('、') }) : '',
        t('pickModelsHint'),
      ].filter(Boolean).join('\n')
    : t('noModels');

  return [
    t('intro'),
    t('requirements'),
    t('example'),
    t('variableHint'),
    workflowDescription ? t('workflowDescriptionLine', { value: workflowDescription }) : '',
    issuePrompt ? t('issueLine', { value: issuePrompt }) : '',
    modelSection,
  ].filter(Boolean).join('\n');
}
