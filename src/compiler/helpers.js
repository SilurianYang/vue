/* @flow */

import { emptyObject } from 'shared/util'
import { parseFilters } from './parser/filter-parser'

type Range = { start?: number, end?: number };

/* eslint-disable no-unused-vars */
export function baseWarn (msg: string, range?: Range) {
  console.error(`[Vue compiler]: ${msg}`)
}
/* eslint-enable no-unused-vars */

/**
 * 提取指定一级对象中的key  value 到新的对象中
 * @param {*} modules   当前一级对象
 * @param {*} key   需要提取的指定key
 */
export function pluckModuleFunction<F: Function> (
  modules: ?Array<Object>,
  key: string
): Array<F> {
  return modules
    ? modules.map(m => m[key]).filter(_ => _)
    : []
}
/**
 * 在当前描述对象上添加props描述信息并设置plain等于false
 * @param {*} el  //当前描述对象
 * @param {*} name    //当前格式化完成得属性名
 * @param {*} value   //当前格式化完成后的属性值
 * @param {*} range   //完整的当前描述对象
 * @param {*} dynamic //当前是否使用了[xxxx]的动态写法形式
 */
export function addProp (el: ASTElement, name: string, value: string, range?: Range, dynamic?: boolean) {
  (el.props || (el.props = [])).push(rangeSetItem({ name, value, dynamic }, range))
  el.plain = false
}

export function addAttr (el: ASTElement, name: string, value: any, range?: Range, dynamic?: boolean) {
  const attrs = dynamic
    ? (el.dynamicAttrs || (el.dynamicAttrs = []))
    : (el.attrs || (el.attrs = []))
  attrs.push(rangeSetItem({ name, value, dynamic }, range))
  el.plain = false
}

// add a raw attr (use this in preTransforms)
export function addRawAttr (el: ASTElement, name: string, value: any, range?: Range) {
  el.attrsMap[name] = value
  el.attrsList.push(rangeSetItem({ name, value }, range))
}

export function addDirective (
  el: ASTElement,
  name: string,
  rawName: string,
  value: string,
  arg: ?string,
  isDynamicArg: boolean,
  modifiers: ?ASTModifiers,
  range?: Range
) {   //简单粗暴 在当前实例下添加一个directives属性  并添加进去到directives中
  (el.directives || (el.directives = [])).push(rangeSetItem({
    name,
    rawName,
    value,
    arg,
    isDynamicArg,
    modifiers
  }, range))
  el.plain = false    //并编辑为你已经不是一个纯函数
}

function prependModifierMarker (symbol: string, name: string, dynamic?: boolean): string {
  return dynamic    //如果当前是动态事件 
    ? `_p(${name},"${symbol}")` //则返回一个函数形式的字符串
    : symbol + name // mark the event as captured   将事件标记为已捕获  否则就返回当前属性名
}
/**
 * 
 * @param {*} el  //当前描述对象
 * @param {*} name  //当前属性名
 * @param {*} value     //当前属性值 可能是函数
 * @param {*} modifiers   //当前修饰符
 * @param {*} important   //是否在事件队列框的前面追加，否则在末尾追加
 * @param {*} warn  //一个警告提示的函数
 * @param {*} range   //当前操作的原始对象数据
 * @param {*} dynamic   //是否使用了动态事件的写法
 */
