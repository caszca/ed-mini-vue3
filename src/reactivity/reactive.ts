import {
    reactiveHandler, readonlyHandler,
    shallowReadonlyHandler
} from "./baseHandler"

export const enum REACTIVE_FLAGS {
    IS_REACTIVE = "__v_isReactive",
    IS_READONLY = "__v_isReadonly",
    IS_PROXY = "__v_isProxy"
}

export function reactive(raw) {
    return createProxyObj(raw, reactiveHandler)
}

export function readonly(raw) {
    return createProxyObj(raw, readonlyHandler)
}

export function shallowReadonly(raw) {
    return createProxyObj(raw, shallowReadonlyHandler)
}


function createProxyObj(raw, handler) {
    return new Proxy(raw, handler)
}

export function isReactive(target) {
    return !!target[REACTIVE_FLAGS.IS_REACTIVE]
}

export function isReadonly(target) {
    return !!target[REACTIVE_FLAGS.IS_READONLY]
}

export function isProxy(target) {
    return !!target[REACTIVE_FLAGS.IS_PROXY]
}