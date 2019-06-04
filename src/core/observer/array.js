/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

const arrayProto = Array.prototype    //获取当前数组的所有原型方法
export const arrayMethods = Object.create(arrayProto)   //根据原型创建新的对象，然后再导出

const methodsToPatch = [    //列出所有的变异方法名称
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 * 
 * 循环当前变异方法名称，设置代理，并把值指向真正的原型方法上
 */
methodsToPatch.forEach(function (method) {  
  // cache original method
  const original = arrayProto[method]   //缓存当前原型上的方法
  def(arrayMethods, method, function mutator (...args) {    //代理到当前创建的新对象上
    const result = original.apply(this, args)  //执行的时候使用原型方法执行，得到真实的值
    const ob = this.__ob__      //缓存到当前Observer类
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args   //添加新值就直接获取到当前的args
        break
      case 'splice':
        inserted = args.slice(2)   //splice 方法起第三个参数为新增值
        break
    }
    if (inserted) ob.observeArray(inserted)  //如果当前是通过这几个方法改变的，那么我们需要观测当前数据
    // notify change
    ob.dep.notify()     //再广播观察者
    return result   //返回当前值
  })
})
