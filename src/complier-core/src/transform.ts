//负责对ast树进行一些增删改查操作。
import { NodeType } from "./ast";
import { CREATE_ELEMENT_VNODE, TO_DISPLAY_STRING } from "./runtimeConst";
import { transformCompound } from "./transform/transformCompound";
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
    plugin(node, context);
  }

  switch (node.type) {
    case NodeType.ELEMENT:
      transformElement(node, context);
    case NodeType.ROOT:
      transformElement_Root(node, context);
      break;
    case NodeType.INTERPOLATION:
      transformExpression(node, context);
      break;
    case NodeType.COMPOUND_EXPRESSION:
      transformCompound1(node, context);
      break;
    default:
      break;
  }
}

function transformElement(node, context) {
  const { ast } = context;
  ast.pushParameter(CREATE_ELEMENT_VNODE);
}

//遍历element元素子节点。
function transformElement_Root(node: any, context) {
  const { children } = node;
  traverseChildren(children, context);
}

//处理有插槽就往ast根节点添加数组
function transformExpression(node: any, context: any) {
  //普通出路，未用transform里的插件
  // node.content.content = "_ctx." + node.content.content;
  const { ast } = context;
  ast.pushParameter(TO_DISPLAY_STRING);
}

function transformCompound1(node, context) {
  const { children } = node;
  traverseChildren(children, context);
}

function traverseChildren(children, context) {
  if (children && children.length) {
    for (const node of children) {
      traverseNode(node, context);
    }
  }
}
