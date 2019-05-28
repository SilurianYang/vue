/* not type checking this file because flow doesn't play well with Proxy */

import config from 'core/config'
import { warn, makeMap, isNative } from '../util/index'

let initProxy

if (process.env.NODE_ENV !== 'production') {
  const allowedGlobals = makeMap(
    'Infinity,undefined,NaN,isFinite,isNaN,' +
    'parseFloat,parseInt,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent,' +
    'Math,Number,Date,Array,Object,Boolean,String,RegExp,Map,Set,JSON,Intl,' +
    'require' // for Webpack/Browserify
  )

  const warnNonPresent = (target, key) => {
    warn(
      `Property or method "${key}" is not defined on the instance but ` +
      'referenced during render. Make sure that this property is reactive, ' +
      'either in the data option, or for class-based components, by ' +
      'initializing the property. ' +
      'See: https://vuejs.org/v2/guide/reactivity.html#Declaring-Reactive-Properties.',
      target
    )
  }

  const warnReservedPrefix = (target, key) => {
    warn(
      `Property "${key}" must be accessed with "$data.${key}" because ` +
      'properties starting with "$" or "_" are not proxied in the Vue instance to ' +
      'prevent conflicts with Vue internals' +
      'See: https://vuejs.org/v2/api/#data',
      target
    )
  }

  const hasProxy =
    typeof Proxy !== 'undefined' && isNative(Proxy)     //判断当前环境是否支持es6的proxy代理

  if (hasProxy) {
    const isBuiltInModifier = makeMap('stop,prevent,self,ctrl,shift,alt,meta,exact')    //标记当前白名单
    config.keyCodes = new Proxy(config.keyCodes, {  //设置代理，防止开发人员改写白名单信息
      set (target, key, value) {
        if (isBuiltInModifier(key)) {
          warn(`Avoid overwriting built-in modifier in config.keyCodes: .${key}`)   //直接警告
          return false
        } else {
          target[key] = value   //设置到对象中
          return true
        }
      }
    })
  }

  const hasHandler = {
    has (target, key) {
      // has 常量是真实经过 in 运算符得来的结果
      const has = key in target     //当前key派生自当前对象中
      const isAllowed = allowedGlobals(key) ||    //传入一个key验证是否包含在已知内置白名单中
        (typeof key === 'string' && key.charAt(0) === '_' && !(key in target.$data))    //是下划线开头并且没包含在已知传入对象中
      if (!has && !isAllowed) {   //如果当前传入key不是派生自当前对象 并且没有在已知内置的白名单中
        if (key in target.$data) warnReservedPrefix(target, key)  //警告当前你不能使用$或_开头的。防止与Vue内部冲突
        else warnNonPresent(target, key)    //直接警告，在传入的已知对象中，没有你呀使用的key
      }
      return has || !isAllowed
    }
  }

  const getHandler = {
    get (target, key) {
      if (typeof key === 'string' && !(key in target)) {
        if (key in target.$data) warnReservedPrefix(target, key)    //key值名称不符合规范，警告处理
        else warnNonPresent(target, key)    //直接警告，在传入的已知对象中，没有你呀使用的key
      }
      return target[key]    //取当前对应的key value值
    } 
  }

  initProxy = function initProxy (vm) {
    if (hasProxy) {   //如果当前环境支持proxy
      // determine which proxy handler to use
      const options = vm.$options   //缓存当前options数据
      const handlers = options.render && options.render._withStripped   //如果是用户自己手写的render及设置了_withStripped=true
        ? getHandler  
        : hasHandler
      vm._renderProxy = new Proxy(vm, handlers)   //返回代理当前
    } else {
      vm._renderProxy = vm    //直接把自身指向过去
    }
  }
}

export { initProxy }      //开发环境返回一个方法，支持proxy 则vm._renderProxy 为一个代理，否则设置为当前实例，生产环境则只返回undefined
