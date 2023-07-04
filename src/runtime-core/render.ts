import { is } from "../utils/index"
import { createComponentInstance, setupComponent } from "./component"
import { Fragment, Text } from "./vnode";

export function render(vnode, conatiner) {
    patch(vnode, conatiner)
}

export function patch(vnode, container) {
    const { type, children } = vnode
    switch (type) {
        case Fragment:
            //此时不需要处理自身，直接处理children
            processFragment(children, container)
            break;
        case Text:
            processText(children, container)
            break;

        default:
            //此处用于区分是组件还是element
            //如果是组件还需要创建组件实例挂载数据等
            if (is(type)) {
                processComponent(vnode, container)
            } else if (typeof type == "string") {
                processElement(vnode, container)
            }
            break;
    }
}

function processText(children, container) {
    const node = document.createTextNode(children)
    container.append(node)
}

//处理Fragment
function processFragment(children, container) {
    mountChildren(children, container)
}

//处理element元素开始
function processElement(vnode: any, container: any) {
    mountElement(vnode, container)
}

//判断是否attribut是否是事件
function onEvent(event) {
    return /^on[A-Z]/.test(event)
}

function mountElement(vnode: any, container: any) {
    const { type, props, children } = vnode
    const element = document.createElement(type)
    //将每个自己DOM对象存储在自己vnode中
    vnode.$el = element

    //props:{id:"red"}
    //挂载元素属性，注意props为对象
    for (const key in props) {
        if (onEvent(key)) {
            const e = key.slice(2).toLowerCase()
            element.addEventListener(e, props[key])
        }
        else {
            element.setAttribute(key, props[key])
        }
    }

    //处理子元素，注意只有2种情况字符串与[]
    if (typeof children == "string") {
        element.textContent = children
    } else if (children instanceof Array) {
        mountChildren(children, element)
    }
    container.append(element)
}


//此处可抽离，额外供给Fragment使用
function mountChildren(children, element) {
    children.forEach((child) => {
        patch(child, element)
    })
}




//处理组件元素开始
function processComponent(vnode, container) {
    mountComponent(vnode, container)
}

function mountComponent(vnode, container) {
    const instance = createComponentInstance(vnode)
    //初始化组件
    setupComponent(instance)
    //渲染组件子元素
    setupRenderEffect(instance, container)
}

function setupRenderEffect(instance, container) {
    //此subTree下方的第一个虚拟节点
    const subTree = instance.vnode.type.render.call(instance.proxy)
    patch(subTree, container)
    //将$el挂载在实例对象上
    instance.$el = subTree.$el
}



