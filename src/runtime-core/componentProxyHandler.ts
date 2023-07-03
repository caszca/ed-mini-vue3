export const proxyHandler = {
    get({ instance }, key) {
        const { setupState } = instance

        if (key in setupState) {
            return setupState[key]
        }
        if (key in instance) {
            return instance[key]
        }
    }
}

//proxy代理对象，其实我也很疑惑代理的对象竟然不选择实例对象，就是拦截对实例的get请求，针对key值去
//不同地方取值