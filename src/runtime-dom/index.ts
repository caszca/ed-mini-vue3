import { createRenderer } from "../runtime-core/render";

function createElement(type) {
  return document.createElement(type);
}

function createText(text) {
  return document.createTextNode(text);
}

function setText(node, text) {
  node.textContent = text;
}

function patchProp(element, key, preVal, value) {
  //判断是否attribut是否是事件
  const onEvent = (event) => {
    return /^on[A-Z]/.test(event);
  };

  if (onEvent(key)) {
    const e = key.slice(2).toLowerCase();
    element.addEventListener(e, value);
  } else {
    if (preVal != value) {
      if (value == undefined || value == null) element.removeAttribute(key);
      else element.setAttribute(key, value);
    }
  }
}

function insert(el, parent, anchor = null) {
  parent.insertBefore(el, anchor);
}

//我本来想写的是直接传递父节点的el，将其直属的子节点全部删除，但是发现其好像不太通用
//还是换成传递进来el,删除其自身。
function remove(el) {
  const parentNode = el.parentNode;
  if (parentNode) {
    parentNode.removeChild(el);
  }
}
const options = {
  patchProp,
  insert,
  createElement,
  createText,
  setText,
  remove,
};

const { render, createApp } = createRenderer(options);
export { render, createApp };

export * from "../runtime-core/index";
