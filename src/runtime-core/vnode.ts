export const Fragment = Symbol("Fragment")
export const Text = Symbol("text")
export function createVNode(type, props?, children?) {
    const vnode = {
        type, props, children
    }
    return vnode
}

//创建字符串vnode
export function createTextVNode(text: string) {
    return createVNode(Text, {}, text)
}