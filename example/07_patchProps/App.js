import { h, ref } from "../../lib/guide-mini-vue.esm.js"
export default {
    setup(props) {
        const count = ref(0)
        const onClick = () => {
            count.value++
        }
        return { count, onClick }
    },
    render() {
        const count = h("div", {}, "count:" + this.count)
        const button = h("button", { onClick: () => this.onClick() }, "点击++")
        return h("div", {}, [count, button])
    },
}