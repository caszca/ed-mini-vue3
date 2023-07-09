import { createRenderer } from "../runtime-core/render"

function createElement(type) {
    return document.createElement(type)
}

function createText(text) {
    return document.createTextNode(text)
}

function setText(node, text) {
    node.textContent = text
}

function patchProp(element, key, preVal,value) {
    //判断是否attribut是否是事件
    const onEvent = (event) => {
        return /^on[A-Z]/.test(event)
    }

    if (onEvent(key)) {
        const e = key.slice(2).toLowerCase()
        element.addEventListener(e, value)
    }
    else {
        if(preVal!=value){
            if(value==undefined||value==null)
            element.removeAttribute(key)
            else
            element.setAttribute(key, value)
        }
    }
}

function insert(el, parent) {
    parent.append(el)
}

const options = {
    patchProp, insert, createElement, createText, setText
}

const { render, createApp } = createRenderer(options)
export { render, createApp }
