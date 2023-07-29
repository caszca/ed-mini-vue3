//transform插件，用于处理遇到插槽节点时，所需添加参数等

import { NodeType } from "../ast";
export function transformExpression(node) {
  if (node.type == NodeType.INTERPOLATION) {
    node.content.content = "_ctx." + node.content.content;
  }
}
