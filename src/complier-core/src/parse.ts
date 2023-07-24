import { NodeType } from "./ast";

const enum TagType {
  Start,
  End,
}

export function baseParse(content) {
  const context = createParserContext(content);
  return createRoot(parseChildren(context, ""));
}

//解析children
function parseChildren(context, parentTag) {
  const nodes: any = [];
  let node;
  while (!isEnd(context, parentTag)) {
    const { source } = context;
    //解析插值
    if (source.startsWith("{{")) {
      node = parseInterpolation(context);
    } else if (source[0] == "<" && /[a-z]/i.test(source[1])) {
      //解析HTML元素
      node = parseElement(context);
    } else {
      //处理text
      node = parseText(context);
    }
    nodes.push(node);
  }
  return nodes;
}

//判断是否结束
function isEnd(context, parentTag) {
  const { source } = context;
  return !source || source.startsWith(`</${parentTag}>`);
}

//解析普通文本
function parseText(context) {
  let { source } = context;
  const delimiter = ["{{", "<", "</"];
  let endIndex = source.length;
  for (const key of delimiter) {
    let index = source.indexOf(key);
    if (index >= 0 && index < endIndex) {
      endIndex = index;
    }
  }

  if (endIndex == -1) {
    source = parseTextSlice(context, source.length);
  } else {
    source = parseTextSlice(context, endIndex);
  }

  return {
    type: NodeType.TEXT,
    content: source,
  };
}

function parseTextSlice(context, index) {
  let { source } = context;
  context.source = source.slice(index);
  source = source.slice(0, index);
  return source;
}

//解析HTML元素，<div></div>——>{tag:"div",type:元素}
function parseElement(context) {
  const { source } = context;
  //处理开始标签
  const result: any = parseTag(context, TagType.Start);
  result.children = parseChildren(context, result.tag);
  //处理结尾标签
  parseTag(context, TagType.End);
  return result;
}

function parseTag(context, type) {
  const { source } = context;
  const match: any = /^<\/?([a-z]*)/i.exec(source);
  const tag = match[1];
  context.source = source.slice(match[0].length + 1);
  if (type == TagType.End) return;
  return {
    type: NodeType.ELEMENT,
    tag,
  };
}

//解析插槽功能,将{{ message }}——>message,注意返回结果结构
function parseInterpolation(context) {
  const { source } = context;
  const openDelimiter = "{{";
  const closeDelimiter = "}}";
  const start = source.indexOf(openDelimiter);
  const end = source.indexOf(closeDelimiter);
  const content = source.slice(start + openDelimiter.length, end).trim();
  context.source = source.slice(end + closeDelimiter.length); //parse过的字符串就截掉，剩下后面的继续parse。

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
