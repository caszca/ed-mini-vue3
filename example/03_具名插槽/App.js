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
        //插槽
        const foo = h(Foo, {}, {
            header: h("h1", {}, "header"),
            footer: h("h1", {}, "footer")
        })
        return h("div", {}, [foo])
    }
}

//注意渲染的