/* @flow */

import { _Set as Set, isObject } from '../util/index'
import type { SimpleSet } from '../util/index'
import VNode from '../vdom/vnode'

const seenObjects = new Set()

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 * 
 * 递归遍历一个对象以唤起所有转换
   getters，使对象内的每个嵌套属性
   被收集为“深层”依赖。
 */
export function traverse (val: any) {
  _traverse(val, seenObjects)     //传入被观测的属性值和set数据结构
  seenObjects.clear()
}
/**
 * 为什么要深度便利呢？就是为了获取那个值来触发get并收集依赖
 * @param {*} val 
 * @param {*} seen 
 */
function _traverse (val: any, seen: SimpleSet) {
  let i, keys
  const isA = Array.isArray(val)
  if ((!isA && !isObject(val)) || Object.isFrozen(val) || val instanceof VNode) { //当前属性必须是对象或者是数组并且当前属性不是被冻结的和派生自vnode的
    return
  }
  if (val.__ob__) { //判断这个值是否已经被深度观测过了
    const depId = val.__ob__.dep.id   //通过id来做唯一标识符
    if (seen.has(depId)) {    //如果当前id存在了 说明当前这个数据是便利过的，不搞他
      return      //返回即可
    }
    seen.add(depId)   //没有便利过那么我们需要加入并便利
  }
  if (isA) {    //当前是数组
    i = val.length
    while (i--) _traverse(val[i], seen)   //直接取值并便利
  } else {    //对象异此
    keys = Object.keys(val)
    i = keys.length
    while (i--) _traverse(val[keys[i]], seen)
  }
}
