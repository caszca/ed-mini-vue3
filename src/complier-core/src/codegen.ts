//负责将ast(抽象语法树)转换为render函数

import { NodeType } from "./ast";

function handle(val: any) {
  return `${val} : _${val}`;
}

function createCodegenContext(ast) {
  const context = {
    code: "",
    push(source) {
      context.code += source;
    },
    ast,
  };
  return context;
}

export function generate(ast) {
  console.log("-----", ast.children[0]);
  const context = createCodegenContext(ast);
  const { push } = context;
  handleImport(ast, push);
  const functionName = "render";
  const args = ["_ctx", "_cache"];
  push(`return function ${functionName}(${args.join(", ")}){ return `);
  codegen(ast.children[0], context);
  push(" }");
  return context;
}

//处理import情况
function handleImport(ast: any, push) {
  const { parameter } = ast;
  if (parameter.size) {
    let par: string[] = [];
    for (const val of parameter) {
      par.push(handle(val));
    }
    push(`const { ${par.join(", ")} } = vue`);
    push("\n");
  }
}

function codegen(rootNode, context) {
  switch (rootNode.type) {
    case NodeType.TEXT:
      genText(rootNode, context);
      break;
    case NodeType.INTERPOLATION:
      genInterpolation(rootNode, context);
      break;

    case NodeType.SIMPLE_EXPRESSION:
      genSimpleExpression(rootNode, context);
      break;

    case NodeType.ELEMENT:
      genElement(rootNode, context);
      break;

    case NodeType.COMPOUND_EXPRESSION:
      genCompound(rootNode, context);
      break;
    default:
      break;
  }
}

function codegenChildren(nodes, context) {
  if (nodes.length) {
    for (const node of nodes) {
      codegen(node, context);
    }
  }
}

function genText(node: any, context) {
  const { push } = context;
  push(`'${node.content}'`);
}

function genSimpleExpression(node: any, context) {
  const { push } = context;
  push(`${node.content}`);
}

function genInterpolation(node: any, context) {
  const { push } = context;
  push("_toDisplayString(");
  codegen(node.content, context);
  push(")");
}

function genElement(node, context) {
  const { push } = context;
  push(`_createElementVNode(`);
  genNodeList(node, context);
  push(")");
}

function genNodeList(node, context) {
  const { push } = context;
  const { tag, props, children } = node;
  push(`'${tag}', ${props || null}, `);
  console.log(children, "----------");
  children ? codegenChildren(children, context) : push("null");
}

function genCompound(node, context) {
  codegenChildren(node.children, context);
}
//return function render(_ctx, _cache, $props, $setup, $data, $options) { return "hi" }
