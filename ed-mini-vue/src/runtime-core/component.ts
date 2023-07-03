import { proxyHandler } from "./componentProxyHandler"

export function createComponentInstance(vnode) {
    const vm = {
        vnode,
        setupState: {},
        $el: null
    }
    return vm
}

export function setupComponent(instance: any) {
    //todo 
    //initProps  initSlots
    setupStatefulComponent(instance)
}

//执行setup
function setupStatefulComponent(instance: any) {
    //每个组件都会进来一次用于初始化各种数据与proxy代理对象
    instance.proxy = new Proxy({ instance }, proxyHandler)

    const { setup } = instance.vnode.type
    if (setup) {
        const setupResult = setup()
        handleSetupResult(setupResult, instance)
    }
}


//处理setup()结果
function handleSetupResult(setupResult: any, instance: any) {
    if (typeof setupResult == "object") {
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
