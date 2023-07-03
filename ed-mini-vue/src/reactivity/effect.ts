import { extend } from "../utils"
const globalMap = new WeakMap()
//全局变量，存储调用时的函数，因为其一调用，里面如果有响应式数据就会触发get或其set，提前存储好，方便直接存入
let globalFn

export class reactiveEffect {
    private _fn: any
    deps = []  //收集依赖对象被哪些set收集的
    active = true
    onStop: any

    constructor(fn) {
        this._fn = fn
    }
    run() {
        //存储调用函数
        globalFn = this
        const result = this._fn()
        globalFn = null //清空，防止后续stop后又被收集
        return result
    }

    stop() {   //删除存有依赖函数的set中的依赖函数
        if (this.active) {
            cleanEffect(this)
            if (this.onStop) {
                this.onStop()
            }
            this.active = false
        }
    }
}

function cleanEffect(effect) {
    effect.deps.forEach((item: any) => {
        item.delete(effect)
    })

    effect.deps.length = 0
}

export function effect(fn, options: any = {}) {
    const e = new reactiveEffect(fn)
    extend(e, options)
    e.run()
    //注意此处的run挂载依赖对象
    // e.run["effectObj"] = e //了解bind原理就知道不能先挂载再bind
    const runner: any = e.run.bind(e)
    //注意此时返回runner挂载依赖对象，方便后续的stop时能去调用依赖对象里的stop
    runner.effectObj = e
    return runner
}


export function track(target, key) {



    //获取整个对象对应的map映射关系，其中包含其对象的各个键对应的依赖。
    let depMap = globalMap.get(target)

    if (!depMap) {
        depMap = new Map()
        globalMap.set(target, depMap)
    }

    //获取键值对中key值对应的数据结构set（存放唯一的依赖对象）
    let dep = depMap.get(key)
    if (!dep) {
        dep = new Set()
        depMap.set(key, dep)
    }

    //准备添加新的依赖对象，全局变量存储的
    trackEffect(dep)

}

export function trackEffect(dep) {
    if (!globalFn) return
    dep.add(globalFn)
    globalFn.active = true
    globalFn.deps.push(dep)
}

export function trigger(target, key) {
    let depMap = globalMap.get(target)
    if (!depMap) {
        return
    }
    let dep = depMap.get(key)
    triggerEffect(dep)
}

export function triggerEffect(dep) {
    if (!dep) {
        return
    }
    for (let effect of dep) {
        if (effect.scheduler) {
            effect.scheduler()
        }
        else {
            effect.run()
        }
    }
}

export function stop(runner) {
    runner.effectObj.stop()

}