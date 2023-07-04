'use strict';

function is(target) {
    return target != null && typeof target == 'object';
}

const proxyHandler = {
    get({ instance }, key) {
        const { setupState, props } = instance;
        if (key in setupState) {
            return setupState[key];
        }
        if (key in props) {
            return props[key];
        }
        if (key in instance) {
            return instance[key];
        }
    }
};
//proxy代理对象，其实我也很疑惑代理的对象竟然不选择实例对象，就是拦截对实例的get请求，针对key值去
//不同地方取值

const globalMap = new WeakMap();
function track(target, key) {
    //获取整个对象对应的map映射关系，其中包含其对象的各个键对应的依赖。
    let depMap = globalMap.get(target);
    if (!depMap) {
        depMap = new Map();
        globalMap.set(target, depMap);
    }
    //获取键值对中key值对应的数据结构set（存放唯一的依赖对象）
    let dep = depMap.get(key);
    if (!dep) {
        dep = new Set();
        depMap.set(key, dep);
    }
}
function trigger(target, key) {
    let depMap = globalMap.get(target);
    if (!depMap) {
        return;
    }
    let dep = depMap.get(key);
    triggerEffect(dep);
}
function triggerEffect(dep) {
    if (!dep) {
        return;
    }
    for (let effect of dep) {
        if (effect.scheduler) {
            effect.scheduler();
        }
        else {
            effect.run();
        }
    }
}

const get = createGetter();
const set = createSetter();
const readonlyGet = createGetter(true);
const shallowReadonlyGet = createGetter(true, true);
function createGetter(isReadonly = false, isShallow = false) {
    return function (target, key, receiver) {
        if (key === "__v_isReactive" /* REACTIVE_FLAGS.IS_REACTIVE */)
            return !isReadonly;
        else if (key === "__v_isReadonly" /* REACTIVE_FLAGS.IS_READONLY */)
            return isReadonly;
        else if (key === "__v_isProxy" /* REACTIVE_FLAGS.IS_PROXY */)
            return true;
        let result = Reflect.get(target, key);
        //处理嵌套对象
        if (is(result) && !isShallow) {
            result = isReadonly ? readonly(result) : reactive(result);
        }
        //判断是否是readonly，决定是否收集依赖
        if (!isReadonly)
            track(target, key);
        return result;
    };
}
function createSetter() {
    return function (target, key, value, receiver) {
        const result = Reflect.set(target, key, value);
        //触发依赖
        trigger(target, key);
        return result;
    };
}
const reactiveHandler = {
    get,
    set
};
const readonlyHandler = {
    get: readonlyGet,
    set: function () {
        //throw new Error("is readonly,cannt be reset")
        console.warn();
        return true;
    }
};
const shallowReadonlyHandler = {
    get: shallowReadonlyGet,
    set: function () {
        //throw new Error("is readonly,cannt be reset")
        console.warn();
        return true;
    }
};

function reactive(raw) {
    return createProxyObj(raw, reactiveHandler);
}
function readonly(raw) {
    return createProxyObj(raw, readonlyHandler);
}
function shallowReadonly(raw) {
    return createProxyObj(raw, shallowReadonlyHandler);
}
function createProxyObj(raw, handler) {
    return new Proxy(raw, handler);
}

//emit需要在props中找到对应的监听事件触发,注意instance
function emit(instance, emitEvent, ...args) {
    const { props } = instance;
    if (emitEvent) {
        let e = "on" + emitEvent[0].toUpperCase() + emitEvent.slice(1);
        props[e] && props[e](...args);
    }
}

function initProps(instance) {
    const { props } = instance.vnode;
    if (is(props)) {
        instance.props = props;
        //让emit函数能使用instance
        instance.emit = emit.bind({}, instance);
    }
}

//绑定slots到组件实例上去，slots为vnode的children
function initSlots(instance) {
    const { children } = instance.vnode;
    //1.普通插槽处理
    //instance.$slots = Array.isArray(children) ? children : [children]  
    //2.具名插槽，children为对象,转换其value值为数组
    const slot = {};
    for (const key in children) {
        const value = children[key];
        //接收到renderSlots传递的data，高阶函数，确保返回值为数组
        slot[key] = (props) => normalizeToArray(value(props));
    }
    instance.$slots = slot;
}
function normalizeToArray(slotVal) {
    return Array.isArray(slotVal) ? slotVal : [slotVal];
}

