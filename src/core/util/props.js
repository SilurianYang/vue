/* @flow */

import { warn } from './debug'
import { observe, toggleObserving, shouldObserve } from '../observer/index'
import {
  hasOwn,
  isObject,
  toRawType,
  hyphenate,
  capitalize,
  isPlainObject
} from 'shared/util'

type PropOptions = {
  type: Function | Array<Function> | null,
  default: any,
  required: ?boolean,
  validator: ?Function
};
/**
 * 验证当前key所对应的类型是否匹配
 * @param {*} key 
 * @param {*} propOptions 
 * @param {*} propsData 
 * @param {*} vm 
 */
export function validateProp (
  key: string,    //当前需要验证的key
  propOptions: Object,    //用户写的prop选项，已经格式化过后的
  propsData: Object,    //用户真实传递的props
  vm?: Component    //当前实例
): any {
  const prop = propOptions[key]     //获取当前key所对应的值现在已经是这样了{type:String}
  const absent = !hasOwn(propsData, key)    //判断当前dom节点上写的key有没有传递,希望是真
  let value = propsData[key]  //获取当前dom节点上传递的指定key 可能没穿 那么为undefined
  // boolean casting
  const booleanIndex = getTypeIndex(Boolean, prop.type)   //传递一个原始的钩子器和一个需要对于的参数 最终返回一个数字 prop.type 包含在或登录 前者返回大于-1 相反
  if (booleanIndex > -1) {  //ok 类型正确
    if (absent && !hasOwn(prop, 'default')) {  //如果当前这个key在dom节点上没穿并且所对应的json没有设置default
      value = false   //那我们简单的设置成false吧 
    } else if (value === '' || value === hyphenate(key)) {  //如果value传递的是空或登录两者匹配
      // only cast empty string / same name to boolean if
      // boolean has higher priority
      /**
       * 只将空字符串/同名转换为boolean if
         布尔值具有更高的优先级
         进入此判断的表示着当前传递的是一个string类型
       */
      const stringIndex = getTypeIndex(String, prop.type)   //获取到当前用户传递的有没有定义string 类型
      if (stringIndex < 0 || booleanIndex < stringIndex) {  //如果当前他没有定义string类型或者是说Boolean在前面String在后面
        value = true    //则设置当前值为true
      }

    }
  }
  // check default value
  if (value === undefined) {    //ok 如果当前value并没有传递
    value = getPropDefaultValue(vm, prop, key)    //那么我们需要获取当前key的默认值
    // since the default value is a fresh copy,
    // make sure to observe it.
    /**
     * 因为默认值是一个新的副本，
      一定要观察它。
     */
    const prevShouldObserve = shouldObserve   //我们缓存一个observe的开关
    toggleObserving(true)   //把当前的observe 设置为开启状态
    observe(value)    //接着把新添加上的值进行一个响应式处理
    toggleObserving(prevShouldObserve)    //再恢复之前的开关状态
  }
  if (
    process.env.NODE_ENV !== 'production' &&
    // skip validation for weex recycle-list child component props
    !(__WEEX__ && isObject(value) && ('@binding' in value))   //如果当前不是在__WEEX__运行环境中
  ) {
    assertProp(prop, key, value, vm, absent)    
  }
  return value
}

/**
 * Get the default value of a prop.
 * 获取道具的默认值
 */
function getPropDefaultValue (vm: ?Component, prop: PropOptions, key: string): any {
  // no default, return undefined
  if (!hasOwn(prop, 'default')) {   //如果当前对象没有default 的属性
    return undefined    // 那么我们直接返回一个undefined
  }
  const def = prop.default    //当前现在是有写default属性的时候,赋值到一个名为def的常量上
  // warn against non-factory defaults for Object & Array
  if (process.env.NODE_ENV !== 'production' && isObject(def)) {   //ok先判断下def是不是一个纯对象，因为在初始化默认值的时候如果是纯对象的话 我们必须使用一个工厂函数
    warn(   //是纯对象而非函数 那么我们在开发环境下抛出警告
      'Invalid default value for prop "' + key + '": ' +
      'Props with type Object/Array must use a factory function ' +
      'to return the default value.',
      vm
    )
  }
  // the raw prop value was also undefined from previous render,
  // return previous default value to avoid unnecessary watcher trigger
  /**
   * 原始道具值也是从之前的渲染中未定义的，
    返回先前的默认值以避免不必要的观察者触发
   */
  if (vm && vm.$options.propsData &&      //如果当前的实例存在 而且propsData也是存在的情况下
    vm.$options.propsData[key] === undefined &&   //在dom节点上写的prop key在实际传递时没有传递值
    vm._props[key] !== undefined    //在prop对象中指定的key是被代理到_prop上的
  ) {   //说白了，就是说组件中声明了这样一个prop但是呢？我呢在传递的值得时候并没有传递过去
    return vm._props[key] //那么我们因该怎么办呢？当然是取之前我们已经规范好的值了
  }
  // call factory function for non-Function types
  // a value is Function if its prototype is function even across different execution context
  /**
   * 
      为非函数类型调用工厂函数
      如果其原型甚至跨不同的执行上下文运行，则值为Function
   */
  return typeof def === 'function' && getType(prop.type) !== 'Function'
    ? def.call(vm)    //如果当前这个default是个函数，那么我们因该直接在当前环境下执行此方法，获取真实的值
    : def   //如果不是一个函数 那么直接使用本身即可
}

/**
 * Assert whether a prop is valid.
 * 断言道具是否有效。
 */
