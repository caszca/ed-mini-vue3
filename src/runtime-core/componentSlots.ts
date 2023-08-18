//绑定slots到组件实例上去，slots为vnode的children
//此关于插槽的处理，都是要将插槽的返回值变为数组形式
export function initSlots(instance) {
  const { children } = instance.vnode;
  //1.普通插槽处理
  //instance.$slots = Array.isArray(children) ? children : [children]

  //2.具名插槽，children为对象,转换其value值为数组
  /* 
    const slot = {}
    for (const key in children) {
        const value = children[key];
        slot[key] = normalizeToArray(value)
    }
    instance.$slots = slot
    */

  //3.作用域插槽
  const slot = {};
  for (const key in children) {
    const value = children[key];
    //接收到renderSlots传递的data，高阶函数，确保返回值为数组
    slot[key] = (props) => normalizeToArray(value(props));
  }
  instance.$slots = slot;
}

function normalizeToArray(slotVal) {
  return Array.isArray(slotVal) ? slotVal : [slotVal];
}
