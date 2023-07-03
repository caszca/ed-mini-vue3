import { h } from "../../lib/guide-mini-vue.esm.js"

export default {
    setup(props) {

    },
    render() {
        return h("div", {}, "Foo" + this.message)
    }
}