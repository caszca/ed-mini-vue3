//负责将ast(抽象语法树)转换为render函数

import { NodeType } from "./ast";

//处理import情况
function handleImport(ast: any, push) {
  const { parameter } = ast;
  if (parameter.length) {
    const par = parameter.map((val) => `${val} as _${val}`).join(", ");
    push(`import { ${par} } from 'vue'`);
    push("\n");
  }
}

export function generate(ast) {
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

function codegen(rootNode, context) {
  switch (rootNode.type) {
    case NodeType.TEXT:
      genText(rootNode, context);
      break;
    case NodeType.INTERPOLATION:
      return genInterpolation(rootNode, context);
      break;

    case NodeType.SIMPLE_EXPRESSION:
      return genSimpleExpression(rootNode, context);
      break;
    default:
      break;
  }
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

//return function render(_ctx, _cache, $props, $setup, $data, $options) { return "hi" }
