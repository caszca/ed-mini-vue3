import { effect } from "../effect";
import { reactive } from "../reactive";
import { isRef, proxyRefs, ref, unRef } from "../ref";


describe("ref", () => {
    test("happy path", () => {
        const a = ref(1);
        expect(a.value).toBe(1);
    });

    test("should be reactive", () => {
        const a = ref(1);
        let dummy;
        let calls = 0;
        effect(() => {
            calls++;
            dummy = a.value;
        });
        expect(calls).toBe(1);
        expect(dummy).toBe(1);
        a.value = 2;
        expect(calls).toBe(2);
        expect(dummy).toBe(2);
        // same value should not trigger
        a.value = 2;
        expect(calls).toBe(2);
        expect(dummy).toBe(2);
    });
    //ref传入对象时的处理
    test("should make nested properties reactive", () => {
        const a = ref({
            count: 1,
        });
        let dummy;
        effect(() => {
            dummy = a.value.count;
        });
        expect(dummy).toBe(1);
        a.value.count = 2;
        expect(dummy).toBe(2);
    });
    //判断是否为ref对象
    test("isRef", () => {
        const a = ref(1);
        const user = reactive({
            age: 1,
        });
        expect(isRef(a)).toBe(true);
        expect(isRef(1)).toBe(false);
        expect(isRef(user)).toBe(false);
    });
    //如果参数是 ref，则返回内部值，否则返回参数本身
    test("unRef", () => {
        const a = ref(1);
        expect(unRef(a)).toBe(1);
        expect(unRef(1)).toBe(1);
    });

    //ref对象解包，可以无需使用.value
    it("proxyRefs", () => {
        const user = {
            age: ref(10),
            name: "xiaohong",
        };

        const proxyUser = proxyRefs(user);
        expect(user.age.value).toBe(10);
        expect(proxyUser.age).toBe(10);
        expect(proxyUser.name).toBe("xiaohong");

        proxyUser.age = 20;

        expect(proxyUser.age).toBe(20);
        expect(user.age.value).toBe(20);

        proxyUser.age = ref(10);
        expect(proxyUser.age).toBe(10);
        expect(user.age.value).toBe(10);
    });
});