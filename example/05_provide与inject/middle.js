import { h, provide, inject } from "../../lib/guide-mini-vue.esm.js"
import Foo from "./Foo.js"
export default {
    setup() {
        provide("message", "middle")
        const mes = inject("message")
        return {
            mes
        }
    },
    render() {
        const middle = h(Foo, {})
        return h("div", {}, [h("div", {}, "中间" + this.mes), middle])
    }
}