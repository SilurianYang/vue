/* @flow */

import config from '../config'
import { warn } from './debug'
import { set } from '../observer/index'
import { unicodeRegExp } from './lang'
import { nativeWatch, hasSymbol } from './env'

import {
  ASSET_TYPES,
  LIFECYCLE_HOOKS
} from 'shared/constants'

import {
  extend,
  hasOwn,
  camelize,
  toRawType,
  capitalize,
  isBuiltInTag,
  isPlainObject
} from 'shared/util'

/**
 * Option overwriting strategies are functions that handle
 * how to merge a parent option value and a child option
 * value into the final value.
 */
const strats = config.optionMergeStrategies   //一个可合并选项的对象，默认是一个空对象

/**
 * Options with restrictions
 * 
 * 策略函数用于处理 当前传递是否持有vm，区分是通过new 实例传递的vm 还是extend 传递的vm
 * _init方法中 mergeOptions()  new 构造传递vm   Vue.extend 则不传递vm （创建子类，===》子组件）
 * 在开发环境下生效，生产环境为undefined
 */
if (process.env.NODE_ENV !== 'production') {
  strats.el = strats.propsData = function (parent, child, vm, key) {
    if (!vm) {
      warn(
        `option "${key}" can only be used during instance ` +
        'creation with the `new` keyword.'
      )
    }
    return defaultStrat(parent, child)
  }
}

/**
 * Helper that recursively merges two data objects together.
 * 这是一个处理data数据的终极合并方法，接收一个子组件对象和父组件对象，最后返回新的子组件数据对象。始终返回子组件数据对象
 * 递归深度的把父组件data中的数据合并到子组件的data中
 */
function mergeData (to: Object, from: ?Object): Object {
  if (!from) return to      //如果父组件中的data对象为空 则返回子组件中的数据对象，不做合并
  let key, toVal, fromVal

  const keys = hasSymbol
    ? Reflect.ownKeys(from)
    : Object.keys(from)

  for (let i = 0; i < keys.length; i++) {
    key = keys[i]
    // in case the object is already observed...
    if (key === '__ob__') continue
    toVal = to[key]
    fromVal = from[key]
    if (!hasOwn(to, key)) {   //子组件数据对象中是否包含父组件数据对象中的数据，没有则使用set函数进行设置相应的值
      set(to, key, fromVal)   //observer.js 下
    } else if (         
      toVal !== fromVal &&        
      isPlainObject(toVal) &&
      isPlainObject(fromVal)
    ) {     //如果包含了，那我们需要验证下这个是否为纯对象，进行一个递归合并
      mergeData(toVal, fromVal)
    }
  }
  return to   //最后返回子数据数据对象
}

/**
 * Data
 * 
 * 验证当前是子组件还是父组件，并返回一个函数数据对象 返回一个函数 函数体内依次返回 mergeData函数处理完后的数据对象
 *  
 */
export function mergeDataOrFn (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  if (!vm) {    //在子组件的情况下
    // in a Vue.extend merge, both should be functions
    if (!childVal) {    
      return parentVal  //父组件函数对象
    }
    if (!parentVal) {
      return childVal //子组件函数对象
    }
    // when parentVal & childVal are both present,
    // we need to return a function that returns the
    // merged result of both functions... no need to
    // check if parentVal is a function here because
    // it has to be a function to pass previous merges.
    return function mergedDataFn () {
      return mergeData(
        typeof childVal === 'function' ? childVal.call(this, this) : childVal,
        typeof parentVal === 'function' ? parentVal.call(this, this) : parentVal
      )
    }
  } else {
    return function mergedInstanceDataFn () {
      // instance merge
      const instanceData = typeof childVal === 'function'
        ? childVal.call(vm, vm)
        : childVal
      const defaultData = typeof parentVal === 'function'
        ? parentVal.call(vm, vm)
        : parentVal
      if (instanceData) {
        return mergeData(instanceData, defaultData)
      } else {
        return defaultData
      }
    }
  }
}
/**
 * 在strats 策略对象上添加 data 策略函数，用来合并处理 data 选项
 * 
 * 一个函数最终执行后都返回的是mergeData()处理过后的子组件数据对象
 */
