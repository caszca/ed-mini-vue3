import { h, provide } from "../../lib/guide-mini-vue.esm.js"
import Foo from "./Foo.js"
import middle from "./middle.js"
window.self = null
//组件props里的函数目前都是驼峰命名法
export default {
    setup(props) {
        provide("message", "provide")
    },
    render() {
        const mid = h(middle, {})
        return h("div", {}, [mid])
    }
}

//注意渲染的