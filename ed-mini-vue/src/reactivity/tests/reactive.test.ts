import { reactive, isReactive } from "../reactive"
import { effect } from "../effect"
describe("effect", () => {

    test('init', () => {
        //expect(true).toBe(true)
        const obj = reactive({
            count: 0
        })
        const obj1 = {
            name: "zs",
            "__v_isReactive": ""
        }
        let edObj
        effect(() => {
            edObj = obj.count + 1
        })
        expect(edObj).toBe(1)
        obj.count++
        expect(obj.count).toBe(1)
        expect(edObj).toBe(2)
        expect(isReactive(obj)).toBe(true)
        expect(isReactive(obj1)).toBe(false)
    })

    test('return runner after call effect', () => {
        //effect(fn) => return runner => runner() => return fn()
        let foo = 1
        let runner = effect(() => {
            foo++
            return "foo"
        })
        const res = runner()
        expect(foo).toBe(3)
        expect(res).toBe("foo")
    })
})

//isReactive，
//官方解释：检查一个对象是否是由 reactive() 或 shallowReactive() 创建的代理。

//传入任意一个值，我们该怎么判断它是否是一个由reactive()创建的代理

//解：最终所用的是用对象去访问一个我们自己设置的key值，这边如果是响应式对象的话，就
    //会去触发get函数，在get函数中判断此时访问的key值是否是我们内部设置的值，这样
    //就可以得知我们此时是在判断对象类型，而不是收集依赖。
//目前缺点就是内部设置的这个值不能保证唯一，如果有对象（非reactive创建）
    //包含这个key值，则会产生误差