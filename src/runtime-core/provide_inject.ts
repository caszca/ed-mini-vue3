import { getCurrentInstance } from "./component";

export function provide(key, value) {
    const instance: any = getCurrentInstance()
    instance.provide[key] = value
}

export function inject(key, value) {
    const instance: any = getCurrentInstance()
    //需要去父祖组件获取provide
    const { provide } = instance.$parent
    if (key in provide) {
        return instance.$parent.provide[key]
    } else {
        if (typeof value == "function")
            return value()
        else return value
    }

}