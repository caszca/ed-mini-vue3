import { h } from "../../lib/guide-mini-vue.esm.js"
import Foo from "./Foo.js"
window.self = null
//组件props里的函数目前都是驼峰命名法
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
        h("h1", { class: "skyblue" }, h("div", {}, "son")), "张翼德" + this.message,
        h(Foo, {
            message: "your are Foo", onAdd(a, b) {
                console.log("i am ", a, b)
            }
        })])
    }
}