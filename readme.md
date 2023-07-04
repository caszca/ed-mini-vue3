```tex
//注意事项： h函数的第三参数也就是vnode的children，mount时，情况如下，只有两种情况：普通元素（h1标签等）的字符串、数组
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

