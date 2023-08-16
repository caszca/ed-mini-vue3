import { readonly, isReactive, isReadonly, reactive } from "../reactive";
describe("readonly", () => {
    it("should make nested values readonly", () => {
        const original = { foo: 1, bar: { baz: 2 } };
        const wrapped = readonly(original);
        expect(wrapped).not.toBe(original);
        expect(wrapped.foo).toBe(1);
        expect(isReactive(wrapped)).toBe(false)
        expect(isReadonly(wrapped)).toBe(true)
    });

    it("should call console.warn when set", () => {
        console.warn = jest.fn();
        const user = readonly({
            age: 10,
        });

        user.age = 11;
        expect(console.warn).toHaveBeenCalled();
    });

    test("nested reactives", () => {
        const original = {
            nested: {
                foo: 1,
            },
            array: [{ bar: 2 }],
        };
        const observed = reactive(original);
        expect(isReactive(observed.nested)).toBe(true);
        expect(isReactive(observed.array)).toBe(true);
        expect(isReactive(observed.array[0])).toBe(true);
    });
});

//reactive深层嵌套，将嵌套对象都变为proxy代理对象。

//解：get一个对象时，将其转为proxy