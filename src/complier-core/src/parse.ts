import { NodeType } from "./ast";


const enum TagType {
  Start,
  End,
}

export function baseParse(content) {
  const context = createParserContext(content);
  return createRoot(parseChildren(context));
}

//解析children
function parseChildren(context) {
  const {source}=context
  const nodes: any = [];
  let node;
  //解析插值
  if (source.startsWith("{{")) {
    node = parseInterpolation(context);
  }else if(source[0]=='<'&&/[a-z]/i.test(source[1])){
    //解析HTML元素
    node= parseElement(context)
  }else{
    //处理text
    node=parseText(context)
  }


  nodes.push(node);
  return nodes;
}

function parseText(context){
  const {source}=context
  context.source=source.slice(source.length)
  return {
    type:NodeType.TEXT,
    content:source
  }
}

//解析HTML元素，<div></div>——>{tag:"div",type:元素}
function parseElement(context){
  const {source} =context
  //处理开始标签
  const result= parseTag(context,TagType.Start)
  //处理结尾标签
  parseTag(context,TagType.End) 
  return result
}

function parseTag(context,type){
  const {source}=context
  const match:any= /^<\/?([a-z]*)/i.exec(source)
  const tag=match[1]
  context.source=source.slice(match[0].length+1)
  if(type==TagType.End)return 
  return {
    type:NodeType.ELEMENT,
    tag
  }
}

//解析插槽功能,将{{ message }}——>message,注意返回结果结构
function parseInterpolation(context) {
  const {source}=context
  const openDelimiter = "{{";
  const closeDelimiter = "}}";
  const start = source.indexOf(openDelimiter);
  const end = source.indexOf(closeDelimiter);
  const content = source.slice(start + openDelimiter.length, end).trim();
  context.source=source.slice(end+closeDelimiter.length)  //parse过的字符串就截掉，剩下后面的继续parse。
  
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
