/* @flow */

import { hasOwn } from 'shared/util'
import { warn, hasSymbol } from '../util/index'
import { defineReactive, toggleObserving } from '../observer/index'

/**
 * 初始化Provide主要功能是在实例上提供_provided这样一个属性 并存储了需要提供给子组件的值
 * @param {*} vm 
 */
export function initProvide (vm: Component) {
  const provide = vm.$options.provide   //获取到开发者传入的provide 
  if (provide) {    //如果开发者是在有传递的情况下 才只能取值操作
    vm._provided = typeof provide === 'function'    //可以是工厂函数也可以是对象  挂载属性并赋值操作
      ? provide.call(vm)
      : provide
  }
}

/**
 * 把inject 挂载为可操作的数据
 * @param {*} vm 
 */
export function initInjections (vm: Component) {
  const result = resolveInject(vm.$options.inject, vm)  //结果集获取到了 
  if (result) {   //如果当前结果集为真
    toggleObserving(false)    //observer 开关给我关掉  这是一个非响应式的数据
    Object.keys(result).forEach(key => {    //又是一个循环
      /* istanbul ignore else */
      if (process.env.NODE_ENV !== 'production') {  //开发环境下挂载为可读的数据 多加一个参数 自定义警告方法
        defineReactive(vm, key, result[key], () => {
          warn(
            `Avoid mutating an injected value directly since the changes will be ` +
            `overwritten whenever the provided component re-renders. ` +
            `injection being mutated: "${key}"`,
            vm
          )
        })
      } else {
        defineReactive(vm, key, result[key])    //好了挂载就完事了 
      }
    })
    toggleObserving(true)  //开启响应式开关
  }
}
/**
 *  解析inject的全部值
 * @param {*} inject  //当前需要获取的对象
 * @param {*} vm    //当前实例
 */
export function resolveInject (inject: any, vm: Component): ?Object {
  if (inject) {   //如果当前开发者在需要视同inject的情况下
    // inject is :any because flow is not smart enough to figure out cached
    //注入是：任何因为流量不够聪明，无法计算出缓存
    const result = Object.create(null)    //创建一个全新的对象
    const keys = hasSymbol    //如果当前宿主环境支持Symbol并且支持Reflect
      ? Reflect.ownKeys(inject)   //支持的话则使用Reflect.ownKeys 类似于 Object.keys(), 但不会受enumerable影响
      : Object.keys(inject) //否则只能降级处理了 

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]   //获取到当前key
      // #6574 in case the inject object is observed...
      if (key === '__ob__') continue  //如果当前是一个响应是数据对象的话 遇到此则直接跳过
      const provideKey = inject[key].from   //获取到需要引用的父组件key
      let source = vm   //获取到当前的实例对象
      while (source) {  //开始循环查找有提供provide 的父组件
        if (source._provided && hasOwn(source._provided, provideKey)) { //如果这个父组件有提供provide并且包含当前key
          result[key] = source._provided[provideKey]    //ok 那么我们把只装载起来 结束啦 达到我们的目的了 
          break
        }
        source = source.$parent   //没有达到继续寻找上一级
      }
      if (!source) {    //什么情况下会走到这里？ ok 那当然是找完顶级父组件了  因为顶级父组件没有$parent
        if ('default' in inject[key]) {   //难道这就结束了？ no 既然没找到就用默认值来定 看看有没有设置
          const provideDefault = inject[key].default    //存在默认值？ 好的 我们获取到默认值
          result[key] = typeof provideDefault === 'function'    //解析一波完事  over  今晚吃大餐
            ? provideDefault.call(vm)
            : provideDefault
        } else if (process.env.NODE_ENV !== 'production') {   //没有设置默认值也没有找到对应的key  完了 妈妈 我又被警告了
          warn(`Injection "${key}" not found`, vm)
        }
      }
    }
    return result //ok 最终返回结果
  }
}
