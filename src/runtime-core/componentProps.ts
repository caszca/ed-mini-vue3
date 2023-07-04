import { is } from "../utils/index"
import { emit } from "./componentContext"

export function initProps(instance: any) {
    const { props } = instance.vnode
    if (is(props)) {
        instance.props = props
        //让emit函数能使用instance
        instance.emit = emit.bind({}, instance)
    }
}