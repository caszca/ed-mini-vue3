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
        instance.$emit = emit.bind({}, instance);
    }
}

//绑定slots到组件实例上去，slots为vnode的children
function initSlots(instance) {
    const { children } = instance.vnode;
    //1.普通插槽处理
    //instance.$slots = Array.isArray(children) ? children : [children]  
    //2.具名插槽，children为对象,转换其value值为数组
    /*
    const slot = {}
    for (const key in children) {
        const value = children[key];
        slot[key] = normalizeToArray(value)
    }
    instance.$slots = slot
    */
    //3.作用域插槽
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

function createComponentInstance(vnode, parent) {
    const vm = {
        vnode,
        setupState: {},
        $el: null,
        $slots: null,
        $emit: () => { },
        props: {},
        provide: parent ? Object.create(parent.provide) : {},
        $parent: parent
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
        setCurrentInstance(instance);
        const setupResult = setup(shallowReadonly(instance.props), {
            emit: instance.$emit
        });
        setCurrentInstance(null);
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
//获取当前组件实例
let currentInstance = null;
function getCurrentInstance() {
    return currentInstance;
}
function setCurrentInstance(value) {
    currentInstance = value;
}

const Fragment = Symbol("Fragment");
const Text = Symbol("text");
function createVNode(type, props, children) {
    const vnode = {
        type, props, children
    };
    return vnode;
}
//创建字符串vnode
function createTextVNode(text) {
    return createVNode(Text, {}, text);
}

//高阶函数，方便获取render
function createAppWrapper(render) {
    return function createApp(rootComponent) {
        return {
            mount(rootContainer) {
                const VNode = createVNode(rootComponent);
                render(VNode, rootContainer);
            }
        };
    };
}

function createRenderer(options) {
    const { patchProp, insert, createElement, createText, setText } = options;
    function render(vnode, conatiner) {
        patch(vnode, conatiner, null);
    }
    function patch(vnode, container, parent) {
        const { type, children } = vnode;
        switch (type) {
            case Fragment:
                //此时不需要处理自身，直接处理children
                processFragment(children, container, parent);
                break;
            case Text:
                processText(vnode, container);
                break;
            default:
                //此处用于区分是组件还是element
                //如果是组件还需要创建组件实例挂载数据等
                if (is(type)) {
                    processComponent(vnode, container, parent);
                }
                else if (typeof type == "string") {
                    processElement(vnode, container, parent);
                }
                break;
        }
    }
    //vue模板解析生成的，不需要封装成渲染器函数
    function processText(vnode, container) {
        const { children } = vnode;
        // const node = vnode.$el = document.createTextNode(children)
        //container.append(node)
        const node = vnode.$el = createText(children);
        insert(node, container);
    }
    //处理Fragment
    function processFragment(children, container, parent) {
        mountChildren(children, container, parent);
    }
    //处理element元素开始
    function processElement(vnode, container, parent) {
        mountElement(vnode, container, parent);
    }
    function mountElement(vnode, container, parent) {
        const { type, props, children } = vnode;
        const element = createElement(type);
        //将每个自己DOM对象存储在自己vnode中
        vnode.$el = element;
        //props:{id:"red"}
        //挂载元素属性，注意props为对象
        for (const key in props) {
            const value = props[key];
            patchProp(element, props, value);
        }
        //处理子元素，注意只有2种情况字符串与[]
        if (typeof children == "string") {
            setText(element, children);
        }
        else if (children instanceof Array) {
            mountChildren(children, element, parent);
        }
        // container.append(element)
        insert(element, container);
    }
    //此处可抽离，额外供给Fragment使用
    function mountChildren(children, element, parent) {
        children.forEach((child) => {
            patch(child, element, parent);
        });
    }
    //处理组件元素开始
    function processComponent(vnode, container, parent) {
        mountComponent(vnode, container, parent);
    }
    function mountComponent(vnode, container, parent) {
        const instance = createComponentInstance(vnode, parent);
        //初始化组件
        setupComponent(instance);
        //渲染组件子元素
        setupRenderEffect(instance, container);
    }
    function setupRenderEffect(instance, container) {
        //此subTree下方的第一个虚拟节点
        const subTree = instance.vnode.type.render.call(instance.proxy);
        //获取到children后patch，这是每个组件必过之地，且也是与children交互之地，传递自己父组件
        patch(subTree, container, instance);
        //将$el挂载在实例对象上
        instance.$el = subTree.$el;
    }
    return {
        render,
        createApp: createAppWrapper(render)
    };
}

function createElement(type) {
    return document.createElement(type);
}
function createText(text) {
    return document.createTextNode(text);
}
function setText(node, text) {
    node.textContent = text;
}
function patchProp(element, key, value) {
    //判断是否attribut是否是事件
    const onEvent = (event) => {
        return /^on[A-Z]/.test(event);
    };
    if (onEvent(key)) {
        const e = key.slice(2).toLowerCase();
        element.addEventListener(e, value);
    }
    else {
        element.setAttribute(key, value);
    }
}
function insert(el, parent) {
    parent.append(el);
}
const options = {
    patchProp, insert, createElement, createText, setText
};
const { render, createApp } = createRenderer(options);

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
    //3.作用域插槽
    const slot = slots[name];
    if (slot) {
        if (typeof slot == "function") {
            return createVNode(Fragment, {}, slot(data));
        }
    }
}

function provide(key, value) {
    const instance = getCurrentInstance();
    instance.provide[key] = value;
}
function inject(key, value) {
    const instance = getCurrentInstance();
    //需要去父祖组件获取provide
    const { provide } = instance.$parent;
    if (key in provide) {
        return instance.$parent.provide[key];
    }
    else {
        if (typeof value == "function")
            return value();
        else
            return value;
    }
}

export {
    createApp, createRenderer,
    createTextVNode, getCurrentInstance, h, inject, provide, render, renderSlots
};
