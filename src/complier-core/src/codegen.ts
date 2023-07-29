//负责将ast(抽象语法树)转换为render函数
export function generate(ast) {
  let code = "";
  const functionName = "render";
  const args = ["_ctx", "_cache"];
  code += `return function ${functionName}(${args.join(", ")}){ return `;
  const render = codegen(ast.children[0]);
  code += `'${render}' }`;
  return {
    code,
  };
}

function codegen(rootNode) {
  return rootNode.content;
}
//return function render(_ctx, _cache, $props, $setup, $data, $options) { return "hi" }
