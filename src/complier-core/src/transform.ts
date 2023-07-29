export function transform(ast, options = {}) {
  const context = createTransformContext(ast, options);
  traverseNode(ast, context);
}

function createTransformContext(ast: any, options: any) {
  return {
    ast,
    nodeTransforms: options.nodeTransforms || [],
  };
}

//深度优先遍历ast(抽象语法树)
function traverseNode(node, context: any) {
  const { nodeTransforms } = context;
  for (const plugin of nodeTransforms) {
    plugin(node);
  }
  const { children } = node;
  if (children) {
    for (const childNode of children) {
      traverseNode(childNode, context);
    }
  }
}
