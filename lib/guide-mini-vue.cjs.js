'use strict';

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
        const { setupState, $props } = instance;
        if (key in setupState) {
            return setupState[key];
        }
        if (key in $props) {
            return $props[key];
        }
        if (key in instance) {
            return instance[key];
        }
    },
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
    const { $props } = instance;
    if (emitEvent) {
        let e = "on" + emitEvent[0].toUpperCase() + emitEvent.slice(1);
        $props[e] && $props[e](...args);
    }
}

const EMITY_PROPS = {};
function initProps(instance) {
    const { props } = instance.vnode;
    if (is(props)) {
        instance.$props = props;
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
        $parent: parent,
        $props: {},
        provide: parent ? Object.create(parent.provide) : {},
        isMounted: false,
        subTree: null,
        update: () => { }, //组件实例更新函数
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
        const setupResult = setup(shallowReadonly(instance.$props), {
            emit: instance.$emit,
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
        type,
        props,
        children,
        $el: null,
        key: props ? props.key : null,
        instance: null, //组件vnode拥有的组件实例，在updateComponent有用
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
        patch(null, vnode, conatiner, null, null);
    }
    function patch(preVnode, vnode, container, parent, anchor) {
        const { type, children } = vnode;
        switch (type) {
            case Fragment:
                //此时不需要处理自身，直接处理children
                processFragment(preVnode, vnode, container, parent, anchor);
                break;
            case Text:
                processText(preVnode, vnode, container);
                break;
            default:
                //此处用于区分是组件还是element
                //如果是组件还需要创建组件实例挂载数据等
                if (is(type)) {
                    processComponent(preVnode, vnode, container, parent, anchor);
                }
                else if (typeof type == "string") {
                    processElement(preVnode, vnode, container, parent, anchor);
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
    function processFragment(preVnode, vnode, container, parent, anchor) {
        mountChildren(vnode, container, parent, anchor);
    }
    //处理element元素开始
    function processElement(preVnode, vnode, container, parent, anchor) {
        if (preVnode) {
            patchElement(preVnode, vnode, container, parent, anchor);
        }
        else {
            mountElement(vnode, container, parent, anchor);
        }
    }
    function patchElement(preVnode, vnode, container, parent, anchor) {
        console.log("update");
        const el = (vnode.$el = preVnode.$el);
        const preProps = preVnode.props || EMITY_PROPS;
        const props = vnode.props || EMITY_PROPS;
        patchChildren(el, preVnode, vnode, container, parent, anchor);
        patchProps(el, preProps, props);
    }
    //更新子节点
    function patchChildren(el, preVnode, vnode, container, parent, anchor) {
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
                patchKeyChildren(preChild, child, el, parent, anchor);
            }
            else {
                //text->array
                setText(el, "");
                mountChildren(vnode, el, parent, anchor);
            }
        }
    }
    //移除节点的直属子节点,注意这里是children，且每个child都是一个vnode，且每个vnode都有自己create的$el
    function unmountChildren(preChild) {
        for (const vnode of preChild) {
            remove(vnode.$el);
        }
    }
    //vue中的diff算法
    function patchKeyChildren(preChild, child, container, parent, anchor) {
        //建议此处配合example加上自己画图分析
        let i = 0;
        let e1 = preChild.length - 1, e2 = child.length - 1; //比较三指针
        function isSameVnodeType(n1, n2) {
            return n1.type == n2.type && n1.key == n2.key;
        }
        //左侧比较
        while (i <= e1 && i <= e2) {
            if (isSameVnodeType(preChild[i], child[i])) {
                patch(preChild[i], child[i], container, parent, anchor);
                i++;
            }
            else
                break;
        }
        //右侧比较
        while (e1 >= i && e2 >= i) {
            if (isSameVnodeType(preChild[e1], child[e2])) {
                patch(preChild[e1], child[e2], container, parent, anchor);
                e1--;
                e2--;
            }
            else
                break;
        }
        if (i > e1) {
            //老的被一次性对比完了，看新的情况了
            if (i <= e2) {
                //此时新的还有剩余的，需要添加，但是新的位置需要分为两种情况来做,
                //这里作为anchor的初始传递点之一，这里是比较开始，还有一处也许是render函数里的
                while (i <= e2) {
                    const anchor = e1 < 0 ? preChild[e1 + 1].$el : null;
                    patch(null, child[i], container, parent, anchor);
                    i++;
                }
            }
        }
        else {
            //包含两种情况，新的被遍历完了或中间有乱序。
            if (i > e2) {
                //新的被遍历完了，接下来需要删除旧的节点。
                while (i <= e1) {
                    remove(preChild[i].$el);
                    i++;
                }
            }
            else {
                //中间乱序部分的处理开始
                //首先建立映射表关于新的vnode。
                let newLength = e2 - i + 1; //新节点乱序部分长度
                const newKeyMapVNode = new Map(); //新节点key映射表
                const oldIndexMapNewIndex = new Array(newLength); //新旧索引映射
                for (let i = 0; i < newLength; i++) {
                    oldIndexMapNewIndex[i] = 0;
                }
                for (let start = i; start <= e2; start++) {
                    const vnode = child[start];
                    newKeyMapVNode.set(vnode.key, start); //value值变为索引
                }
                //遍历旧vnode，寻找需要删除和patch的
                for (let old = i; old <= e1; old++) {
                    let newIndex;
                    const preVnode = preChild[old];
                    //旧节点有key
                    if (preVnode.key != null) {
                        newIndex = newKeyMapVNode.get(preVnode.key);
                        //在map中找到旧节点对于的key
                    }
                    else {
                        //旧节点无key，遍历新节点查找
                        for (let n = i; n <= e2; n++) {
                            if (isSameVnodeType(preVnode, child[n])) {
                                newIndex = n;
                                break;
                            }
                        }
                    }
                    //查询结束，两种情况，有或无
                    if (newIndex != undefined) {
                        oldIndexMapNewIndex[newIndex - i] = old + 1; //注意这里的赋值，因为后续getSequence得到为索引
                        //此处patch时，是对新旧节点初始的patch，故anchor为null
                        patch(preVnode, child[newIndex], container, parent, null);
                    }
                    else {
                        remove(preVnode.$el);
                    }
                }
                //开始处理移动和增加功能
                const increasingNewIndexSequence = getSequence(oldIndexMapNewIndex); //递增子序列，注意返回值为索引
                let j = increasingNewIndexSequence.length - 1;
                //针对新节点倒叙遍历
                for (let start = newLength - 1; start >= 0; start--) {
                    const index = start + i;
                    const anchor = index + 1 < child.length ? child[index + 1].$el : null; //边缘情况，最后面需要插入的后面无节点
                    if (oldIndexMapNewIndex[start] == 0) {
                        //代表此节点，旧节点中无，需要创建
                        patch(null, child[index], container, parent, anchor);
                        continue;
                    }
                    if (j < 0 || start != increasingNewIndexSequence[j]) {
                        insert(child[index].$el, container, anchor);
                    }
                    else {
                        j--;
                    }
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
    function mountElement(vnode, container, parent, anchor) {
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
            mountChildren(vnode, element, parent, anchor);
        }
        // container.append(element)
        insert(element, container, anchor);
    }
    //此处可抽离，额外供给Fragment使用,作用：将某个vnode的children挂载到某个DOM节点上
    function mountChildren(vnode, element, parent, anchor) {
        vnode.children.forEach((child) => {
            patch(null, child, element, parent, anchor);
        });
    }
    //处理组件元素开始
    function processComponent(preVnode, vnode, container, parent, anchor) {
        if (preVnode) {
            //更新组件
            updateComponent(preVnode, vnode);
        }
        else {
            mountComponent(vnode, container, parent, anchor);
        }
    }
    function mountComponent(vnode, container, parent, anchor) {
        const instance = (vnode.instance = createComponentInstance(vnode, parent));
        //初始化组件
        setupComponent(instance);
        //渲染组件子元素
        setupRenderEffect(instance, container, anchor);
    }
    //更新组件，判断传递进来的props是否改变，没有旧=就不再往下patch
    function updateComponent(preVnode, vnode) {
        const instance = (vnode.instance = preVnode.instance);
        vnode.$el = preVnode.$el;
        instance.vnode = vnode;
        if (shouComponentUpdate(preVnode, vnode)) {
            //需要更新
            const { update } = instance;
            instance.$props = vnode.props;
            update();
        }
    }
    //根据其传递进来的props判断是否需要更新，shallowEquall
    function shouComponentUpdate(preVnode, vnode) {
        const preProps = preVnode.props;
        const { props } = vnode;
        for (const key in props) {
            if (preProps[key] !== props[key]) {
                return true;
            }
        }
        return false;
    }
    function setupRenderEffect(instance, container, anchor) {
        instance.update = effect(() => {
            //组件第一次挂载时
            if (!instance.isMounted) {
                //此subTree下方的第一个虚拟节点
                const subTree = (instance.subTree = instance.vnode.type.render.call(instance.proxy));
                //获取到children后patch，这是每个组件必过之地，且也是与children交互之地，传递自己作为父组件
                patch(null, subTree, container, instance, anchor);
                //将$el挂载在实例对象上
                instance.$el = subTree.$el;
                instance.isMounted = true;
            }
            else {
                const subTree = instance.vnode.type.render.call(instance.proxy);
                patch(instance.subTree, subTree, container, instance, anchor);
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
function getSequence(arr) {
    const p = arr.slice();
    const result = [0];
    let i, j, u, v, c;
    const len = arr.length;
    for (i = 0; i < len; i++) {
        const arrI = arr[i];
        if (arrI !== 0) {
            j = result[result.length - 1];
            if (arr[j] < arrI) {
                p[i] = j;
                result.push(i);
                continue;
            }
            u = 0;
            v = result.length - 1;
            while (u < v) {
                c = (u + v) >> 1;
                if (arr[result[c]] < arrI) {
                    u = c + 1;
                }
                else {
                    v = c;
                }
            }
            if (arrI < arr[result[u]]) {
                if (u > 0) {
                    p[i] = result[u - 1];
                }
                result[u] = i;
            }
        }
    }
    u = result.length;
    v = result[u - 1];
    while (u-- > 0) {
        result[u] = v;
        v = p[v];
    }
    return result;
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
function insert(el, parent, anchor = null) {
    parent.insertBefore(el, anchor);
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

exports.createApp = createApp;
exports.createRenderer = createRenderer;
exports.createTextVNode = createTextVNode;
exports.getCurrentInstance = getCurrentInstance;
exports.h = h;
exports.inject = inject;
exports.provide = provide;
exports.ref = ref;
exports.render = render;
exports.renderSlots = renderSlots;
