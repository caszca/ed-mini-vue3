export const Fragment = Symbol("Fragment");
export const Text = Symbol("text");
export function createVNode(type, props?, children?) {
  const vnode = {
    type,
    props,
    children,
    $el: null,
    key: props ? props.key : null,
    instance: null, //组件vnode拥有的组件实例，在updateComponent有用
  };
  return vnode;
}

//创建字符串vnode
export function createTextVNode(text: string) {
  return createVNode(Text, {}, text);
}
