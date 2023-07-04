import { is } from "../utils/index"
import { proxyHandler } from "./componentProxyHandler"

import { shallowReadonly } from "../reactivity/reactive"
import { initProps } from "./componentProps"
import { initSlots } from "./componentSlots"
export function createComponentInstance(vnode, parent) {

    const vm = {
        vnode,
        setupState: {},
        $el: null,
        $slots: null,
        $emit: () => { },
        props: {},
        provide: parent ? Object.create(parent.provide) : {}, //用于provide与inject
        $parent: parent
    }
    return vm
}

//初始化组件起点
export function setupComponent(instance: any) {
    //todo 
    //initProps  initSlots
    //初始化props
    initProps(instance)
    initSlots(instance)
    setupStatefulComponent(instance)
}


//执行setup
function setupStatefulComponent(instance: any) {
    //每个组件都会进来一次用于初始化各种数据与proxy代理对象
    instance.proxy = new Proxy({ instance }, proxyHandler)

    const { setup } = instance.vnode.type
    if (setup) {
        setCurrentInstance(instance)
        const setupResult = setup(shallowReadonly(instance.props), {
            emit: instance.$emit
        })
        setCurrentInstance(null)
        handleSetupResult(setupResult, instance)
    }
}


//处理、挂载setup()结果
function handleSetupResult(setupResult: any, instance: any) {
    if (is(setupResult)) {
        instance.setupState = setupResult
    }
    finishComponentSetup(instance);
}

//挂载render函数
function finishComponentSetup(instance: any) {
    const { render } = instance.vnode.type
    if (render) {
        instance.render = render
    }
}

//获取当前组件实例
let currentInstance = null
export function getCurrentInstance() {
    return currentInstance
}

function setCurrentInstance(value) {
    currentInstance = value
}