export function addHandler (
  el: ASTElement,
  name: string,
  value: string,
  modifiers: ?ASTModifiers,
  important?: boolean,
  warn?: ?Function,
  range?: Range,
  dynamic?: boolean
) {
  modifiers = modifiers || emptyObject    //如果当前用户没有写描述对象则使用一个空对象代替
  // warn prevent and passive modifier
  /* istanbul ignore if */
  if (
    process.env.NODE_ENV !== 'production' && warn &&
    modifiers.prevent && modifiers.passive    //如果当前修饰符有使用prevent及passive 并且 warn是存在的情况下  则抛出一个异常
  ) {
    warn(   //你不能同时使用 passive及prevent 修饰符
      'passive and prevent can\'t be used together. ' +
      'Passive handler can\'t prevent default event.',
      range
    )
  }

  // normalize click.right and click.middle since they don't actually fire
  // this is technically browser-specific, but at least for now browsers are
  // the only target envs that have right/middle clicks.
  /**
   * 规范化click.right并click.middle，因为它们实际上并没有触发
      这在技术上是浏览器特定的，但至少目前浏览器是
      具有右/中间点击的唯一目标环境。
   */
  if (modifiers.right) {  //如果有开发者自定义了鼠标右键修饰符
    if (dynamic) {    //并且是动态事件写法的情况下
      name = `(${name})==='click'?'contextmenu':(${name})`  //一个字符串的三目运算符
    } else if (name === 'click') {    //如果当前事件为点击事件
      name = 'contextmenu'  //及事件为浏览器contextmenu事件
      delete modifiers.right  //删除原始的right修饰符
    }
  } else if (modifiers.middle) {  //如果当前使用了修饰符鼠标中键
    if (dynamic) {  //并且当前是动态事件写法
      name = `(${name})==='click'?'mouseup':(${name})`  //又是一个字符串三目运算符
    } else if (name === 'click') {  //只是一个单纯的点击事件
      name = 'mouseup'    //那么事件为mouseup
    }
  }

  // check capture modifier
  if (modifiers.capture) {    //如果有使用capture修饰符
    delete modifiers.capture  //删除修饰符
    name = prependModifierMarker('!', name, dynamic)
  }
  if (modifiers.once) {
    delete modifiers.once
    name = prependModifierMarker('~', name, dynamic)
  }
  /* istanbul ignore if */
  if (modifiers.passive) {
    delete modifiers.passive
    name = prependModifierMarker('&', name, dynamic)
  }

  let events
  if (modifiers.native) {   //如果当前有监听修饰符native 则
    delete modifiers.native //删除此修饰符
    events = el.nativeEvents || (el.nativeEvents = {})    //并添加新的属性在当前描述对象上
  } else {
    events = el.events || (el.events = {})    //当前events也添加到当前描述对象上
  }

  const newHandler: any = rangeSetItem({ value: value.trim(), dynamic }, range)   //获取一个全新的对象
  if (modifiers !== emptyObject) {    //如果在使用修饰符的情况下
    newHandler.modifiers = modifiers    //在当前的newHandler上添加一个属性为modifiers 并赋值所有的描述符
  }

  const handlers = events[name] //缓存一个描述信息修饰符对象
  /* istanbul ignore if */
  if (Array.isArray(handlers)) {    //如果当前这个描述信息是一个数组，表示当前对象上已经存在的事件 
    important ? handlers.unshift(newHandler) : handlers.push(newHandler)    //那么就进行添加即可
  } else if (handlers) {    //如果不是数组 说明还不是多个 那么用一个数组框进行包含即可
    events[name] = important ? [newHandler, handlers] : [handlers, newHandler]
  } else {  //既不是数组又不是对象 就是啥都没有的情况下 那么直接赋值即可
    events[name] = newHandler
  }

  el.plain = false    //并标记当前节点不是一个纯的描述对象
}

export function getRawBindingAttr (
  el: ASTElement,
  name: string
) {
  return el.rawAttrsMap[':' + name] ||
    el.rawAttrsMap['v-bind:' + name] ||
    el.rawAttrsMap[name]
}

export function getBindingAttr (
  el: ASTElement,
  name: string,
  getStatic?: boolean
): ?string {
  const dynamicValue =
    getAndRemoveAttr(el, ':' + name) ||   //获取一个开发者动态绑定的属性值
    getAndRemoveAttr(el, 'v-bind:' + name)
  if (dynamicValue != null) {   //如果当前这个值存在
    return parseFilters(dynamicValue) //格式化动态绑定的属性值 包括逻辑计算符号
  } else if (getStatic !== false) {   //如果当前getStatic 存在并且不等于false
    const staticValue = getAndRemoveAttr(el, name)    //获取指定静态属性值
    if (staticValue != null) {
      return JSON.stringify(staticValue)    //返回格式化后的纯字符串
    }
  }
}

// note: this only removes the attr from the Array (attrsList) so that it
// doesn't get processed by processAttrs.
// By default it does NOT remove it from the map (attrsMap) because the map is
// needed during codegen.
/**
 * 注意：这只会从数组（attrsList）中删除attr以便它
  不会被processAttrs处理。
  默认情况下，它不会从地图中删除它（attrsMap），因为地图是
  在codegen期间需要。
 * @param {*} el 
 * @param {*} name 
 * @param {*} removeFromMap 
 */
export function getAndRemoveAttr (
  el: ASTElement,
  name: string,
  removeFromMap?: boolean
): ?string {
  let val
  if ((val = el.attrsMap[name]) != null) {    //如果当前属性在attrsMap中不存在？
    const list = el.attrsList
    for (let i = 0, l = list.length; i < l; i++) {  //则便利attrsList中的数据 查看指定的key是否包含在当前数组下  
      if (list[i].name === name) {    //包含则删除他  然后停止
        list.splice(i, 1)
        break
      }
    }
  }
  if (removeFromMap) {    //如果当前确定删除attrsMap中的数据  同时也删除attrsMap
    delete el.attrsMap[name]
  }
  return val  //最后返回attrsMap中指定的key对应的值  可能是undfined
}

export function getAndRemoveAttrByRegex (
  el: ASTElement,
  name: RegExp
) {
  const list = el.attrsList
  for (let i = 0, l = list.length; i < l; i++) {
    const attr = list[i]
    if (name.test(attr.name)) {
      list.splice(i, 1)
      return attr
    }
  }
}

function rangeSetItem (
  item: any,
  range?: { start?: number, end?: number }
) {
  if (range) {
    if (range.start != null) {
      item.start = range.start
    }
    if (range.end != null) {
      item.end = range.end
    }
  }
  return item
}
