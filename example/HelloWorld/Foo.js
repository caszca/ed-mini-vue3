import { h } from "../../lib/guide-mini-vue.esm.js"

export default {
    setup(props, { emit }) {
        const btnClick = function () {
            emit("add", 1, 2)
        }
        return {
            btnClick
        }
    },
    render() {
        return h("div", {}, ["Foo" + this.message, h("button", { onClick: this.btnClick }, "click")])
    }
}