strats.data = function (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  if (!vm) {  //没有实例化传递的vm都是 子组件形式
    if (childVal && typeof childVal !== 'function') {   //子组件开发过程中必须传递是函数形式
      process.env.NODE_ENV !== 'production' && warn(    //非生产环境 提示异常
        'The "data" option should be a function ' +
        'that returns a per-instance value in component ' +
        'definitions.',
        vm
      )

      return parentVal    //抛出警告并返回父组件的值
    }
    return mergeDataOrFn(parentVal, childVal) //无论如何都调用data合并数据对象
  }

  return mergeDataOrFn(parentVal, childVal, vm)   //无非多了一个示例传入，区分父组件而已
}

/**
 * Hooks and props are merged as arrays.
 * 这是一个生命钩子的合并对象
 * 
 */
function mergeHook (
  parentVal: ?Array<Function>,
  childVal: ?Function | ?Array<Function>
): ?Array<Function> {
  const res = childVal    //是否有 childVal，即判断组件的选项中是否有对应名字的生命周期钩子函数
    ? parentVal     //如果有 childVal 则判断是否有 parentVal
      ? parentVal.concat(childVal)    //如果有 parentVal 则使用 concat 方法将二者合并为一个数组
      : Array.isArray(childVal)   //如果没有 parentVal 则判断 childVal 是不是一个数组
        ? childVal  //如果 childVal 是一个数组则直接返回
        : [childVal]  //否则将其作为数组的元素，然后返回数组
    : parentVal     // 如果没有 childVal 则直接返回 parentVal
  return res
    ? dedupeHooks(res)
    : res
}

function dedupeHooks (hooks) {  //删除重复的生命钩子
  const res = []
  for (let i = 0; i < hooks.length; i++) {
    if (res.indexOf(hooks[i]) === -1) {
      res.push(hooks[i])
    }
  }
  return res    //返回一个新的生命钩子数据
}

LIFECYCLE_HOOKS.forEach(hook => {   //把所有的生命钩子逐个循环赋值到可合并的策略对象中
  strats[hook] = mergeHook
})

/**
 * Assets
 *
 * When a vm is present (instance creation), we need to do
 * a three-way merge between constructor options, instance
 * options and parent options.
 * 
 * 这是一个合并资源的方法，平时我们写的组件及指令及filter都视为资源合并
 * 
 */
function mergeAssets (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): Object {
  const res = Object.create(parentVal || null)    //继承与父options上的资源
  if (childVal) {
    process.env.NODE_ENV !== 'production' && assertObjectType(key, childVal, vm)
    return extend(res, childVal)    //合并传入的对象到继承于options上的新对象
  } else {    //不是一个纯对象则 直接返回自带的数据
    return res
  }
}

ASSET_TYPES.forEach(function (type) {   //把所有的资源逐个循环赋值到可合并的策略对象中
  strats[type + 's'] = mergeAssets
})

/**
 * Watchers.
 *
 * Watchers hashes should not overwrite one
 * another, so we merge them as arrays.
 * 
 * watch 在父组件中为空时 返回的是一个对象形式的函数
 * 非空及子组件都有值得情况下 返回一个合并后的数组
 * 子组件没使用的情况下返回一个空对象
 */
strats.watch = function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  //重置掉原生浏览器上watch
  // work around Firefox's Object.prototype.watch...
  if (parentVal === nativeWatch) parentVal = undefined 
  if (childVal === nativeWatch) childVal = undefined
  /* istanbul ignore if */
  if (!childVal) return Object.create(parentVal || null)    //在用户没有使用watch的情况下,直接返回一个空的对象
  if (process.env.NODE_ENV !== 'production') {    //检测watch 是否为一个纯对象
    assertObjectType(key, childVal, vm)
  }
  if (!parentVal) return childVal //现在是用户使用了watch 再判断原本是否有，没有则直接返回用户的
  const ret = {}    //两者都有的情况下
  extend(ret, parentVal)      //先处理原始对象，合并到新的ret对象下
  for (const key in childVal) { 
    //由于遍历的是 childVal，所以 key 是子选项的 key，父选项中未必能获取到值，所以 parent 未必有值
    let parent = ret[key]
    // child 是肯定有值的，因为遍历的就是 childVal 本身
    const child = childVal[key]
    // 这个 if 分支的作用就是如果 parent 存在，就将其转为数组
    if (parent && !Array.isArray(parent)) {
      parent = [parent]
    }
     // 最后，如果 parent 存在，此时的 parent 应该已经被转为数组了，所以直接将 child concat 进去
    ret[key] = parent
      ? parent.concat(child)  
      : Array.isArray(child) ? child : [child]    // 如果 parent 不存在，直接将 child 转为数组返回
  }
  return ret    // 最后返回新的 ret 对象
}

