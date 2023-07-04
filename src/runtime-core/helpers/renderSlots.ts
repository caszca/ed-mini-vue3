import { Fragment, createVNode } from "../vnode";

//文件作用对传进来的slots进行创建vnode处理
export function renderSlots(slots, name, data) {
    //1.普通插槽
    //createVNode("div", {}, slots)

    //2.具名插槽,与init时转为value为数组遥相呼应
    /* const slot = slots[name]
    if (slot) {
            return createVNode("div", {}, slot)
    } */

    //3.作用域插槽
    const slot = slots[name]
    if (slot) {
        if (typeof slot == "function") {
            return createVNode(Fragment, {}, slot(data))
        }
    }
}