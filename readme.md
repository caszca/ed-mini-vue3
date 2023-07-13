```tex
//注意事项： h函数的第三参数也就是vnode的children，mount时，情况如下，
只有两种情况：普通元素（h1标签等）的字符串、数组。

patch函数作为渲染的入口，有着首次挂载元素与更新元素的作用，所以注意其形参

alt+F8跳转到当前文件报错地方

```

## 插槽模块

```tex
1.插槽slots 父组件插槽内容存储在组件的children中，
我们需要在子组件中将组件的children的放置到根组件的children中，通过$slots,在render数组中

2.slots为数组时，需要转换

3.具名插槽时，children为对象，需要进行处理，让它mount时是数组，
在init时，让其this.$slots为对象，key为插槽的具名，value为其对应的slots数组，
到时候在render中调用renderSlots时，传入this.$slots与具名， 直接在this.$slots中查找具名对应的value即可，
因为init时value已经转换为数组.

4.作用域插槽 作用域插槽时，父组件需要能访问到子组件传递过来的数据，children里对象key-value，
value变为函数接收 子组件调用时传递过来的数据。 init时处理函数slots时，
因为要确保函数返回的是数组vnode，所以需要处理如下封装一个高阶函数：
slot[key] = (props) => normalizeToArray(value(props))
```

### 问题

```
此前我们的this.$slots返回值都是通过转换的，经过renderSlots处理后都是被div包裹的vnode，
我们需要去除这层div，就需要采取一种新的patch模式，采用的Fragment
```

## getCurrentInstance 模块

```
在setup中(只限于setup中)获取当前的组件实例，当前vue官网不存在这个方法，
但是从描述中——请确保provide()是在setup()中同步调用
说明其中使用到了getCurrentInstance()。
getCurrentInstance只能在setup中调用，我们可以推测其实现方法就是用全局变量在setup()前后设置为instance与null
```

## Provide 与 inject 模块

```tex
provide与inject，官网描述请确保provide()是在setup()中同步调用，说明其中使用到了getCurrentInstance()。
思考：调用函数的时候，我们应该把数据存储在哪里。

实现方法：将数据以provide为key存储在组件实例里面。

困难：inject时，我们需要去获取父祖组件实例里的provide，那么我们如何获取，在每个组件实例上添加$parent属性，
注意此处parent传递来源render->setupRenderEffect()->patch(subTree, container, instance)
获取到children后patch，这是每个组件必过之地，且也是与children交互之地，传递自己父组件。

思考：多层嵌套，最后一层如何获得第一层的provide，$parent指向的是自己parent组件，这是无法更改的。
(注意根组件$parent为null)
	 初始时我们是通过instance.$parent.provide[key]来获取，但不适用多层嵌套。

实现方法：那我们只能将子组件的provide赋值为父组件的provide来获取。

问题：上述实现后，发现当前组件的provide会覆盖父祖组件的provide相同key值的value。
实现方法：原型链，注意inject时是将$parent的provide出去，因为如果inject自己的provide出去，
会在当前组件inject到自己，而不是上层组件
```

## createRenderer()渲染器模块

```tex
vue3默认渲染到DOM平台，而如果我们想要将项目渲染到canvas平台上则需要使用自定义渲染器。
自定义渲染器作用：在DOM平台我们创建元素document.querySelector、添加元素append等API，
而如果想要渲染到其他如canvas上则可能需要其他不同与DOM平台的API，所以我们需要将项目中使用到DOM API的地方封装起来
让用户自己传入，当然vue自己可以内聚，如runtime-dom。
渲染平台的概念就是同样的app组件mount到不同的container中。

难点：因为调用createRenderer传入自定义API，所以将core/render.ts函数都包裹在createRenderer中，
导致createApp函数里用到的引入的render函数无法导出了，因为正好需要返回一个createApp，
所以就对createApp使用高阶函数，到处时传递参数render。

注意事项：现在导出的createApp不再是core/creatApp.ts里的了，而是通过渲染器函数调用后，返回的creatApp。
可以看看官网的createRender
```

## 更新元素模块

