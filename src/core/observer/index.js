/* @flow */

import Dep from "./dep";
import VNode from "../vdom/vnode";
import { arrayMethods } from "./array";
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from "../util/index";

const arrayKeys = Object.getOwnPropertyNames(arrayMethods);

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 * *在某些情况下，我们可能希望禁用组件内部的观察 更新计算。
 */
export let shouldObserve: boolean = true;

/**
 *
 * @param {*} value
 *
 * shouldObserve 开关
 */
export function toggleObserving(value: boolean) {
  shouldObserve = value;
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 *
 * Observer类附加到每个观察到的
 *对象。 一旦附加，观察者就会转换目标
 *对象的属性键进入getter / setter
 *收集依赖关系并发送更新。
 *
 *
 */
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that have this object as root $data

  constructor(value: any) {
    //在实例化Observer的时候将会传入一个值，这个值只能是对象
    this.value = value; //赋值当前对象到自身
    this.dep = new Dep(); //保存了一个新创建的 Dep 实例对象，这是一个当前收集依赖的收集器
    this.vmCount = 0; //实例化时默认添加的数据，并赋值为0
    def(value, "__ob__", this); //使用代理设置__ob__为不能枚举
    if (Array.isArray(value)) {
      //数组值
      if (hasProto) {  //判断当前是支持__proto__属性,ie11以下不支持
        protoAugment(value, arrayMethods);    //支持__proto__ 执行此方法
      } else {
        copyAugment(value, arrayMethods, arrayKeys);  //通过代理代理所有方法
      }
      this.observeArray(value);
    } else {
      //对象值
      this.walk(value);
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
      *浏览所有属性并将其转换为
    * getter / setters。 只应在调用时调用此方法
    *值类型是Object。

   */
  walk(obj: Object) {
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i]);
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray(items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {  //循环调用 observe 观测数据
      observe(items[i]);
    }
  }

}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment(target, src: Object) {
  /* eslint-disable no-proto */
  target.__proto__ = src;  //把当前对象的构造器对象指向新的拦截对象上
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
//兼容ie11以下的写法 获取所有数组的方法名，及数组方法，通过循环所有的方法名，代理所有的方法在当前对象下并把值指向所对应的原型方法上 over

/* istanbul ignore next */
function copyAugment(target: Object, src: Object, keys: Array<string>) {    
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i];
    def(target, key, src[key]);
  }
}

/**
 * 
 *尝试为值创建观察者实例，
 *如果成功观察，则返回新观察者，
 *或现有观察者，如果价值已经有一个。

 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 * 
 * 当前接受两次参数，一个为当前需要监听的值，一个是 是否需要深度监听 最终返回Observer 可能是空
 * 
 */
export function observe(value: any, asRootData: ?boolean): Observer | void {
  if (!isObject(value) || value instanceof VNode) {
    //如果当前需要监听的值不是一个对象，或者不是派生自VNode
    return; //直接返回，不做任何处理
  }
  let ob: Observer | void; //定义当前Observer类
  if (hasOwn(value, "__ob__") && value.__ob__ instanceof Observer) {
    //如果当前值已经被监听过了，直接放回当前属性值
    ob = value.__ob__;
  } else if (
    shouldObserve && //  当前是否开启数据监听，默认true
    !isServerRendering() && //当前是否为服务端渲染
    (Array.isArray(value) || isPlainObject(value)) && //只有当数据值是数组或纯对象的时候
    Object.isExtensible(value) && //当前对象是否可以扩展的    使得一个对象变得不可扩展：Object.preventExtensions()、Object.freeze() 以及 Object.seal()
    !value._isVue //当前值不是Vue 对象
  ) {
    ob = new Observer(value); //创建一个新的Observer
  }
  if (asRootData && ob) {
    ob.vmCount++;
  }
  return ob;
}

/**
 * Define a reactive property on an Object.
 * 将数据对象的数据属性转换为访问器属性
 */
