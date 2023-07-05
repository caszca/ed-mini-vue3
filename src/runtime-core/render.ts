import { is } from "../utils/index"
import { createComponentInstance, setupComponent } from "./component"
import { createAppWrapper } from "./createApp";
import { Fragment, Text } from "./vnode";


export function createRenderer(options) {
    const { patchProp, insert, createElement, createText, setText } = options

    function render(vnode, conatiner) {
        patch(vnode, conatiner, null)
    }

    function patch(vnode, container, parent) {
        const { type, children } = vnode
        switch (type) {
            case Fragment:
                //此时不需要处理自身，直接处理children
                processFragment(children, container, parent)
                break;
            case Text:
                processText(vnode, container)
                break;

            default:
                //此处用于区分是组件还是element
                //如果是组件还需要创建组件实例挂载数据等
                if (is(type)) {
                    processComponent(vnode, container, parent)
                } else if (typeof type == "string") {
                    processElement(vnode, container, parent)
                }
                break;
        }
    }

    //vue模板解析生成的，不需要封装成渲染器函数
    function processText(vnode, container) {
        const { children } = vnode
        // const node = vnode.$el = document.createTextNode(children)
        //container.append(node)
        const node = vnode.$el = createText(children)
        insert(node, container)
    }

    //处理Fragment
    function processFragment(children, container, parent) {
        mountChildren(children, container, parent)
    }

    //处理element元素开始
    function processElement(vnode: any, container: any, parent) {
        mountElement(vnode, container, parent)
    }



    function mountElement(vnode: any, container: any, parent) {
        const { type, props, children } = vnode
        const element = createElement(type)
        //将每个自己DOM对象存储在自己vnode中
        vnode.$el = element

        //props:{id:"red"}
        //挂载元素属性，注意props为对象
        for (const key in props) {
            const value = props[key]
            patchProp(element, props, value)
        }


        //处理子元素，注意只有2种情况字符串与[]
        if (typeof children == "string") {
            setText(element, children)
        } else if (children instanceof Array) {
            mountChildren(children, element, parent)
        }
        // container.append(element)
        insert(element, container)
    }


    //此处可抽离，额外供给Fragment使用
    function mountChildren(children, element, parent) {
        children.forEach((child) => {
            patch(child, element, parent)
        })
    }




    //处理组件元素开始
    function processComponent(vnode, container, parent) {
        mountComponent(vnode, container, parent)
    }

    function mountComponent(vnode, container, parent) {
        const instance = createComponentInstance(vnode, parent)
        //初始化组件
        setupComponent(instance)
        //渲染组件子元素
        setupRenderEffect(instance, container)
    }

    function setupRenderEffect(instance, container) {
        //此subTree下方的第一个虚拟节点
        const subTree = instance.vnode.type.render.call(instance.proxy)

        //获取到children后patch，这是每个组件必过之地，且也是与children交互之地，传递自己父组件
        patch(subTree, container, instance)
        //将$el挂载在实例对象上
        instance.$el = subTree.$el
    }
    return {
        render,
        //此处正好需要导出一个creatApp,采用高阶函数
        createApp: createAppWrapper(render)
    }

}

