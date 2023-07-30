export * from "./runtime-dom/index";

import { baseCompile } from "./complier-core/src";
import * as runtimeDom from "./runtime-dom/index";
import { registerRuntimeCompiler } from "./runtime-core";

export function compileToFunction(template) {
  const { code } = baseCompile(template);
  const render = new Function("vue", code)(runtimeDom); //传递进vue，执行code代码，返回render函数
  return render;
}

registerRuntimeCompiler(compileToFunction);