/**
 * Other object hashes.
 * 合并对象写法，返回新的对象 子组件上的相同属性将覆盖父组件上的同名选项字段，最终放回一个新的对象
 */
strats.props =
strats.methods =
strats.inject =
strats.computed = function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  if (childVal && process.env.NODE_ENV !== 'production') {    //非生产环境监测用户传入的是否为一个纯对象
    assertObjectType(key, childVal, vm) //仅是抛出异常处理
  }
  if (!parentVal) return childVal //父组件没有不用合并
  const ret = Object.create(null)   //创建一个正常的空对象
  extend(ret, parentVal)    //合并父组件上的
  if (childVal) extend(ret, childVal)   //合并子组件上的
  return ret    //返回全新的的合并完后的对象
}
strats.provide = mergeDataOrFn    //合并策略使用与 data 选项相同的 mergeDataOrFn 函数

/**
 * Default strategy.
 * 只要子选项不是 undefined 就使用子选项，否则使用父选项
 */
const defaultStrat = function (parentVal: any, childVal: any): any {
  return childVal === undefined
    ? parentVal
    : childVal
}

/**
 * Validate component names
 */
function checkComponents (options: Object) {  //循环遍历参数组件，传递给validateComponentName 函数验证名称是否有效
  for (const key in options.components) { 
    validateComponentName(key)
  }
}

export function validateComponentName (name: string) {
  if (!new RegExp(`^[a-zA-Z][\\-\\.0-9_${unicodeRegExp.source}]*$`).test(name)) {   ///^[a-zA-Z][\w-]*$/
    warn(
      'Invalid component name: "' + name + '". Component names ' +
      'should conform to valid custom element name in html5 specification.'
    )
  }
  if (isBuiltInTag(name) || config.isReservedTag(name)) {
    warn(
      'Do not use built-in or reserved HTML elements as component ' +
      'id: ' + name
    )
  }
}

/**
 * Ensure all props option syntax are normalized into the
 * Object-based format.
 * 
 * 示例穿入 props: ["someData"]
 * 转换为 {"someData":{"type":null}}
 * 
 * 示例穿入 props: { someData1: Number,someData2: { type: String, default: ''}}
 * 转换为  {someData1: { type: Number}, someData2: {type: String,default: ''}}
 * 
 */
function normalizeProps (options: Object, vm: ?Component) {
  const props = options.props
  if (!props) return
  const res = {}
  let i, val, name
  if (Array.isArray(props)) {
    i = props.length
    while (i--) {
      val = props[i]
      if (typeof val === 'string') {      //必须严格是字符串
        name = camelize(val)  //连字符转驼峰函数
        res[name] = { type: null }
      } else if (process.env.NODE_ENV !== 'production') {
        warn('props must be strings when using array syntax.')
      }
    }
  } else if (isPlainObject(props)) {    //判断给定变量是否是纯对象  isPlainObject 函数
    for (const key in props) {
      val = props[key]
      name = camelize(key)    //连字符转驼峰函数
      res[name] = isPlainObject(val)
        ? val
        : { type: val }
    }
  } else if (process.env.NODE_ENV !== 'production') {
    warn(
      `Invalid value for option "props": expected an Array or an Object, ` +
      `but got ${toRawType(props)}.`,
      vm
    )
  }
  options.props = res
}

/**
 * Normalize all injections into Object-based format
 * 
 *  示例穿入 inject: ['data1', 'data2']
 *  转换为 {'data1': { from: 'data1' },'data2': { from: 'data2' }}
 * 
 * 示例穿入 inject: {  data1,d2: 'data2',data3: { someProperty: 'someValue' }}
 * 转换为  {  'data1': { from: 'data1' },'d2': { from: 'data2' },'data3': { from: 'data3', someProperty: 'someValue' }}
 * 
 */
function normalizeInject (options: Object, vm: ?Component) {
  const inject = options.inject
  if (!inject) return
  const normalized = options.inject = {}
  if (Array.isArray(inject)) {
    for (let i = 0; i < inject.length; i++) {
      normalized[inject[i]] = { from: inject[i] }
    } 
  } else if (isPlainObject(inject)) {  //判断给定变量是否是纯对象  isPlainObject 函数
    for (const key in inject) {
      const val = inject[key]
      normalized[key] = isPlainObject(val)  
        ? extend({ from: key }, val)
        : { from: val }
    }
  } else if (process.env.NODE_ENV !== 'production') {
    warn(
      `Invalid value for option "inject": expected an Array or an Object, ` +
      `but got ${toRawType(inject)}.`,
      vm
    )
  }
}

