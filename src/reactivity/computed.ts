import { extend } from "../utils"
import { reactiveEffect } from "./effect"

//注意computed不同于effect函数，effect是立即执行那种,所以我们不能直接使用effect收集
class computedRef {
    private _effect //依赖对象
    private _dirty: boolean = true  //控制是否采用缓存
    private _value
    constructor(getter) {
        this._effect = new reactiveEffect(getter)
        //此后，只要响应式数据发生改变时，都不是去立即执行依赖函数getter，
        //而是去将ref对象的_dirty转为true，代表需要重新执行getter函数，等待下次访问value，做到缓存作用。
        extend(this._effect, {
            scheduler: () => {
                if (!this._dirty) this._dirty = true
            }
        })
    }

    get value() {
        if (this._dirty) {
            this._value = this._effect.run()
            //这里将—_dirty设为false,思考待响应式数据改变后将其设为false
            this._dirty = false
        }
        return this._value
    }
}

//注意getter
export function computed(getter) {
    return new computedRef(getter)
}