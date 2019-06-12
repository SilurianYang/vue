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

const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
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

function initProps (vm: Component, propsOptions: Object) {
  const propsData = vm.$options.propsData || {}
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  const keys = vm.$options._propKeys = []
  const isRoot = !vm.$parent
  // root instance props should be converted
  if (!isRoot) {
    toggleObserving(false)
  }
  for (const key in propsOptions) {
    keys.push(key)
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      const hyphenatedKey = hyphenate(key)
      if (isReservedAttribute(hyphenatedKey) ||
          config.isReservedAttr(hyphenatedKey)) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      defineReactive(props, key, value, () => {
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
    } else {
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    if (!(key in vm)) {
      proxy(vm, `_props`, key)
    }
  }
  toggleObserving(true)
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

function initComputed (vm: Component, computed: Object) {
  // $flow-disable-line
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  const isSSR = isServerRendering()

  for (const key in computed) {
    const userDef = computed[key]
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    if (!isSSR) {
      // create internal watcher for the computed property.
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    if (!(key in vm)) {
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}

export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  const shouldCache = !isServerRendering()
  if (typeof userDef === 'function') {
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : createGetterInvoker(userDef)
    sharedPropertyDefinition.set = noop
  } else {
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : createGetterInvoker(userDef.get)
      : noop
    sharedPropertyDefinition.set = userDef.set || noop
  }
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

function createComputedGetter (key) {
  return function computedGetter () {
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      if (watcher.dirty) {
        watcher.evaluate()
      }
      if (Dep.target) {
        watcher.depend()
      }
      return watcher.value
    }
  }
}

function createGetterInvoker(fn) {
  return function computedGetter () {
    return fn.call(this, this)
  }
}

function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props
  for (const key in methods) {
    if (process.env.NODE_ENV !== 'production') {
      if (typeof methods[key] !== 'function') {
        warn(
          `Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      if (props && hasOwn(props, key)) {
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      if ((key in vm) && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
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