/**
 * Normalize raw function directives into object format.
 * 
 * 规范 directives 当传入格式为函数时，默认绑定所有事件bind，update，建议分开写
 * 
 */
function normalizeDirectives (options: Object) {
  const dirs = options.directives
  if (dirs) {
    for (const key in dirs) {
      const def = dirs[key]
      if (typeof def === 'function') {
        dirs[key] = { bind: def, update: def }
      }
    }
  }
}
/**
 * 
 * @param {*} name 
 * @param {*} value 
 * @param {*} vm 
 *  检测当前是否为一个纯对象，不是存对象则抛出错误
 */
function assertObjectType (name: string, value: any, vm: ?Component) {
  if (!isPlainObject(value)) {
    warn(
      `Invalid value for option "${name}": expected an Object, ` +
      `but got ${toRawType(value)}.`,
      vm
    )
  }
}

/**
 * Merge two option objects into a new one.
 * Core utility used in both instantiation and inheritance.
 * 
 * 合并两个选项对象为一个新的对象，这个函数在实例化和继承的时候都有用到，这里要注意两点
 * 第一，这个函数将会产生一个新的对象；第二，这个函数不仅仅在实例化对象(即_init方法中)的时候用到
 * 在继承(Vue.extend)中也有用到，所以这个函数应该是一个用来合并两个选项对象为一个新对象的通用程序。
 */
export function mergeOptions (
  parent: Object,
  child: Object,
  vm?: Component
): Object {
  if (process.env.NODE_ENV !== 'production') {    //开发环境下，我们需要验证组件名称是否合格
    checkComponents(child)      //包含义保留标签，svg,slot component
  }

  if (typeof child === 'function') {    //默认是个对象，如果此参数是函数则区函数中的options
    child = child.options
  }

  normalizeProps(child, vm)     //规范化 props，主要是规范数组，及对象写法，最终规范成对象写法，否则开发环境抛出警告
  normalizeInject(child, vm)    //规范化 inject，主要是规范数组，及对象写法，最终规范成对象写法，否则开发环境抛出警告
  normalizeDirectives(child)     //规范 directives, 把函数格式规范为对象格式

  // Apply extends and mixins on the child options,
  // but only if it is a raw options object that isn't
  // the result of another mergeOptions call.
  // Only merged options has the _base property.
  if (!child._base) {     //只有合并的选项具有_base属性
    if (child.extends) {    //child.extends存在则递归调用，合并options 并返回新的对象
      parent = mergeOptions(parent, child.extends, vm)
    }
    if (child.mixins) {   //混入数组存在则 递归调用
      for (let i = 0, l = child.mixins.length; i < l; i++) {    //由于 mixins不同于child.extends 是一个数组所以要遍历一下
        parent = mergeOptions(parent, child.mixins[i], vm)
      }
    }
  }

  //真正的合并开始了 
  const options = {}
  let key
  for (key in parent) {  //先把指定parent上的key值进行合并
    mergeField(key)
  }
  for (key in child) {
    if (!hasOwn(parent, key)) {   // shared/util.js 中的方法  判断当前对象中是否包含指定key值，如果child中的key在parent 中已经出现过了，则不用再重复调用了
      mergeField(key)
    }
  }
  function mergeField (key) {
    const strat = strats[key] || defaultStrat   //生产环境全走 defaultStrat
    options[key] = strat(parent[key], child[key], vm, key)
  }
  return options
}

/**
 * Resolve an asset.
 * This function is used because child instances need access
 * to assets defined in its ancestor chain.
 */
export function resolveAsset (
  options: Object,
  type: string,
  id: string,
  warnMissing?: boolean
): any {
  /* istanbul ignore if */
  if (typeof id !== 'string') {
    return
  }
  const assets = options[type]
  // check local registration variations first
  if (hasOwn(assets, id)) return assets[id]
  const camelizedId = camelize(id)
  if (hasOwn(assets, camelizedId)) return assets[camelizedId]
  const PascalCaseId = capitalize(camelizedId)
  if (hasOwn(assets, PascalCaseId)) return assets[PascalCaseId]
  // fallback to prototype chain
  const res = assets[id] || assets[camelizedId] || assets[PascalCaseId]
  if (process.env.NODE_ENV !== 'production' && warnMissing && !res) {
    warn(
      'Failed to resolve ' + type.slice(0, -1) + ': ' + id,
      options
    )
  }
  return res
}
