import { parse, type DefaultTreeAdapterMap } from 'parse5';

/** 按原始 HTML 的位置插入标记，不重新序列化文档或改写脚本内容。 */
export function annotateMiniAppHtml(html: string, projectId: string, filePath: string): string {
  const insertions: { offset: number; text: string }[] = [];
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/\r/g, '&#13;').replace(/\n/g, '&#10;');
  function visit(node: DefaultTreeAdapterMap['node']) {
    if ('tagName' in node) {
      const start = node.sourceCodeLocation?.startTag;
      if (start) {
        const attributes = {
          'data-mini-app-source-project': projectId,
          'data-mini-app-source-file': filePath,
          'data-mini-app-source-line': String(start.startLine),
          'data-mini-app-source-column': String(start.startCol),
        };
        // HTML 的 <image> 等标签会被解析器归一化，长度必须取原始标签名。
        const tagLength = /^<[^\t\n\f\r />]+/.exec(html.slice(start.startOffset, start.endOffset))![0].length;
        insertions.push({
          offset: start.startOffset + tagLength,
          text: Object.entries(attributes).map(([name, value]) => ` ${name}="${escape(value)}"`).join(''),
        });
      }
      if (node.tagName === 'template' && 'content' in node) visit(node.content);
    }
    if ('childNodes' in node) node.childNodes.forEach(visit);
  }
  visit(parse(html, { sourceCodeLocationInfo: true }));
  const chunks: string[] = [];
  let cursor = 0;
  for (const { offset, text } of insertions.sort((a, b) => a.offset - b.offset)) {
    chunks.push(html.slice(cursor, offset), text);
    cursor = offset;
  }
  chunks.push(html.slice(cursor));
  return chunks.join('');
}