function assertProp (
  prop: PropOptions,    //当前格式化后的prop选项
  name: string,  // 当前需要断言的key值
  value: any,   //当前key值所对应的value
  vm: ?Component, //当前实例对象
  absent: boolean   //是否传递了此参数
) {
  if (prop.required && absent) {    //如果在prop选项下设置了required属性是必须传递的，而dom节点上并没有传递ok？  你不满足
    warn(   //来个警告提示下
      'Missing required prop: "' + name + '"',
      vm
    )
    return
  }
  if (value == null && !prop.required) {  //如果value登陆undefined或者是等于null 并且这个是非必填的 我们没必要再去验证他 直接返回即可
    return
  }
  let type = prop.type    //缓存当前的type
  let valid = !type || type === true    //设置一个默认值
  const expectedTypes = []   
  if (type) {  //如果当前type为真
    if (!Array.isArray(type)) { //先判断下当前的type是不是一个数组
      type = [type]   //不是数组的情况下 我们直接把他添加成一个数组
    }
    for (let i = 0; i < type.length && !valid; i++) {   //开始循环判断当前的value是否在指定type之内
      const assertedType = assertType(value, type[i])   //传入当前值及类型 断言当前值是否在当前类型中
      expectedTypes.push(assertedType.expectedType || '')
      valid = assertedType.valid    //如果当前断言成功即停止
    }
  }

  if (!valid) {  //如果没有断言成功，即类型不匹配 直接抛出错误
    warn(
      getInvalidTypeMessage(name, value, expectedTypes),
      vm
    )
    return
  }
  const validator = prop.validator    //断言完以上硬性要求 开始断言当前用户自定义的方法
  if (validator) {    //如果存在即调用
    if (!validator(value)) {    //如果当前返回值不为true 抛出一个错误 自定义方法警告
      warn(
        'Invalid prop: custom validator check failed for prop "' + name + '".',
        vm
      )
    }
  }
}

const simpleCheckRE = /^(String|Number|Boolean|Function|Symbol)$/
/**
 * 
 * @param {*} value  当前指定的value 
 * @param {*} type   当前需要匹配的type
 */
function assertType (value: any, type: Function): {
  valid: boolean;
  expectedType: string;
} {
  let valid
  const expectedType = getType(type)    //获取当前type的购置函数名称
  if (simpleCheckRE.test(expectedType)) { //正则验证当前type是否满足匹配  满足的情况下 我们需要进行比较当前value的类型是否满足type
    const t = typeof value        //获取当前value的类型
    valid = t === expectedType.toLowerCase()    //转小写匹配
    // for primitive wrapper objects
    if (!valid && t === 'object') {  //为啥需要判断object类型呢？ 因为有种类型叫'基本包装类型' 使用构造函数声明的 typeof 时为object
      valid = value instanceof type  //我们还需要判断下当前这个值是否派生自 type
    }
  } else if (expectedType === 'Object') {   //当是对象的时候直接判断是否为对象
    valid = isPlainObject(value)
  } else if (expectedType === 'Array') {    //直接判断是不是Array
    valid = Array.isArray(value)
  } else {  //其他用户自定义的匹配规则
    valid = value instanceof type   //直接判断即可
  }
  return {
    valid,    //是否断言成功
    expectedType  //返回断言类型
  }
}

/**
 * Use function string name to check built-in types,
 * because a simple equality check will fail when running
 * across different vms / iframes.
 * 使用函数字符串名称来检查内置类型，
  因为运行时简单的相等检查会失败
  跨越不同的vms / iframe。
 */
function getType (fn) {
  const match = fn && fn.toString().match(/^\s*function (\w+)/)
  return match ? match[1] : ''
}

function isSameType (a, b) {
  return getType(a) === getType(b)
}

/**
 *  //两者相同返回大于-1 否则返回-1
 * @param {*} type   //原生的需要对比的钩子器
 * @param {*} expectedTypes     //用户写的需要被对比的参数
 */
function getTypeIndex (type, expectedTypes): number {
  if (!Array.isArray(expectedTypes)) {  //如果当前不是数组的话
    return isSameType(expectedTypes, type) ? 0 : -1  
  }

  // 用户写的可能是这样[Boolean,Number] 那么我们需要每个独立的判断
  for (let i = 0, len = expectedTypes.length; i < len; i++) {
    if (isSameType(expectedTypes[i], type)) {   //如果当前这个满足则返回
      return i
    }
  }
  return -1   //都不满足则返回-1
}

function getInvalidTypeMessage (name, value, expectedTypes) {
  let message = `Invalid prop: type check failed for prop "${name}".` +
    ` Expected ${expectedTypes.map(capitalize).join(', ')}`
  const expectedType = expectedTypes[0]
  const receivedType = toRawType(value)
  const expectedValue = styleValue(value, expectedType)
  const receivedValue = styleValue(value, receivedType)
  // check if we need to specify expected value
  if (expectedTypes.length === 1 &&
      isExplicable(expectedType) &&
      !isBoolean(expectedType, receivedType)) {
    message += ` with value ${expectedValue}`
  }
  message += `, got ${receivedType} `
  // check if we need to specify received value
  if (isExplicable(receivedType)) {
    message += `with value ${receivedValue}.`
  }
  return message
}

function styleValue (value, type) {
  if (type === 'String') {
    return `"${value}"`
  } else if (type === 'Number') {
    return `${Number(value)}`
  } else {
    return `${value}`
  }
}

function isExplicable (value) {
  const explicitTypes = ['string', 'number', 'boolean']
  return explicitTypes.some(elem => value.toLowerCase() === elem)
}

function isBoolean (...args) {
  return args.some(elem => elem.toLowerCase() === 'boolean')
}
