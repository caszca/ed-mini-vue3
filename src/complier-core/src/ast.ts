export const enum NodeType {
  INTERPOLATION,
  SIMPLE_EXPRESSION,
  ELEMENT,
  TEXT,
  ROOT, //transform中使其根节点也能遍历其children
}
