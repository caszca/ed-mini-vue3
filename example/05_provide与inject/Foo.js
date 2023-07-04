import { h, inject } from "../../lib/guide-mini-vue.esm.js"

export default {
    setup(props, { emit }) {
        const message = inject("message")
        //默认注入
        //const last = inject("last", "last")
        //默认注入函数
        const last = inject("last", () => "last")
        return {
            message,
            last
        }
    },
    render() {
        return h("div", {}, this.last + " Foo " + this.message)
    }
}