```
首先需要解决的是解包问题，setup中的ref()数据，在template中是不需要.value的。

实现方法：我们首先分析，我们调用this.count时，通过代理对象在组件实例中的setupState中查找对应的value。
		所以我们可以针对setup返回的对象数据，将其包裹在一个解包函数proxyRefs，
		其原理就是又创建一个代理对象，get时，将是ref对象的解包即可。

更新困难：我们更新了响应式对象数据时，怎样去更新vnode、视图。如何将reactive与runtime/core连接在一起。
		我们是要根据响应式对象将依赖函数收集的，当某个响应式数据发生改变的时候，去更新使用到它的视图。
		所以我们是要将更新视图的函数收集起来，通过effect，所以这个函数执行时内部需要有响应式数据才行，
		才能够收集依赖。结合以上的说法，我们的effect是要设置在调用render时。

趣味：写组件测试的时候，发现this.count++触发不了proxyRefs的set，仔细一看才发现在代理组件实例对象上就没有写set

接下来，我们要编写代码区分是首次mount还是更新视图。用组件实例一个属性表示即可，
另外因为patch的两个作用（注意事项里），我们需要传递参数时，需要传递前后两个vnode。
```

## patchProps 模块

```
更新DOM元素的attribute属性，得到prevnode与现在的vnode，preVnode中有$el，而现在的vnode中是不存在的，
所以我们只需要针对prevnode中$el进行修改就行了，注意我们是修改同一个DOM，更新多个vnode
1.旧props的foo的值改变。如果变为undefined或null就删除掉
2.旧props的foo在新的中没有。
3。新的props有旧的里没有的
```

## patchChildren 模块

```javascript
今天又仔细回顾了下，思考了下，整理一下：当我们某个单文件组件（某个组件）内的响应式数据发生改变时，
会去触发其收集的依赖函数，而这个依赖函数就会去重新调用组件的render去重新生成虚拟DOM树，之后就是根据是否
已经挂载过来处理，未挂载就挂载，已挂载就patch。

1.首先patch的是element中的array->text,{render(){return h("div",{},[h("div",{},"A")])}}——>
{render(){return h("div",{},"newChildren")}}.
注意我们是根据vnode来更新第一个DOM,而不是拿第二个虚拟DOM又去生成一遍实际DOM。
先将div下的所有子节点删除再添加一个textContent。

在移除父节点的直属子节点时，我本来想写的是直接传递父节点的el，将其直属的子节点全部删除，
但是发现自定义渲染器remove其好像不太通用。更通用的是传递一个el就将其删除。

值得一个注意的是，因为我们移除子节点时，需要传入子节点，所以提醒在每个vnode挂载后中都会赋值一个$el
来表示它们的自己的DOM节点。也许$el.childNodes可以没那么绕

2.text——>text简单

3.text->array，调用mountChildren，某个vnode的children挂载到某个DOM节点上。

4.array->array。目前想法就是创建3个指针，i、e1、e2。i用于左侧对比，e1、e2用于两个右侧对比。
对比是否指针不是要移动吗，移动的前提就是两个vnode相同，而目前的相同判断是根据vnode的type，以及
设置的props里的key值。

 注意此处有个重点思考，我们patchchildren时，如果当前vnode相同就需要去patch它的children,
 然后这里传递参数的容器的container，需要不断逐层深入，那么就需要将当前vnode的el作为container
 传入，详情见render/89行

 指针移动后，i、e1、e2停留位置，中间为乱序位置，这时我们要考虑一些情况。
 1.新的比旧的多，新的多在旧的后面
 2.新的比旧的多，新的多在旧的前面
 3.旧的比新的多，需要删除旧的前面。
 4.旧的比新的多，需要删除旧的后面。
 5.中间乱序。

```

```
针对1、2中，当我们需要将新的新的vnode插入到容器当中时,我们要明确知道这些新vnode都是未经过转化为DOM节点，
再初始化的， 例如props，挂载到vnode上$el，所以我们要通过patch()转化然后初始化这些vnode。
```



### 新的比旧的长

```
通过三指针遍历，然后判断位置，插入新vnode，我们分为新的多的节点在旧的后面以及旧的前面。
实例旧节点（A、B），新节点可以分别为（A、B、C）或（C、A、B）。这样我们在插入节点时需要根据anchor(锚点)
来决定我们插入位置，首次渲染anchor可指定为null,可见vue官网的createRenderer里的insert函数。
所以我们自定义渲染器需要从原先的直接的append改为根据anchor来insertBefore()。
插入的时候从i一直到e2的子节点需要插入
```

### 旧的比新的长

```
删除的时候从i一直到e1的子节点需要删除，不需要使用锚点，为什么新的比旧的长时需要锚点。
因为删除我们不需要知道准确位置，只需要传入子节点，让其父节点删除它即可。但是插入子节点，
我们需要判断插入的位置。所以这就是为什么。
```

