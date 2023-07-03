import { h } from "../../lib/guide-mini-vue.esm.js"
window.self = null
export default {
    setup(props) {
        return {
            message: "hello,world"
        }
    },
    render() {
        window.self = this
        return h("div", { class: "red" }, [h("span", {
            class: "blue", onClick: () => {
                console.log("i am onclick")
            }
        }, "span"),
        h("h1", { class: "skyblue" }, h("div", {}, "son")), "张翼德" + this.message])
    }
}