export function defineReactive(
  obj: Object,  //当前需要代理的对象
  key: string,  //当前需要代理的对象的key
  val: any,     //对应代理对象的value
  customSetter?: ?Function,
  shallow?: boolean     //是否需要深度监测数据
) {
  const dep = new Dep();    //又是一个存储依赖的存储器

  const property = Object.getOwnPropertyDescriptor(obj, key); //获取当前对象上的属性值得配置
  if (property && property.configurable === false) {    //如果当前的属性值获取出来不为空，并且他的可配置项为false
    return; //直接返回，不多说咋们啥也做不了
  }

  // cater for pre-defined getter/setters
  //缓存当前对象的get,set，确保之前对象的正常读写
  const getter = property && property.get;  
  const setter = property && property.set;
  // https://github.com/vuejs/vue/pull/7302
  if ((!getter || setter) && arguments.length === 2) {  //确保值传了两个值得情况下
    val = obj[key];   //我们程序自己去取val值
  }

  let childOb = !shallow && observe(val);
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter() {      //简单总结一下当前getter拦截器主要做的就是返回值及收集依赖
      const value = getter ? getter.call(obj) : val;      //如果有原始的getter 我么执行原始getter取值，否则直接使用当前val
      if (Dep.target) {   //如果当前依赖存在，及当前观察者
        dep.depend();   //需要把观察者添加进容器中
        if (childOb) {    //当前子对象是否存在
          childOb.dep.depend();   //如果存在也需要添加进去依赖
          if (Array.isArray(value)) {     //判断当前这个值是不是数组，循环递归添加进去依赖
            dependArray(value);
          }
        }
      }
      return value;     //最终单纯的返回一个需要读取的值
    },
    set: function reactiveSetter(newVal) {  
      const value = getter ? getter.call(obj) : val;    //首先获取当前需要赋值的原始值
      /* eslint-disable no-self-compare */
      if (newVal === value || (newVal !== newVal && value !== value)) {   //判断当前新值和原始值是否相同的情况下什么不做，直接return (newVal !== newVal && value !== value)主要作用是判断当前值是否为NaN
        return; //直接返回，啥事都不做
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== "production" && customSetter) {    //当前函数在开发环境下，并且自定义方法存在的情况下
        customSetter();       //则执行自定义方法
      }
      // #7981: for accessor properties without setter
      if (getter && !setter) return;   //如果当前getter有设置，但是setter未设置，则直接返回
      if (setter) {     //如果当前setter已经设置了，那我们需要用他原本的拦截方法执行，确保值是正常设置的
        setter.call(obj, newVal); 
      } else {
        val = newVal;   //没有使用拦截贼直接使用当前赋值即可
      }
      childOb = !shallow && observe(newVal);  //为了确保当前设置进来的值是否为数组及对象，那么我们需要重新观测它
      dep.notify();   //最后执行观察者 over
    }
  });
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set(target: Array<any> | Object, key: any, val: any): any {
  if (
    process.env.NODE_ENV !== "production" &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(
      `Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`
    );
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key);
    target.splice(key, 1, val);
    return val;
  }
  if (key in target && !(key in Object.prototype)) {
    target[key] = val;
    return val;
  }
  const ob = (target: any).__ob__;
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== "production" &&
      warn(
        "Avoid adding reactive properties to a Vue instance or its root $data " +
          "at runtime - declare it upfront in the data option."
      );
    return val;
  }
  if (!ob) {
    target[key] = val;
    return val;
  }
  defineReactive(ob.value, key, val);
  ob.dep.notify();
  return val;
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del(target: Array<any> | Object, key: any) {
  if (
    process.env.NODE_ENV !== "production" &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(
      `Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`
    );
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1);
    return;
  }
  const ob = (target: any).__ob__;
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== "production" &&
      warn(
        "Avoid deleting properties on a Vue instance or its root $data " +
          "- just set it to null."
      );
    return;
  }
  if (!hasOwn(target, key)) {
    return;
  }
  delete target[key];
  if (!ob) {
    return;
  }
  ob.dep.notify();
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 * *触摸数组时收集数组元素的依赖关系，因为我们不能像属性getter一样拦截数组元素访问。
 */
function dependArray(value: Array<any>) {   //递归调用次方法收集所有观察者
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i];
    e && e.__ob__ && e.__ob__.dep.depend();     //当期是对象或是值得时候手动收集观察者
    if (Array.isArray(e)) {   //如果当前这个数据还是数组则继续递归
      dependArray(e);
    }
  }
}
