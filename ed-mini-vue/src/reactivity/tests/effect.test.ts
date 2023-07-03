import { effect, stop } from "../effect";
import { reactive } from "../reactive";

describe("effect", () => {
    test("scheduler", () => {
        let dummy;
        let run: any;
        const scheduler = jest.fn(() => {
            run = runner;
        });
        const obj = reactive({ foo: 1 });

        //1.effect传入第二个参数options,其中有函数scheduler,不会在effect中执行

        const runner = effect(
            () => {
                dummy = obj.foo;
            },
            { scheduler }
        );

        //2、scheduler不会在effect中执行

        expect(scheduler).not.toHaveBeenCalled();
        expect(dummy).toBe(1);

        obj.foo++;

        //3、触发trigger时，有scheduler就不再调用依赖函数，转而调用scheduler。
        expect(scheduler).toHaveBeenCalledTimes(1);

        expect(dummy).toBe(1);

        run();

        expect(dummy).toBe(2);
    });



    test("stop", () => {
        let dummy;
        const obj = reactive({ prop: 1 });
        const runner = effect(() => {
            dummy = obj.prop;
        });
        obj.prop = 2;
        expect(dummy).toBe(2);
        stop(runner);
        // obj.prop = 3
        obj.prop++;
        expect(dummy).toBe(2);

        // stopped effect should still be manually callable
        runner();
        expect(dummy).toBe(3);
    });

    test("events: onStop", () => {
        let dummy = 1
        const obj = reactive({ prop: 1 });
        const onStop = jest.fn(() => {
            dummy++
        })
        const runner = effect(() => {
            dummy = obj.prop
        }, {
            onStop,
        });

        stop(runner);
        obj.prop = 3
        expect(obj.prop).toBe(3)
        expect(onStop).toBeCalledTimes(1);
        expect(dummy).toBe(2)
    });

})

//注意在合适位置及时将收集完的依赖对象，其变量存储清空

//scheduler
//1.effect传入第二个参数options,其中有函数scheduler,不会在effect中执行
 //2、scheduler不会在effect中执行
 //3、触发trigger时，有scheduler就不再调用依赖函数，转而调用scheduler。

/* 原理： 传入effect时，就把其依赖函数与scheduler存入依赖对象当中，这样存入依赖
    收集set时，调用时就可以先判断是否有scheduler再决定执行*/


 //stop
 //执行了stop后，响应式数据的依赖函数就在不再生效（注意针对的传入runner对应的依赖函数）
 //执行runner函数，响应式数据依赖又生效。
/* 原理：执行stop后，将（所有）收集包含这个依赖函数的key值删掉对应的这个依赖函数，
    而执行runner则很简单，前面写的我们就知道它会调用依赖函数，依赖又会收集一次。

    问题一：怎么得知一个依赖函数，他被哪些响应式数据收集过，找出包含它的所有set
    解：set收集时，依赖对象里数组变量deps反向收集这个set。

    我们主要转向在依赖对象里进行stop操作，是因为其中的数组变量deps，及其他变量
    存储在依赖对象中，所以由导出stop函数转向调用依赖对象里stop函数

    问题二：我们就传入一个runner函数，怎么获取到其对应的依赖对象。
    解：在runner函数中挂载依赖对象，runner实质上就是依赖对象里的run函数
 */


//onstop
//如果传入effect中，第二个options中有onStop，则在执行stop函数时，执行onStop
//注意执行了stop函数则依赖肯定需要被删除，与onstop不是对立关系