import { NodeType } from "./ast";
export function baseParse(content) {
  const context = createParserContext(content);
  return createRoot(parseChildren(context));
}

//解析children
function parseChildren(context) {
  const nodes: any = [];
  let node;
  if (context.source.trim().startsWith("{{")) {
    node = parseInterpolation(context);
  }

  nodes.push(node);
  return nodes;
}

//解析插槽功能,将{{ message }}——>message,注意返回结果结构
function parseInterpolation({ source }) {
  const openDelimiter = "{{";
  const closeDelimiter = "}}";
  const start = source.indexOf(openDelimiter);
  const end = source.lastIndexOf(closeDelimiter);
  const content = source.slice(start + openDelimiter.length, end).trim();
  return {
    type: NodeType.INTERPOLATION,
    content: {
      type: NodeType.SIMPLE_EXPRESSION,
      content,
    },
  };
}

function createRoot(children) {
  return {
    children,
  };
}

function createParserContext(content) {
  return {
    source: content,
  };
}
