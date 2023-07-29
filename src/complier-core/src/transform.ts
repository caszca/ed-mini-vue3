//负责对ast树进行一些增删改查操作。
import { NodeType } from "./ast";
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

  switch (node.type) {
    case NodeType.ELEMENT:
    case NodeType.ROOT:
      transformElement(node, context);
      break;
    case NodeType.INTERPOLATION:
      transformExpression(node, context);
      break;
    default:
      break;
  }
}

//遍历element元素子节点。
function transformElement(node: any, context) {
  const { children } = node;
  if (children) {
    for (const childNode of children) {
      traverseNode(childNode, context);
    }
  }
}

//处理有插槽就往ast根节点添加数组
function transformExpression(node: any, context: any) {
  //普通出路，未用transform里的插件
  // node.content.content = "_ctx." + node.content.content;
  const { ast } = context;
  ast.pushParameter(["toDisplayString"]);
}
