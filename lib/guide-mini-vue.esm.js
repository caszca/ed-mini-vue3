const extend = Object.assign;
function is(target) {
    return target != null && typeof target == 'object';
}

const globalMap = new WeakMap();
//全局变量，存储函数的依赖对象，因为其一调用，里面如果有响应式数据就会触发get或其set。
let globalEffectObj;
class reactiveEffect {
    constructor(fn) {
        this.deps = []; //收集依赖对象被哪些set收集的
        this.active = true;
        this._fn = fn;
    }
    run() {
        //存储调用函数
        globalEffectObj = this;
        const result = this._fn();
        globalEffectObj = null; //清空，防止后续stop后又被收集
        return result;
    }
    stop() {
        //删除存有依赖函数的set中的依赖函数
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
    if (!globalEffectObj)
        return;
    dep.add(globalEffectObj);
    globalEffectObj.active = true;
    globalEffectObj.deps.push(dep);
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
//进入此getter只有四种情况：reactive、shallowReactive、readonly、shallowReadonly
function createGetter(isReadonly = false, isShallow = false) {
    return function (target, key, receiver) {
        if (key === "__v_isReactive" /* REACTIVE_FLAGS.IS_REACTIVE */)
            return !isReadonly;
        else if (key === "__v_isReadonly" /* REACTIVE_FLAGS.IS_READONLY */)
            return isReadonly;
        else if (key === "__v_isProxy" /* REACTIVE_FLAGS.IS_PROXY */)
            return true;
        let result = Reflect.get(target, key);
        //shallow为true，直接返回
        if (isShallow) {
            return result;
        }
        //处理嵌套对象，访问的是一个对象，判断需不需要对他处理。
        if (is(result)) {
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
    set,
};
const readonlyHandler = {
    get: readonlyGet,
    set: function () {
        //throw new Error("is readonly,cannt be reset")
        console.warn();
        return true;
    },
};
const shallowReadonlyHandler = {
    get: shallowReadonlyGet,
    set: function () {
        //throw new Error("is readonly,cannt be reset")
        console.warn();
        return true;
    },
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

//emit需要在props中找到对应的监听事件触发,注意instance的获取方式——bind
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
//此关于插槽的处理，都是要将插槽的返回值变为数组形式
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
//作用：将ref对象解包
function proxyRefs(raw) {
    return new Proxy(raw, {
        get(target, key, receiver) {
            return unRef(Reflect.get(target, key));
        },
        //set时，考虑将val包裹程ref，情况-只有要设置的属性是ref，设置的val不为Ref
        set(target, key, value, receiver) {
            if (isRef(Reflect.get(target, key)) && !isRef(value))
                return Reflect.set(target, key, ref(value));
            else
                return Reflect.set(target, key, value);
        },
    });
}

function createComponentInstance(vnode, parent) {
    const vm = {
        vnode,
        proxy: null,
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
    //执行setup,挂载结果
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
    const { type } = instance.vnode;
    let { render } = type;
    if (!render && complier) {
        if (type.template) {
            render = complier(type.template);
        }
    }
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
let complier;
function registerRuntimeCompiler(_complier) {
    complier = _complier;
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

//组件多次响应式数据多次改变时，用于缓存首次更新函数到队列中
const queue = [];
const p = Promise.resolve();
let pending = false; //用途:遍历队列函数只放入微任务队列一次
function queueJobs(updateFn) {
    if (!queue.includes(updateFn)) {
        queue.push(updateFn);
    }
    queueFlush();
}
//负责执行微任务队列
function queueFlush() {
    if (pending)
        return;
    pending = true;
    p.then(() => {
        pending = false;
        while (queue.length) {
            const fn = queue.shift();
            fn();
        }
    });
}
function nextTick(fn) {
    return fn ? p.then(fn) : p;
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
            const { proxy } = instance;
            //组件第一次挂载时
            if (!instance.isMounted) {
                //subTree为虚拟DOM树，此subTree下方的第一个虚拟节点
                const subTree = (instance.subTree = instance.render.call(proxy, proxy));
                //获取到children后patch，这是每个组件必过之地，且也是与children交互之地，传递自己作为父组件
                patch(null, subTree, container, instance, anchor);
                //将$el挂载在组件实例上
                instance.$el = subTree.$el;
                instance.isMounted = true;
            }
            else {
                console.log("patch component");
                const subTree = instance.render.call(proxy, proxy);
                patch(instance.subTree, subTree, container, instance, anchor);
                instance.subTree = subTree;
            }
        }, {
            scheduler() {
                //组件多次响应式数据多次改变时，用于缓存首次更新函数到队列中
                queueJobs(instance.update);
            },
        });
    }
    return {
        render,
        //此处正好需要导出一个creatApp,采用高阶函数
        createApp: createAppWrapper(render),
    };
}
//动态规划解决最长递增子序列
function getSequence(nums) {
    let dp = new Array(nums.length);
    let ans = [];
    for (let i = 0; i < nums.length; i++) {
        dp[i] = [i];
        for (let j = 0; j < i; j++) {
            if (nums[i] > nums[j]) {
                dp[i] = dp[i].length < dp[j].length + 1 ? [...dp[j], i] : dp[i];
            }
        }
        ans = dp[i].length > ans.length ? dp[i] : ans;
    }
    return ans;
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
        return provide[key];
    }
    else {
        if (typeof value == "function")
            return value();
        else
            return value;
    }
}

function toDisplayString(value) {
    return String(value);
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

var runtimeDom = /*#__PURE__*/Object.freeze({
    __proto__: null,
    createApp: createApp,
    createElementVNode: createVNode,
    createRenderer: createRenderer,
    createTextVNode: createTextVNode,
    getCurrentInstance: getCurrentInstance,
    h: h,
    inject: inject,
    nextTick: nextTick,
    provide: provide,
    ref: ref,
    registerRuntimeCompiler: registerRuntimeCompiler,
    render: render,
    renderSlots: renderSlots,
    toDisplayString: toDisplayString
});

//负责将ast(抽象语法树)转换为render函数
function handle(val) {
    return `${val} : _${val}`;
}
//处理import情况
function handleImport(ast, push) {
    const { parameter } = ast;
    if (parameter.size) {
        let par = [];
        for (const val of parameter) {
            par.push(handle(val));
        }
        push(`const { ${par.join(", ")} } = vue`);
        push("\n");
    }
}
function generate(ast) {
    console.log("-----", ast.children[0]);
    const context = createCodegenContext(ast);
    const { push } = context;
    handleImport(ast, push);
    const functionName = "render";
    const args = ["_ctx", "_cache"];
    push(`return function ${functionName}(${args.join(", ")}){ return `);
    codegen(ast.children[0], context);
    push(" }");
    return context;
}
function codegen(rootNode, context) {
    switch (rootNode.type) {
        case 3 /* NodeType.TEXT */:
            genText(rootNode, context);
            break;
        case 0 /* NodeType.INTERPOLATION */:
            genInterpolation(rootNode, context);
            break;
        case 1 /* NodeType.SIMPLE_EXPRESSION */:
            genSimpleExpression(rootNode, context);
            break;
        case 2 /* NodeType.ELEMENT */:
            genElement(rootNode, context);
            break;
        case 5 /* NodeType.COMPOUND_EXPRESSION */:
            genCompound(rootNode, context);
            break;
    }
}
function codegenChildren(nodes, context) {
    if (nodes.length) {
        for (const node of nodes) {
            codegen(node, context);
        }
    }
}
function createCodegenContext(ast) {
    const context = {
        code: "",
        push(source) {
            context.code += source;
        },
        ast,
    };
    return context;
}
function genText(node, context) {
    const { push } = context;
    push(`'${node.content}'`);
}
function genSimpleExpression(node, context) {
    const { push } = context;
    push(`${node.content}`);
}
function genInterpolation(node, context) {
    const { push } = context;
    push("_toDisplayString(");
    codegen(node.content, context);
    push(")");
}
function genElement(node, context) {
    const { push } = context;
    push(`_createElementVNode(`);
    genNodeList(node, context);
    push(")");
}
function genNodeList(node, context) {
    const { push } = context;
    const { tag, props, children } = node;
    push(`'${tag}', ${props || null}, `);
    console.log(children, "----------");
    children ? codegenChildren(children, context) : push("null");
}
function genCompound(node, context) {
    codegenChildren(node.children, context);
}
//return function render(_ctx, _cache, $props, $setup, $data, $options) { return "hi" }

const TO_DISPLAY_STRING = Symbol("toDisplayString");
const CREATE_ELEMENT_VNODE = Symbol("createElementVNode");
const helperMapName = {
    [TO_DISPLAY_STRING]: "toDisplayString",
    [CREATE_ELEMENT_VNODE]: "createElementVNode",
};

//负责将template字符串转化为ats(抽象语法树)
function baseParse(content) {
    const context = createParserContext(content);
    return createRoot(parseChildren(context, ""));
}
//解析children
function parseChildren(context, parentTag) {
    const nodes = [];
    let node;
    while (!isEnd(context, parentTag)) {
        const { source } = context;
        //解析插值
        if (source.startsWith("{{")) {
            node = parseInterpolation(context);
        }
        else if (source[0] == "<" && /[a-z]/i.test(source[1])) {
            //解析HTML元素
            node = parseElement(context);
        }
        else {
            //处理text
            node = parseText(context);
        }
        nodes.push(node);
    }
    return nodes;
}
//判断是否结束
function isEnd(context, parentTag) {
    const { source } = context;
    return !source || source.startsWith(`</${parentTag}>`);
}
//解析普通文本
function parseText(context) {
    let { source } = context;
    const delimiter = ["{{", "<", "</"];
    let endIndex = source.length;
    for (const key of delimiter) {
        let index = source.indexOf(key);
        if (index >= 0 && index < endIndex) {
            endIndex = index;
        }
    }
    if (endIndex == -1) {
        source = parseTextSlice(context, source.length);
    }
    else {
        source = parseTextSlice(context, endIndex);
    }
    return {
        type: 3 /* NodeType.TEXT */,
        content: source,
    };
}
function parseTextSlice(context, index) {
    let { source } = context;
    context.source = source.slice(index);
    source = source.slice(0, index);
    return source;
}
//解析HTML元素，<div></div>——>{tag:"div",type:元素}
function parseElement(context) {
    //处理开始标签
    const result = parseTag(context, 0 /* TagType.Start */);
    result.children = parseChildren(context, result.tag);
    //处理结尾标签
    parseTag(context, 1 /* TagType.End */);
    return result;
}
function parseTag(context, type) {
    const { source } = context;
    const match = /^<\/?([a-z]*)/i.exec(source);
    const tag = match[1];
    context.source = source.slice(match[0].length + 1);
    if (type == 1 /* TagType.End */)
        return;
    return {
        type: 2 /* NodeType.ELEMENT */,
        tag,
    };
}
//解析插槽功能,将{{ message }}——>message,注意返回结果结构
function parseInterpolation(context) {
    const { source } = context;
    const openDelimiter = "{{";
    const closeDelimiter = "}}";
    const start = source.indexOf(openDelimiter);
    const end = source.indexOf(closeDelimiter);
    const content = source.slice(start + openDelimiter.length, end).trim();
    context.source = source.slice(end + closeDelimiter.length); //parse过的字符串就截掉，剩下后面的继续parse。
    return {
        type: 0 /* NodeType.INTERPOLATION */,
        content: {
            type: 1 /* NodeType.SIMPLE_EXPRESSION */,
            content,
        },
    };
}
function createRoot(children) {
    const root = {
        parameter: new Set(),
        pushParameter(args) {
            root.parameter.add(helperMapName[args]);
        },
        type: 4 /* NodeType.ROOT */,
        children,
    };
    return root;
}
function createParserContext(content) {
    return {
        source: content,
    };
}

function transform(ast, options = {}) {
    const context = createTransformContext(ast, options);
    traverseNode(ast, context);
}
function createTransformContext(ast, options) {
    return {
        ast,
        nodeTransforms: options.nodeTransforms || [],
    };
}
//深度优先遍历ast(抽象语法树)
function traverseNode(node, context) {
    const { nodeTransforms } = context;
    for (const plugin of nodeTransforms) {
        plugin(node, context);
    }
    switch (node.type) {
        case 2 /* NodeType.ELEMENT */:
            transformElement(node, context);
        case 4 /* NodeType.ROOT */:
            transformElement_Root(node, context);
            break;
        case 0 /* NodeType.INTERPOLATION */:
            transformExpression$1(node, context);
            break;
        case 5 /* NodeType.COMPOUND_EXPRESSION */:
            transformCompound1(node, context);
            break;
    }
}
function transformElement(node, context) {
    const { ast } = context;
    ast.pushParameter(CREATE_ELEMENT_VNODE);
}
//遍历element元素子节点。
function transformElement_Root(node, context) {
    const { children } = node;
    traverseChildren(children, context);
}
//处理有插槽就往ast根节点添加数组
function transformExpression$1(node, context) {
    //普通出路，未用transform里的插件
    // node.content.content = "_ctx." + node.content.content;
    const { ast } = context;
    ast.pushParameter(TO_DISPLAY_STRING);
}
function transformCompound1(node, context) {
    const { children } = node;
    traverseChildren(children, context);
}
function traverseChildren(children, context) {
    if (children && children.length) {
        for (const node of children) {
            traverseNode(node, context);
        }
    }
}

//transform插件，用于处理遇到插槽节点时，所需添加参数等
function transformExpression(node, context) {
    if (node.type == 0 /* NodeType.INTERPOLATION */) {
        node.content.content = "_ctx." + node.content.content;
    }
}

const addConst = {
    type: 1 /* NodeType.SIMPLE_EXPRESSION */,
    content: " + ",
};
function transformCompound(node, context) {
    if (node.type == 2 /* NodeType.ELEMENT */) {
        const { children } = node;
        for (let i = 0; i < children.length; i++) {
            const node = children[i];
            if (isText_Interpolation(node)) {
                let container = null;
                for (let j = i + 1; j < children.length; j++) {
                    const nodej = children[j];
                    if (isText_Interpolation(nodej)) {
                        //相近节点为text与插槽（不区分先后）
                        if (!container) {
                            //初次
                            container = children[i] = {
                                type: 5 /* NodeType.COMPOUND_EXPRESSION */,
                                children: [node],
                            };
                        }
                        console.log("-----", j);
                        children.splice(j, 1); //删掉已经添加进去的节点
                        j--; //splice引起的数组后续往前移
                        container.children.push(addConst);
                        container.children.push(nodej);
                    }
                    else {
                        //遇到非上述节点退出内层循环，继续外层循环
                        container = null;
                        break;
                    }
                }
            }
        }
    }
}
//判断节点是否为插槽或文本text
function isText_Interpolation(node) {
    return node.type == 0 /* NodeType.INTERPOLATION */ || node.type == 3 /* NodeType.TEXT */;
}

//将参数template转化为一个render字符串
function baseCompile(template) {
    const ast = baseParse(template);
    transform(ast, {
        nodeTransforms: [transformExpression, transformCompound],
    });
    return generate(ast);
}

function compileToFunction(template) {
    const { code } = baseCompile(template);
    const render = new Function("vue", code)(runtimeDom); //传递进vue，执行code代码，返回render函数
    return render;
}
registerRuntimeCompiler(compileToFunction);

export { compileToFunction, createApp, createVNode as createElementVNode, createRenderer, createTextVNode, getCurrentInstance, h, inject, nextTick, provide, ref, registerRuntimeCompiler, render, renderSlots, toDisplayString };
