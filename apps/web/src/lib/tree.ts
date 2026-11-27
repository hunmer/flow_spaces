export function walkTree<T>(
  nodes: T[] | undefined,
  getChildren: (node: T) => T[] | undefined,
  visit: (node: T) => void,
): void {
  for (const node of nodes ?? []) {
    visit(node);
    const children = getChildren(node);
    if (children) walkTree(children, getChildren, visit);
  }
}

export function findTreeNode<T>(
  nodes: T[] | undefined,
  getChildren: (node: T) => T[] | undefined,
  pred: (node: T) => boolean,
): T | undefined {
  for (const node of nodes ?? []) {
    if (pred(node)) return node;
    const found = findTreeNode(getChildren(node), getChildren, pred);
    if (found) return found;
  }
  return undefined;
}
