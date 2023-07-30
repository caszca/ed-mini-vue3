import { generate } from "./codegen";
import { baseParse } from "./parse";
import { transform } from "./transform";
import { transformExpression } from "./transform/expressionParameter";
import { transformCompound } from "./transform/transformCompound";

//将参数template转化为一个render字符串
export function baseCompile(template) {
  const ast: any = baseParse(template);
  transform(ast, {
    nodeTransforms: [transformExpression, transformCompound],
  });

  return generate(ast);
}
