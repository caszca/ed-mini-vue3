```tex
//注意事项： h函数的第三参数也就是vnode的children，mount时，情况如下，只有两种情况：普通元素（h1标签等）的字符串、数组
alt+F8跳转到当前文件报错地方
```



## 插槽模块

```tex
1.插槽slots 父组件插槽内容存储在组件的children中，我们需要在子组件中将组件的children的放置到根组件的children中，通过$slots,在render数组中

2.slots为数组时，需要转换

3.具名插槽时，children为对象，需要进行处理，让它mount时是数组，在init时，让其this.$slots为对象，key为插槽的具名，value为其对应的slots数组，到时候在render中调用renderSlots时，传入this.$slots与具名， 直接在this.$slots中查找具名对应的value即可，因为init时value已经转换为数组.

4.作用域插槽 作用域插槽时，父组件需要能访问到子组件传递过来的数据，children里对象key-value，value变为函数接收 子组件调用时传递过来的数据。 init时处理函数slots时，因为要确保函数返回的是数组vnode，所以需要处理如下封装一个高阶函数： 
slot[key] = (props) => normalizeToArray(value(props))
```

### 问题

```
此前我们的this.$slots返回值都是通过转换的，经过renderSlots处理后都是被div包裹的vnode，我们需要去除这层div，就需要采取一种新的patch模式，采用的Fragment
```



## getCurrentInstance模块

```
在setup中(只限于setup中)获取当前的组件实例，当前vue官网不存在这个方法，但是从描述中——请确保provide()是在setup()中同步调用
说明其中使用到了getCurrentInstance()。
getCurrentInstance只能在setup中调用，我们可以推测其实现方法就是用全局变量在setup()前后设置为instance与null
```



## Provide与inject模块

```tex
provide与inject，官网描述请确保provide()是在setup()中同步调用，说明其中使用到了getCurrentInstance()。
思考：调用函数的时候，我们应该把数据存储在哪里。
实现方法：将数据以provide为key存储在组件实例里面。
困难：inject时，我们需要去获取父祖组件实例里的provide，那么我们如何获取，在每个组件实例上添加$parent属性，
注意此处parent传递来源render->setupRenderEffect()->patch(subTree, container, instance)
获取到children后patch，这是每个组件必过之地，且也是与children交互之地，传递自己父组件。

思考：多层嵌套，最后一层如何获得第一层的provide，$parent指向的是自己parent组件，这是无法更改的。(注意根组件$parent为null)
	 初始时我们是通过instance.$parent.provide[key]来获取，但不适用多层嵌套。
实现方法：那我们只能将子组件的provide赋值为父组件的provide来获取。

问题：上述实现后，发现当前组件的provide会覆盖父祖组件的provide相同key值的value。
实现方法：原型链，注意inject时是将$parent的provide出去，因为如果inject自己的provide出去，会在当前组件inject到自己，而不是上层组件
```

