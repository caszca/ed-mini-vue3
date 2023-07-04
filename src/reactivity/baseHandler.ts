import { is } from "../utils"
import { track, trigger } from "./effect"
import { REACTIVE_FLAGS, reactive, readonly } from "./reactive"

const get = createGetter()
const set = createSetter()
const readonlyGet = createGetter(true)
const shallowReadonlyGet = createGetter(true, true)

function createGetter(isReadonly = false, isShallow = false) {
    return function (target, key, receiver) {
        if (key === REACTIVE_FLAGS.IS_REACTIVE)
            return !isReadonly
        else if (key === REACTIVE_FLAGS.IS_READONLY)
            return isReadonly
        else if (key === REACTIVE_FLAGS.IS_PROXY)
            return true
        let result = Reflect.get(target, key)

        //处理嵌套对象
        if (is(result) && !isShallow) {
            result = isReadonly ? readonly(result) : reactive(result)
        }

        //判断是否是readonly，决定是否收集依赖
        if (!isReadonly) track(target, key)
        return result
    }
}

function createSetter() {
    return function (target, key, value, receiver) {
        const result = Reflect.set(target, key, value)
        //触发依赖
        trigger(target, key)
        return result
    }
}

export const reactiveHandler = {
    get,
    set
}

export const readonlyHandler = {
    get: readonlyGet,
    set: function () {
        //throw new Error("is readonly,cannt be reset")
        console.warn()
        return true
    }
}

export const shallowReadonlyHandler = {
    get: shallowReadonlyGet,
    set: function () {
        //throw new Error("is readonly,cannt be reset")
        console.warn()
        return true
    }
}