import { render } from "./render"
import { createVNode } from "./vnode"

export function createApp(rootComponent) {
    return {
        mount(rootContainer) {
            const VNode = createVNode(rootComponent)
            render(VNode, rootContainer)
        }
    }
}

