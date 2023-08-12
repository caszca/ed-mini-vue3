import { effect } from "../reactivity/effect";
import { is } from "../utils/index";
import { createComponentInstance, setupComponent } from "./component";
import { EMITY_PROPS } from "./componentProps";
import { createAppWrapper } from "./createApp";
import { Fragment, Text } from "./vnode";
import { queueJobs } from "./scheduler";

export function createRenderer(options) {
  const { patchProp, insert, createElement, createText, setText, remove } =
    options;

  function render(vnode, conatiner) {
    patch(null, vnode, conatiner, null, null);
  }

  function patch(preVnode, vnode, container, parent, anchor) {
    const { type, children } = vnode;
    switch (type) {
      case Fragment:
        //此时不需要处理自身，直接处理children
        processFragment(preVnode, vnode, container, parent, anchor);
        break;
      case Text:
        processText(preVnode, vnode, container);
        break;

      default:
        //此处用于区分是组件还是element
        //如果是组件还需要创建组件实例挂载数据等
        if (is(type)) {
          processComponent(preVnode, vnode, container, parent, anchor);
        } else if (typeof type == "string") {
          processElement(preVnode, vnode, container, parent, anchor);
        }
        break;
    }
  }

  //vue模板解析生成的，不需要封装成渲染器函数
  function processText(preVnode, vnode, container) {
    const { children } = vnode;
    // const node = vnode.$el = document.createTextNode(children)
    //container.append(node)
    const node = (vnode.$el = createText(children));
    insert(node, container);
  }

  //处理Fragment
  function processFragment(preVnode, vnode, container, parent, anchor) {
    mountChildren(vnode, container, parent, anchor);
  }

  //处理element元素开始
  function processElement(
    preVnode,
    vnode: any,
    container: any,
    parent,
    anchor
  ) {
    if (preVnode) {
      patchElement(preVnode, vnode, container, parent, anchor);
    } else {
      mountElement(vnode, container, parent, anchor);
    }
  }

  function patchElement(preVnode, vnode, container, parent, anchor) {
    console.log("update");
    const el = (vnode.$el = preVnode.$el);
    const preProps = preVnode.props || EMITY_PROPS;
    const props = vnode.props || EMITY_PROPS;
    patchChildren(el, preVnode, vnode, container, parent, anchor);
    patchProps(el, preProps, props);
  }

  //更新子节点
  function patchChildren(
    el: any,
    preVnode: any,
    vnode: any,
    container,
    parent,
    anchor
  ) {
    const preChild = preVnode.children;
    const child = vnode.children;
    if (typeof child == "string") {
      if (is(preChild)) {
        //array——>text
        unmountChildren(preChild);
        setText(el, child);
      } else if (preChild != child) {
        //text——>text
        setText(el, child);
      }
    } else {
      if (is(preChild)) {
        //array——>array,注意此处传递的el作为container，因为我们DOM层级是逐层递深，更换容器在此处
        patchKeyChildren(preChild, child, el, parent, anchor);
      } else {
        //text->array
        setText(el, "");
        mountChildren(vnode, el, parent, anchor);
      }
    }
  }

  //移除节点的直属子节点,注意这里是children，且每个child都是一个vnode，且每个vnode都有自己create的$el
  function unmountChildren(preChild) {
    for (const vnode of preChild) {
      remove(vnode.$el);
    }
  }

  //vue中的diff算法
  function patchKeyChildren(preChild, child, container, parent, anchor) {
    //建议此处配合example加上自己画图分析
    let i = 0;
    let e1 = preChild.length - 1,
      e2 = child.length - 1; //比较三指针
    function isSameVnodeType(n1, n2) {
      return n1.type == n2.type && n1.key == n2.key;
    }
    //左侧比较
    while (i <= e1 && i <= e2) {
      if (isSameVnodeType(preChild[i], child[i])) {
        patch(preChild[i], child[i], container, parent, anchor);
        i++;
      } else break;
    }

    //右侧比较
    while (e1 >= i && e2 >= i) {
      if (isSameVnodeType(preChild[e1], child[e2])) {
        patch(preChild[e1], child[e2], container, parent, anchor);
        e1--;
        e2--;
      } else break;
    }

    if (i > e1) {
      //老的被一次性对比完了，看新的情况了
      if (i <= e2) {
        //此时新的还有剩余的，需要添加，但是新的位置需要分为两种情况来做,
        //这里作为anchor的初始传递点之一，这里是比较开始，还有一处也许是render函数里的
        while (i <= e2) {
          const anchor = e1 < 0 ? preChild[e1 + 1].$el : null;
          patch(null, child[i], container, parent, anchor);
          i++;
        }
      }
    } else {
      //包含两种情况，新的被遍历完了或中间有乱序。
      if (i > e2) {
        //新的被遍历完了，接下来需要删除旧的节点。
        while (i <= e1) {
          remove(preChild[i].$el);
          i++;
        }
      } else {
        //中间乱序部分的处理开始
        //首先建立映射表关于新的vnode。
        let newLength = e2 - i + 1; //新节点乱序部分长度
        const newKeyMapVNode = new Map(); //新节点key映射表
        const oldIndexMapNewIndex = new Array(newLength); //新旧索引映射
        for (let i = 0; i < newLength; i++) {
          oldIndexMapNewIndex[i] = 0;
        }

        for (let start = i; start <= e2; start++) {
          const vnode = child[start];
          newKeyMapVNode.set(vnode.key, start); //value值变为索引
        }

        //遍历旧vnode，寻找需要删除和patch的
        for (let old = i; old <= e1; old++) {
          let newIndex;
          const preVnode = preChild[old];
          //旧节点有key
          if (preVnode.key != null) {
            newIndex = newKeyMapVNode.get(preVnode.key);
            //在map中找到旧节点对于的key
          } else {
            //旧节点无key，遍历新节点查找
            for (let n = i; n <= e2; n++) {
              if (isSameVnodeType(preVnode, child[n])) {
                newIndex = n;
                break;
              }
            }
          }

          //查询结束，两种情况，有或无
          if (newIndex != undefined) {
            oldIndexMapNewIndex[newIndex - i] = old + 1; //注意这里的赋值，因为后续getSequence得到为索引
            //此处patch时，是对新旧节点初始的patch，故anchor为null
            patch(preVnode, child[newIndex], container, parent, null);
          } else {
            remove(preVnode.$el);
          }
        }

        //开始处理移动和增加功能
        const increasingNewIndexSequence = getSequence(oldIndexMapNewIndex); //递增子序列，注意返回值为索引
        let j = increasingNewIndexSequence.length - 1;
        //针对新节点倒叙遍历
        for (let start = newLength - 1; start >= 0; start--) {
          const index = start + i;
          const anchor = index + 1 < child.length ? child[index + 1].$el : null; //边缘情况，最后面需要插入的后面无节点
          if (oldIndexMapNewIndex[start] == 0) {
            //代表此节点，旧节点中无，需要创建
            patch(null, child[index], container, parent, anchor);
            continue;
          }
          if (j < 0 || start != increasingNewIndexSequence[j]) {
            insert(child[index].$el, container, anchor);
          } else {
            j--;
          }
        }
      }
    }
  }

  //更新props
  function patchProps(el, preProps, props) {
    if (preProps != props) {
      for (const key in preProps) {
        const preVal = preProps[key];
        const val = props[key];
        patchProp(el, key, preVal, val);
      }
      for (const key in props) {
        const val = props[key];
        if (!(key in preProps)) patchProp(el, key, null, val);
      }
    }
  }

  function mountElement(vnode: any, container: any, parent, anchor) {
    const { type, props, children } = vnode;
    const element = createElement(type);
    //将每个自己DOM对象存储在自己vnode中
    vnode.$el = element;

    //props:{id:"red"}
    //挂载元素属性，注意props为对象
    for (const key in props) {
      const value = props[key];
      patchProp(element, key, null, value);
    }

    //处理子元素，注意只有2种情况字符串与[]
    if (typeof children == "string") {
      setText(element, children);
    } else if (children instanceof Array) {
      mountChildren(vnode, element, parent, anchor);
    }
    // container.append(element)
    insert(element, container, anchor);
  }

  //此处可抽离，额外供给Fragment使用,作用：将某个vnode的children挂载到某个DOM节点上
  function mountChildren(vnode, element, parent, anchor) {
    vnode.children.forEach((child) => {
      patch(null, child, element, parent, anchor);
    });
  }

  //处理组件元素开始
  function processComponent(preVnode, vnode, container, parent, anchor) {
    if (preVnode) {
      //更新组件
      updateComponent(preVnode, vnode);
    } else {
      mountComponent(vnode, container, parent, anchor);
    }
  }

  function mountComponent(vnode, container, parent, anchor) {
    const instance = (vnode.instance = createComponentInstance(vnode, parent));
    //初始化组件
    setupComponent(instance);
    //渲染组件子元素
    setupRenderEffect(instance, container, anchor);
  }

  //更新组件，判断传递进来的props是否改变，没有旧=就不再往下patch
  function updateComponent(preVnode, vnode) {
    const instance = (vnode.instance = preVnode.instance);
    vnode.$el = preVnode.$el;
    instance.vnode = vnode;
    if (shouComponentUpdate(preVnode, vnode)) {
      //需要更新
      const { update } = instance;
      instance.$props = vnode.props;
      update();
    }
  }

  //根据其传递进来的props判断是否需要更新，shallowEquall
  function shouComponentUpdate(preVnode, vnode) {
    const preProps = preVnode.props;
    const { props } = vnode;
    for (const key in props) {
      if (preProps[key] !== props[key]) {
        return true;
      }
    }
    return false;
  }

  function setupRenderEffect(instance, container, anchor) {
    instance.update = effect(
      () => {
        const { proxy } = instance;
        //组件第一次挂载时
        if (!instance.isMounted) {
          //此subTree下方的第一个虚拟节点
          const subTree = (instance.subTree = instance.render.call(
            proxy,
            proxy
          ));
          //获取到children后patch，这是每个组件必过之地，且也是与children交互之地，传递自己作为父组件
          patch(null, subTree, container, instance, anchor);
          //将$el挂载在实例对象上
          instance.$el = subTree.$el;
          instance.isMounted = true;
        } else {
          console.log("patch component");
          const subTree = instance.render.call(proxy, proxy);
          patch(instance.subTree, subTree, container, instance, anchor);
          instance.subTree = subTree;
        }
      },
      {
        scheduler() {
          //组件多次响应式数据多次改变时，用于缓存首次更新函数到队列中
          queueJobs(instance.update);
        },
      }
    );
  }
  return {
    render,
    //此处正好需要导出一个creatApp,采用高阶函数
    createApp: createAppWrapper(render),
  };
}

//动态规划解决最长递增子序列
function getSequence(nums) {
  let dp = new Array(nums.length);
  let ans = [];
  for (let i = 0; i < nums.length; i++) {
    dp[i] = [i];
    for (let j = 0; j < i; j++) {
      if (nums[i] > nums[j]) {
        dp[i] = dp[i].length < dp[j].length + 1 ? [...dp[j], i] : dp[i];
      }
    }
    ans = dp[i].length > ans.length ? dp[i] : ans;
  }
  return ans;
}
