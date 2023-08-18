//处理相近的text与插槽
//不存在相近的节点是同一种类型，比如都是text与插槽
import { NodeType } from "../ast";

const addConst = {
  type: NodeType.SIMPLE_EXPRESSION,
  content: " + ",
};

export function transformCompound(node, context) {
  if (node.type == NodeType.ELEMENT) {
    const { children } = node;
    for (let i = 0; i < children.length; i++) {
      const node = children[i];
      if (isText_Interpolation(node)) {
        let container: any = null;
        for (let j = i + 1; j < children.length; j++) {
          const nodej = children[j];
          if (isText_Interpolation(nodej)) {
            //相近节点为text与插槽（不区分先后）
            if (!container) {
              //初次F
              container = children[i] = {
                type: NodeType.COMPOUND_EXPRESSION,
                children: [node],
              };
            }
            console.log("-----", j);
            children.splice(j, 1); //删掉已经添加进去的节点
            j--; //splice引起的数组后续往前移
            container.children.push(addConst);
            container.children.push(nodej);
          } else {
            //遇到非上述节点退出内层循环，继续外层循环
            container = null;
            break;
          }
        }
      }
    }
  }
}
//判断节点是否为插槽或文本text
function isText_Interpolation(node) {
  return node.type == NodeType.INTERPOLATION || node.type == NodeType.TEXT;
}
