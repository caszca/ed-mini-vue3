
import { createVNode } from "./vnode"

//高阶函数，方便获取render
export function createAppWrapper(render) {
    return function createApp(rootComponent) {
        return {
            mount(rootContainer) {
                const VNode = createVNode(rootComponent)
                render(VNode, rootContainer)
            }
        }
    }
}
