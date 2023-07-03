function is(target) {
    return target != null && typeof target == 'object';
}

const proxyHandler = {
    get({ instance }, key) {
        const { setupState } = instance;
        if (key in setupState) {
            return setupState[key];
        }
        if (key in instance) {
            return instance[key];
        }
    }
};
//proxy代理对象，其实我也很疑惑代理的对象竟然不选择实例对象，就是拦截对实例的get请求，针对key值去
//不同地方取值

function createComponentInstance(vnode) {
    const vm = {
        vnode,
        setupState: {},
        $el: null
    };
    return vm;
}
function setupComponent(instance) {
    //todo 
    //initProps  initSlots
    setupStatefulComponent(instance);
}
//执行setup
function setupStatefulComponent(instance) {
    //每个组件都会进来一次用于初始化各种数据与proxy代理对象
    instance.proxy = new Proxy({ instance }, proxyHandler);
    const { setup } = instance.vnode.type;
    if (setup) {
        const setupResult = setup();
        handleSetupResult(setupResult, instance);
    }
}
//处理setup()结果
function handleSetupResult(setupResult, instance) {
    if (typeof setupResult == "object") {
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
            if (typeof child == "object")
                patch(child, element);
            else
                element.append(child);
        });
    }
    else {
        patch(children, element);
    }
    container.append(element);
}
//处理组件元素开始
function processComponent(vnode, container) {
    mountComponent(vnode, container);
}
function mountComponent(vnode, container) {
    const instance = createComponentInstance(vnode);
    setupComponent(instance);
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

export { createApp, h };
