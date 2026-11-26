/**
 * 命令面板「问 AI」后端。
 *
 * 当前实现：本地 mock（对齐参考区块 p-command-2 的演示行为），支持中断、
 * 延迟模拟与按 locale 返回参考链接。
 *
 * 接入真实 LLM：保持 `askAI(query, options)` 签名不变，把
 * `generateMockAnswer` 换成对服务端补全接口（如 /api/llm/ask）的 fetch，
 * 并透传 AbortSignal 即可，面板组件无需改动。
 */
export interface AIReferenceLink {
  title: string;
  /** 站内路由（react-router path），面板内用 navigate 跳转 */
  to: string;
}

export interface AIAnswer {
  response: string;
  referenceLinks: AIReferenceLink[];
}

export interface AskAIOptions {
  signal?: AbortSignal;
  locale?: 'zh' | 'en';
}

const MOCK_DELAY_MS = 1200;

function links(locale: 'zh' | 'en'): AIReferenceLink[] {
  return locale === 'zh'
    ? [
        { title: '工作流列表', to: '/workflows' },
        { title: '小应用列表', to: '/mini-apps' },
        { title: '首页概览', to: '/home' },
      ]
    : [
        { title: 'Workflows', to: '/workflows' },
        { title: 'Mini Apps', to: '/mini-apps' },
        { title: 'Home overview', to: '/home' },
      ];
}

function generateMockAnswer(query: string, locale: 'zh' | 'en'): AIAnswer {
  if (locale === 'zh') {
    return {
      response:
        `关于「${query}」：Flow Spaces 是一个工作流可视化编辑器。你可以在「工作流」页面点击右上角"新建"创建工作流，` +
        '在画布上添加智能体与命令节点并连线编排，保存后会出现在工作流列表中。\n\n' +
        '「小应用」页面可以把工作流发布为独立运行的小应用；顶栏的搜索按钮或 ⌘K 随时打开命令面板，' +
        '输入关键词即可搜索并跳转到任意工作流、小应用或执行常用操作。\n\n' +
        '（演示回答：当前未接入真实模型，替换 ask-ai.ts 中的实现即可接入 LLM。）',
      referenceLinks: links(locale),
    };
  }
  return {
    response:
      `About "${query}": Flow Spaces is a visual workflow editor. Open the Workflows page and click ` +
      '"New" in the top-right corner to create a workflow, then add agent and command nodes on the ' +
      'canvas and connect them; saved workflows appear in the workflows list.\n\n' +
      'The Mini Apps page publishes workflows as standalone mini apps. Press the search button in the ' +
      'top bar or ⌘K anytime to open the command palette — type a keyword to jump to any workflow, ' +
      'mini app, or run common actions.\n\n' +
      '(Demo answer: no real model is wired up yet — replace the implementation in ask-ai.ts to connect an LLM.)',
    referenceLinks: links(locale),
  };
}

export async function askAI(query: string, options: AskAIOptions = {}): Promise<AIAnswer> {
  const trimmed = query.trim();
  if (!trimmed) throw new Error('empty query');
  const locale = options.locale ?? 'zh';

  // 可中断的模拟延迟
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, MOCK_DELAY_MS);
    options.signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('aborted', 'AbortError'));
    }, { once: true });
  });
  if (options.signal?.aborted) throw new DOMException('aborted', 'AbortError');

  return generateMockAnswer(trimmed, locale);
}

/** 轻量 markdown（空行分段）→ 安全 HTML；与参考区块一致的演示级转换。 */
export function markdownToSafeHTML(markdown: string): string {
  return markdown
    .split('\n\n')
    .map((para) => `<p>${para}</p>`)
    .join('');
}