function createComponentInstance(vnode) {
    const vm = {
        vnode,
        setupState: {},
        $el: null,
        $slots: null,
        props: {}
    };
    return vm;
}
//初始化组件起点
function setupComponent(instance) {
    //todo 
    //initProps  initSlots
    //初始化props
    initProps(instance);
    initSlots(instance);
    setupStatefulComponent(instance);
}
//执行setup
function setupStatefulComponent(instance) {
    //每个组件都会进来一次用于初始化各种数据与proxy代理对象
    instance.proxy = new Proxy({ instance }, proxyHandler);
    const { setup } = instance.vnode.type;
    if (setup) {
        const setupResult = setup(shallowReadonly(instance.props), {
            emit: instance.emit
        });
        handleSetupResult(setupResult, instance);
    }
}
//处理、挂载setup()结果
function handleSetupResult(setupResult, instance) {
    if (is(setupResult)) {
        instance.setupState = setupResult;
    }
    finishComponentSetup(instance);
}
//挂载render函数
function finishComponentSetup(instance) {
    const { render } = instance.vnode.type;
    if (render) {
        instance.render = render;
    }
}

function render(vnode, conatiner) {
    patch(vnode, conatiner);
}
function patch(vnode, container) {
    //此处用于区分是组件还是element
    //如果是组件还需要创建组件实例挂载数据等
    if (is(vnode.type)) {
        processComponent(vnode, container);
    }
    else if (typeof vnode.type == "string") {
        processElement(vnode, container);
    }
}
//处理element元素开始
function processElement(vnode, container) {
    mountElement(vnode, container);
}
//判断是否attribut是否是事件
function onEvent(event) {
    return /^on[A-Z]/.test(event);
}
function mountElement(vnode, container) {
    const { type, props, children } = vnode;
    const element = document.createElement(type);
    //将每个自己DOM对象存储在自己vnode中
    vnode.$el = element;
    //props:{id:"red"}
    //挂载元素属性，注意props为对象
    for (const key in props) {
        if (onEvent(key)) {
            const e = key.slice(2).toLowerCase();
            element.addEventListener(e, props[key]);
        }
        else {
            element.setAttribute(key, props[key]);
        }
    }
    //处理子元素，注意分为3中情况字符串与h()与[]
    if (typeof children == "string") {
        element.textContent = children;
    }
    else if (children instanceof Array) {
        children.forEach((child) => {
            patch(child, element);
        });
    }
    container.append(element);
}
//处理组件元素开始
function processComponent(vnode, container) {
    mountComponent(vnode, container);
}
function mountComponent(vnode, container) {
    const instance = createComponentInstance(vnode);
    //初始化组件
    setupComponent(instance);
    //渲染组件子元素
    setupRenderEffect(instance, container);
}
function setupRenderEffect(instance, container) {
    //此subTree下方的第一个虚拟节点
    const subTree = instance.vnode.type.render.call(instance.proxy);
    patch(subTree, container);
    //将$el挂载在实例对象上
    instance.$el = subTree.$el;
}

function createVNode(type, props, children) {
    const vnode = {
        type, props, children
    };
    return vnode;
}

function createApp(rootComponent) {
    return {
        mount(rootContainer) {
            const VNode = createVNode(rootComponent);
            render(VNode, rootContainer);
        }
    };
}

function h(type, props, children) {
    return createVNode(type, props, children);
}

//文件作用对传进来的slots进行创建vnode处理
function renderSlots(slots, name, data) {
    //1.普通插槽
    //createVNode("div", {}, slots)
    //2.具名插槽,与init时转为value为数组遥相呼应
    /* const slot = slots[name]
    if (slot) {
            return createVNode("div", {}, slot)
    } */
    const slot = slots[name];
    if (slot) {
        if (typeof slot == "function") {
            return createVNode("div", {}, slot(data));
        }
    }
}

exports.createApp = createApp;
exports.h = h;
exports.renderSlots = renderSlots;
