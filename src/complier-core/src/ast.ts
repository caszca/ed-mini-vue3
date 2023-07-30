export const enum NodeType {
  INTERPOLATION,
  SIMPLE_EXPRESSION,
  ELEMENT,
  TEXT,
  ROOT, //transform中使其根节点也能遍历其children
  COMPOUND_EXPRESSION, //复合类型，连接相近的text与插槽
}
