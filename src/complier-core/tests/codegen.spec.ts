import { generate } from "../src/codegen";
import { baseParse } from "../src/parse";
import { transform } from "../src/transform";
import { transformExpression } from "../src/transform/expressionParameter";
import { transformCompound } from "../src/transform/transformCompound";
describe("codegen", () => {
  it("string", () => {
    const ast = baseParse("hi");
    transform(ast);
    const { code } = generate(ast);
    expect(code).toMatchSnapshot();
  });

  it("interpolation", () => {
    const ast = baseParse("{{message}}");
    transform(ast, {
      nodeTransforms: [transformExpression],
    });
    const { code } = generate(ast);
    expect(code).toMatchSnapshot();
  });

  it.only("element", () => {
    const ast: any = baseParse("<div>hi,{{message}}</div>");
    transform(ast, {
      nodeTransforms: [transformExpression, transformCompound],
    });

    const { code } = generate(ast);
    expect(code).toMatchSnapshot();
  });
});
