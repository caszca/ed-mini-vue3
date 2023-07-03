import { computed } from "../computed";
import { reactive } from "../reactive";


describe("computed", () => {
    it("happy path", () => {
        const user = reactive({
            age: 1,
        });

        const age = computed(() => {
            return user.age;
        });

        expect(age.value).toBe(1);
    });

    it("should compute lazily", () => {
        const value = reactive({
            foo: 1,
        });
        const getter = jest.fn(() => {
            return value.foo;
        });
        const cValue = computed(getter);

        // lazy
        expect(getter).not.toHaveBeenCalled();

        expect(cValue.value).toBe(1);
        expect(getter).toHaveBeenCalledTimes(1);

        // should not compute again
        //这里涉及缓存，响应式数据不改变，复用上次计算属性
        cValue.value; // get
        expect(getter).toHaveBeenCalledTimes(1);

        // should not compute until needed
        value.foo = 2;
        expect(getter).toHaveBeenCalledTimes(1);

        // now it should compute
        expect(cValue.value).toBe(2);
        expect(getter).toHaveBeenCalledTimes(2);

        // should not compute again
        cValue.value;
        expect(getter).toHaveBeenCalledTimes(2);
    });
});

//全局知识点
/* 只要是将依赖函数存入依赖对象中后，执行依赖对象中的run，
    碰到响应式数据就会收集依赖 */


//computed注意点
//1.computed计算属性是懒加载，不去访问返回ref对象的value值，是不会去计算的
//那怕你去更新了computed需要的getter函数里的响应式对象数据，也不会立即去调用getter
//只有去访问ref.value时才会去


