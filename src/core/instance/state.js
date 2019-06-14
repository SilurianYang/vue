/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import Dep, { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  defineReactive,
  toggleObserving
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute
} from '../util/index'

const sharedPropertyDefinition = {  //共享属性定义的配置信息，默认只能使用getter
  enumerable: true,   //可枚举
  configurable: true,   //可配置
  get: noop,   
  set: noop
}
/**
 * 
 * @param {*} target 
 * @param {*} sourceKey 
 * @param {*} key 
 * 简单的设置代理，可枚举，可设置，可读取
 */
export function proxy (target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

/**
 * 
 * @param {*} vm  初始化状态信息，顺序很重要，决定了在时候可以被调用
 */
export function initState (vm: Component) {
  vm._watchers = []   //声明一个默认值
  const opts = vm.$options    //引用vm.$options 一个副本
  if (opts.props) initProps(vm, opts.props)   //是否有props，执行
  if (opts.methods) initMethods(vm, opts.methods)   //执行用户写的方法
  if (opts.data) {    //执行用户写的数据
    initData(vm)
  } else {    //没写则观察一个空对象
    observe(vm._data = {}, true /* asRootData */)
  }
  if (opts.computed) initComputed(vm, opts.computed)    //执行计算属性
  if (opts.watch && opts.watch !== nativeWatch) {   //对于 watch 选项仅仅判断 opts.watch 是否存在是不够的，还要判断 opts.watch 是不是原生的 watch 对象
    initWatch(vm, opts.watch)   //传入当前watch属性，开始初始化他
  }
}
/**
 * @param {*} vm    //当前实例
 * @param {*} propsOptions  //当前已经格式化好后的props，至少包含一个type字段的对象
 */
function initProps (vm: Component, propsOptions: Object) {
  const propsData = vm.$options.propsData || {}     //当前父组件传递过来的props存储的地方，如果他为空则直接复制空对象
  const props = vm._props = {}    //声明一个常量并在实例上添加一个_props属性
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  /**
   * 缓存prop键，以便将来的道具更新可以使用Array进行迭代
     而不是动态对象键枚举。
   */
  const keys = vm.$options._propKeys = []     //声明一个常量并在实例上添加一个_propKeys属性
  const isRoot = !vm.$parent      //当前是否为根节点对象，当组件处于根节点时时没有$parent属性的
  // root instance props should be converted
  if (!isRoot) {   //当前非根节点下，我们需要关闭observe响应数据，为什么呢？因为在非根点的情况下传递的数据基本都是响应是数据的，所以没必要再次响应式
    toggleObserving(false)
  }
  for (const key in propsOptions) {   //开始便利当前至少包含一个type的对象，key即传递的名称
    keys.push(key)  //保存当前key值，引用数据类型_propKeys也生效
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {    //开发环境一顿操作猛如虎
      const hyphenatedKey = hyphenate(key)    //驼峰转连字符。例如  aaBa=> aa-ba
      if (isReservedAttribute(hyphenatedKey) ||       //检查给定字符串是否是内置的属性。 'key,ref,slot,slot-scope,is'
          config.isReservedAttr(hyphenatedKey)) {   //如果是内置的属性则抛出警告
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      defineReactive(props, key, value, () => {   //开始代理当前props，并穿入了一个自定义的方法，在当前属性对象执行setter时触发(开发环境下)
        if (!isRoot && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {    //生产环境简单除暴
      defineReactive(props, key, value)   //开始将数据对象的数据属性转换为访问器属性，即像data数据一样操作起来
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    /**
     * 静态道具已经代理了组件的原型
      在Vue.extend（）期间。 我们只需要代理定义的道具
      在这里实例化。
     */
    if (!(key in vm)) {   //如果当前key不存在当前实例当中
      proxy(vm, `_props`, key)  //将当前key代理到当前实例上
    }
  }
  toggleObserving(true)   //当前props挂载到响应式系统中，完成后解除shouldObserve开关，恢复正常
}

function initData (vm: Component) {
  let data = vm.$options.data
  data = vm._data = typeof data === 'function'      //需要判断当前data是否被修改，因为在initState() 在beforeCreate钩子之后，用户可以在beforeCreate钩子中修改data
    ? getData(data, vm)     //解析当前方法，获取真正的json数据对象
    : data || {}      //不是方法直接放回
  if (!isPlainObject(data)) {   //当前是否为纯对象，不为纯对象直接重新赋值并在非开发环境下抛出错误
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  //现在已经是一个纯对象了，需要进一步验证data
  // proxy data on instance
  const keys = Object.keys(data);     //获取当前对象所有的key值
  const props = vm.$options.props     //获取props
  const methods = vm.$options.methods     //获取用户写的methods
  let i = keys.length
  while (i--) {
    const key = keys[i]
    if (process.env.NODE_ENV !== 'production') {    //在开发环境下
      if (methods && hasOwn(methods, key)) {    //验证methods是否包涵了data相同的key值，否则警告，已经声明过啦
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    if (props && hasOwn(props, key)) {   //如果当前props中包涵了data相同的key值，不能再声明啦，需要警告
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) {      //验证当前key是否为_和$开头的声明方式
      proxy(vm, `_data`, key)       //不是的话 直接代码数据
    }
  }
  //最终得出结论： props优先级 > data优先级 > methods优先级 

  //  真正的响应式数据开始了
  // observe data
  observe(data, true /* asRootData */)
}

/**
 * 
 * @param {*} data 进过 mergeOptions返回必定是一个方法 
 * @param {*} vm 当前实例
 * 最终返回真实的json对象
 */
export function getData (data: Function, vm: Component): any {
  // #7573 disable dep collection when invoking data getters
  pushTarget()    //这么做是为了防止使用 props 数据初始化 data 数据时收集冗余的依赖
  try {
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  } finally {
    popTarget()
  }
}

const computedWatcherOptions = { lazy: true }

/**
 * 开始初始化计算属性，其实计算属性就是一个惰性的watcher
 * @param {*} vm  //当前实例对象
 * @param {*} computed    //当前用户穿过来的computed 计算属性对象
 */
function initComputed (vm: Component, computed: Object) {
  // $flow-disable-line
  const watchers = vm._computedWatchers = Object.create(null)   //生命名拓展了一个属性并赋值了他一个完全空的对象
  // computed properties are just getters during SSR
  const isSSR = isServerRendering()     //判断当前宿主是否在服务端渲染

  for (const key in computed) {   //开始解刨computed对象
    const userDef = computed[key]  //先获取到用户写的方法 
    const getter = typeof userDef === 'function' ? userDef : userDef.get    //写法有两种第一张默认直接函数形式，第二种为对象形式。直接获取get即可
    if (process.env.NODE_ENV !== 'production' && getter == null) {    //如果当前这个在开发环境下没有getter那么直接抛出错误
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }
    if (!isSSR) {   //如果当前不是服务端渲染
      // create internal watcher for the computed property.
      watchers[key] = new Watcher(    //实例化一个watcher并赋值到当前所对应的key值下即vm._computedWatchers也会获取到
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    /**
     * 组件定义的计算属性已经在。上定义
      组件原型。 我们只需要定义定义的计算属性
      在这里实例化。
     */
    if (!(key in vm)) {     //如果当前key不在当前实例下声明了
      defineComputed(vm, key, userDef)  
    } else if (process.env.NODE_ENV !== 'production') {   //声明之后的情况下，先判断下当前是否为开发环境
      if (key in vm.$data) {    //如果当前这个key在$data是存在的那么我们将抛出一个错误
        warn(`The computed property "${key}" is already defined in data.`, vm)    //$data已经声明了这个key你不能这么做了 
      } else if (vm.$options.props && key in vm.$options.props) { //同样如此，如果当前props下也声明了此key 那么也会抛出一个错误
        warn(`The computed property "${key}" is already defined as a prop.`, vm)    //同上
      }
    }
  }
}

export function defineComputed (
  target: any,    //当前实例对象
  key: string,  //所对应的key
  userDef: Object | Function //用户在写当前key下所对应的getter方法
) {
  const shouldCache = !isServerRendering(); //和上面的isSSR取值相反，这个是用来判断当前的环境下是否应该缓存，只有在非服务端的情况下才能被缓存
  if (typeof userDef === 'function') {  //如果当前是函数，说明只定义了一个getter
    sharedPropertyDefinition.get = shouldCache      //重新共享属性定义的get函数
      ? createComputedGetter(key)   //非服务端渲染需要缓存调用次方法 重_computedWatchers属性中找key对应的方法
      : createGetterInvoker(userDef)    //相反
    sharedPropertyDefinition.set = noop   //因为当前这个是函数模式，则只有getter，setter设置为空，其实我们可以不用设置
  } else {      //对象的情况下
    sharedPropertyDefinition.get = userDef.get    //如果当前对象所对应的get存在好说
      ? shouldCache && userDef.cache !== false  //是否需要开启缓存模式，并且用户手动指定的cache不能为false才能执行
        ? createComputedGetter(key)   //非服务端渲染需要缓存调用次方法 重_computedWatchers属性中找key对应的方法
        : createGetterInvoker(userDef.get)    //相反
      : noop    //空方法撸上去 完事了
    sharedPropertyDefinition.set = userDef.set || noop    //set异此
  }
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {    //这个是个友好的提示，当我们在开发环境下如果发现当前这个属性的setter不存在？
    sharedPropertyDefinition.set = function () {  //呵呵 不存在的 我们给个友好的提示，而不是没有没有提示 干巴巴的无反应
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)  //ok代理这个对象中的此值
}

/**
 * 此方法接受一个key值参数 用于缓存当前key所对应的getter方法
 * @param {*} key 
 */
function createComputedGetter (key) {
  return function computedGetter () {
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {  //如果这个watcher 才做这个一下操作
      if (watcher.dirty) {  //如果这是一个惰性的观察者
        watcher.evaluate()  //重新收集依赖
      }
      if (Dep.target) {
        watcher.depend()    //收集观察者
      }
      return watcher.value   //返回当前收集到的所有求值
    }
  }
}
/**
 *  啥都不说传入一个方法直接返回当前方法并call执行即可
 * @param {*} fn 
 */
function createGetterInvoker(fn) {
  return function computedGetter () {
    return fn.call(this, this)
  }
}
/**
 * 把当前开发者写的方法统一挂载到当前实例下
 * @param {*} vm    //当前实例下
 * @param {*} methods     //当前所有的开发者方法
 */
function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props   //缓存当前props
  for (const key in methods) {    //直接循环当前json
    if (process.env.NODE_ENV !== 'production') {    //在开发环境下给出一推的提示
      if (typeof methods[key] !== 'function') {  //如果当前这个不是一个方法 及抛出错误警告
        warn(
          `Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      if (props && hasOwn(props, key)) {    //如果props已经存在了methods的key 那么我们给出警告
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      if ((key in vm) && isReserved(key)) {   //如果当前key存在当前实例下 并且 是保留字  那不行 必须娄它 警告
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm) //挂载到当前实例下over
  }
}
/**
 * 开始初始化watch
 * @param {*} vm    当前实例
 * @param {*} watch   当前实例下的watch属性
 */
function initWatch (vm: Component, watch: Object) {
  for (const key in watch) {      //便利当前watch属性
    const handler = watch[key]    //获取到当前watch所对应的值
    if (Array.isArray(handler)) {   //先判断下当前key所对应的值是不是数组对象，如果是那我们还需要一个一个的便利创建并监听他们
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {    //如果不是那直接就这样了 不管你是方法还是对象，扔过去够给你处理的巴巴适适的
      createWatcher(vm, key, handler)
    }
  }
}
/**
 * 同样是执行watch方法观察数据，只是一个格式化参数的辅助方法
 * @param {*} vm 
 * @param {*} expOrFn 
 * @param {*} handler 
 * @param {*} options 
 */
function createWatcher (
  vm: Component,      //当前实例对象
  expOrFn: string | Function,   //需要匹配的表达式
  handler: any,   //需要执行的方法
  options?: Object    //跟多的参数及配置信息
) {
  if (isPlainObject(handler)) {   //判断当前handler是不是一个纯对象
    options = handler   //如果是纯对象的情况下直接赋值给options
    handler = handler.handler   //并重新提取出handler方法作为回调函数
  }
  if (typeof handler === 'string') {    //现在判断当前用户是不是传递的字符串，如果是字符串的情况下直接使用当前实例下的方法即可
    handler = vm[handler]   //把当前实例下的方法赋值到回调函数中
  }
  return vm.$watch(expOrFn, handler, options) //再调用原型上的$watch方法即可 over
}

export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  /**
   * 流以某种方式与直接声明的定义对象有问题
    当使用Object.defineProperty时，我们必须在程序上建立起来
    这里的对象。
   */
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }
  if (process.env.NODE_ENV !== 'production') {
    dataDef.set = function () {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  Vue.prototype.$set = set
  Vue.prototype.$delete = del

  Vue.prototype.$watch = function (  //$watch 的实现就是在watcher上封装的一层
    expOrFn: string | Function,   //当前需要匹配的表达式
    cb: any,      //条件满足时需要触发的表达式
    options?: Object    //其他的一个参数
  ): Function {
    const vm: Component = this  //当前的vm对象
    if (isPlainObject(cb)) {  //判断当前callbak是否为一个纯对象
      return createWatcher(vm, expOrFn, cb, options)  //格式化对象并执行watcher
    }
    options = options || {}   //如果callback 传入的是对象
    options.user = true  //标记当前这个方法是用户自己写的 而非系统的
    const watcher = new Watcher(vm, expOrFn, cb, options)   //创建一个实例
    if (options.immediate) {    //判断当前是否有传入一个叫做immediate的参数
      try {
        cb.call(vm, watcher.value)    //有就立马执行，但是无法获取到旧值
      } catch (error) {  //捕捉一下用户写的方法，不为过
        handleError(error, vm, `callback for immediate watcher "${watcher.expression}"`)
      }
    }
    return function unwatchFn () {    //返回一个卸载观察者的方法
      watcher.teardown()
    }
  }
}
