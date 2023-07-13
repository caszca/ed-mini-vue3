const extend = Object.assign;
function is(target) {
    return target != null && typeof target == 'object';
}

const globalMap = new WeakMap();
//全局变量，存储调用时的函数，因为其一调用，里面如果有响应式数据就会触发get或其set，提前存储好，方便直接存入
let globalFn;
class reactiveEffect {
    constructor(fn) {
        this.deps = []; //收集依赖对象被哪些set收集的
        this.active = true;
        this._fn = fn;
    }
    run() {
        //存储调用函数
        globalFn = this;
        const result = this._fn();
        globalFn = null; //清空，防止后续stop后又被收集
        return result;
    }
    stop() {
        if (this.active) {
            cleanEffect(this);
            if (this.onStop) {
                this.onStop();
            }
            this.active = false;
        }
    }
}
function cleanEffect(effect) {
    effect.deps.forEach((item) => {
        item.delete(effect);
    });
    effect.deps.length = 0;
}
function effect(fn, options = {}) {
    const e = new reactiveEffect(fn);
    extend(e, options);
    e.run();
    //注意此处的run挂载依赖对象
    // e.run["effectObj"] = e //了解bind原理就知道不能先挂载再bind
    const runner = e.run.bind(e);
    //注意此时返回runner挂载依赖对象，方便后续的stop时能去调用依赖对象里的stop
    runner.effectObj = e;
    return runner;
}
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
    //准备添加新的依赖对象，全局变量存储的
    trackEffect(dep);
}
function trackEffect(dep) {
    if (!globalFn)
        return;
    dep.add(globalFn);
    globalFn.active = true;
    globalFn.deps.push(dep);
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
//proxy代理对象，其实我也很疑惑代理的对象竟然不选择组件实例对象，就是拦截对实例的get请求，针对key值去
//不同地方取值

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

const EMITY_PROPS = {};
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

// let obj = {
//     _value: 1,
//     get value() {
//         return this._value
//     },
//     set value(newVal) {
//         this._value = newVal
//     }
// }
// console.log(obj.value)
// obj.value = 2
class Ref {
    constructor(refValue) {
        this.__v_isRef = true;
        //传入ref可能为一个对象，需要用reactive包裹
        this._value = convert(refValue);
        this.dep = new Set();
    }
    get value() {
        //收集依赖
        trackEffect(this.dep);
        return this._value;
    }
    set value(newValue) {
        if (!Object.is(this._value, newValue)) {
            //一个包含对象类型值的ref可以响应式替换整个对象
            //判断逻辑尚待：let o=ref(obj) ,o.value=obj  相同对象会触发依赖？
            //ref传入属性类型与后期修改value不一样会报错？obj->普通，普通->obj
            this._value = convert(newValue);
            //触发依赖
            triggerEffect(this.dep);
        }
    }
}
function convert(value) {
    return is(value) ? reactive(value) : value;
}
function ref(value) {
    let refObj = new Ref(value);
    return refObj;
}
//Ref对象的判断与reactive对象不同，因为proxy代理对象get时会获取到key值，
//我们可以根据key值去判断，而ref的get只针对value,无法获取到其他的key值。
//所以直接在Ref对象中内置一个属性来判断是否为ref对象
function isRef(raw) {
    return !!raw["__v_isRef" /* REF_FLAGS.IS_REF */];
}
function unRef(raw) {
    return isRef(raw) ? raw.value : raw;
}
//作用：将ref对象
function proxyRefs(raw) {
    return new Proxy(raw, {
        get(target, key, receiver) {
            return unRef(Reflect.get(target, key));
        },
        set(target, key, value, receiver) {
            if (isRef(Reflect.get(target, key)) && !isRef(value))
                return Reflect.set(target, key, ref(value));
            else
                return Reflect.set(target, key, value);
        }
    });
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
        $parent: parent,
        isMounted: false,
        subTree: null
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
        //此处用proxyRefs解包ref对象
        instance.setupState = proxyRefs(setupResult);
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
        type, props, children, $el: null, key: props ? props.key : null
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
    const { patchProp, insert, createElement, createText, setText, remove } = options;
    function render(vnode, conatiner) {
        patch(null, vnode, conatiner, null);
    }
    function patch(preVnode, vnode, container, parent) {
        const { type, children } = vnode;
        switch (type) {
            case Fragment:
                //此时不需要处理自身，直接处理children
                processFragment(preVnode, vnode, container, parent);
                break;
            case Text:
                processText(preVnode, vnode, container);
                break;
            default:
                //此处用于区分是组件还是element
                //如果是组件还需要创建组件实例挂载数据等
                if (is(type)) {
                    processComponent(preVnode, vnode, container, parent);
                }
                else if (typeof type == "string") {
                    processElement(preVnode, vnode, container, parent);
                }
                break;
        }
    }
    //vue模板解析生成的，不需要封装成渲染器函数
    function processText(preVnode, vnode, container) {
        const { children } = vnode;
        // const node = vnode.$el = document.createTextNode(children)
        //container.append(node)
        const node = (vnode.$el = createText(children));
        insert(node, container);
    }
    //处理Fragment
    function processFragment(preVnode, vnode, container, parent) {
        mountChildren(vnode, container, parent);
    }
    //处理element元素开始
    function processElement(preVnode, vnode, container, parent) {
        if (preVnode) {
            patchElement(preVnode, vnode, container, parent);
        }
        else {
            mountElement(vnode, container, parent);
        }
    }
    function patchElement(preVnode, vnode, container, parent) {
        console.log("update");
        const el = (vnode.$el = preVnode.$el);
        const preProps = preVnode.props || EMITY_PROPS;
        const props = vnode.props || EMITY_PROPS;
        patchChildren(el, preVnode, vnode, container, parent);
        patchProps(el, preProps, props);
    }
    //更新子节点
    function patchChildren(el, preVnode, vnode, container, parent) {
        const preChild = preVnode.children;
        const child = vnode.children;
        if (typeof child == "string") {
            if (is(preChild)) {
                //array——>text
                unmountChildren(preChild);
                setText(el, child);
            }
            else if (preChild != child) {
                //text——>text
                setText(el, child);
            }
        }
        else {
            if (is(preChild)) {
                //array——>array,注意此处传递的el作为container，因为我们DOM层级是逐层递深，更换容器在此处
                patchKeyChildren(preChild, child, el, parent);
            }
            else {
                //text->array
                setText(el, "");
                mountChildren(vnode, el, parent);
            }
        }
    }
    //移除节点的直属子节点,注意这里是children，且每个child都是一个vnode，且每个vnode都有自己create的$el
    function unmountChildren(preChild) {
        for (const vnode of preChild) {
            remove(vnode.$el);
        }
    }
    function patchKeyChildren(preChild, child, container, parent) {
        let i = 0;
        let e1 = preChild.length - 1, e2 = child.length - 1; //比较三指针
        function isSameVnodeType(n1, n2) {
            return n1.type == n2.type && n1.key == n2.key;
        }
        //左侧比较
        while (i <= e1 && i <= e2) {
            if (isSameVnodeType(preChild[i], child[i])) {
                patch(preChild[i], child[i], container, parent);
                i++;
            }
            else
                break;
        }
        //右侧比较
        while (e1 >= i && e2 >= i) {
            if (isSameVnodeType(preChild[e1], child[e2])) {
                patch(preChild[e1], child[e2], container, parent);
                e1--;
                e2--;
            }
            else
                break;
        }
        if (i > e1) {
            //老的被一次性对比完了，看新的情况了
            if (i <= e2) {
                //此时新的还有剩余的，需要添加，但是新的位置需要分为两种情况来做
                while (i <= e2) {
                    patch(null, child[i], container, parent);
                    i++;
                }
            }
        }
    }
    //更新props
    function patchProps(el, preProps, props) {
        if (preProps != props) {
            for (const key in preProps) {
                const preVal = preProps[key];
                const val = props[key];
                patchProp(el, key, preVal, val);
            }
            for (const key in props) {
                const val = props[key];
                if (!(key in preProps))
                    patchProp(el, key, null, val);
            }
        }
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
            patchProp(element, key, null, value);
        }
        //处理子元素，注意只有2种情况字符串与[]
        if (typeof children == "string") {
            setText(element, children);
        }
        else if (children instanceof Array) {
            mountChildren(vnode, element, parent);
        }
        // container.append(element)
        insert(element, container);
    }
    //此处可抽离，额外供给Fragment使用,作用：将某个vnode的children挂载到某个DOM节点上
    function mountChildren(vnode, element, parent) {
        vnode.children.forEach((child) => {
            patch(null, child, element, parent);
        });
    }
    //处理组件元素开始
    function processComponent(preVnode, vnode, container, parent) {
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
        effect(() => {
            //组件第一次挂载时
            if (!instance.isMounted) {
                //此subTree下方的第一个虚拟节点
                const subTree = (instance.subTree = instance.vnode.type.render.call(instance.proxy));
                //获取到children后patch，这是每个组件必过之地，且也是与children交互之地，传递自己作为父组件
                patch(null, subTree, container, instance);
                //将$el挂载在实例对象上
                instance.$el = subTree.$el;
                instance.isMounted = true;
            }
            else {
                const subTree = instance.vnode.type.render.call(instance.proxy);
                patch(instance.subTree, subTree, container, instance);
                instance.subTree = subTree;
            }
        });
    }
    return {
        render,
        //此处正好需要导出一个creatApp,采用高阶函数
        createApp: createAppWrapper(render),
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
function patchProp(element, key, preVal, value) {
    //判断是否attribut是否是事件
    const onEvent = (event) => {
        return /^on[A-Z]/.test(event);
    };
    if (onEvent(key)) {
        const e = key.slice(2).toLowerCase();
        element.addEventListener(e, value);
    }
    else {
        if (preVal != value) {
            if (value == undefined || value == null)
                element.removeAttribute(key);
            else
                element.setAttribute(key, value);
        }
    }
}
function insert(el, parent) {
    parent.append(el);
}
//我本来想写的是直接传递父节点的el，将其直属的子节点全部删除，但是发现其好像不太通用
//还是换成传递进来el,删除其自身。
function remove(el) {
    const parentNode = el.parentNode;
    if (parentNode) {
        parentNode.removeChild(el);
    }
}
const options = {
    patchProp,
    insert,
    createElement,
    createText,
    setText,
    remove,
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

export { createApp, createRenderer, createTextVNode, getCurrentInstance, h, inject, provide, ref, render, renderSlots };
