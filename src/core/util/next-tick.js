/* @flow */
/* globals MutationObserver */

import { noop } from 'shared/util'
import { handleError } from './error'
import { isIE, isIOS, isNative } from './env'

export let isUsingMicroTask = false   //标记当前环境是执行nextTick 是微队列还是宏队列

const callbacks = []
let pending = false   //又是一个标识符，确保不是短时间内重复调用

function flushCallbacks () {
  pending = false
  const copies = callbacks.slice(0)
  callbacks.length = 0
  for (let i = 0; i < copies.length; i++) {
    copies[i]()
  }
}

// Here we have async deferring wrappers using microtasks.
// In 2.5 we used (macro) tasks (in combination with microtasks).
// However, it has subtle problems when state is changed right before repaint
// (e.g. #6813, out-in transitions).
// Also, using (macro) tasks in event handler would cause some weird behaviors
// that cannot be circumvented (e.g. #7109, #7153, #7546, #7834, #8109).
// So we now use microtasks everywhere, again.
// A major drawback of this tradeoff is that there are some scenarios
// where microtasks have too high a priority and fire in between supposedly
// sequential events (e.g. #4521, #6690, which have workarounds)
// or even between bubbling of the same event (#6566).

//这里我们使用微任务来异步延迟包装器。
//在2.5中我们使用（宏）任务（与微任务组合）。
//但是，在重新绘制之前更改状态时，它会有细微的问题
//（例如＃6813，out-in过渡）。
//此外，在事件处理程序中使用（宏）任务会导致一些奇怪的行为
//无法规避（例如＃7109，＃7153，＃7546，＃7834，＃8109）。
//所以我们现在再次使用微任务。
//这种权衡的一个主要缺点是存在一些情况
//其中微任务具有太高的优先级，并且据称之间会发生火灾
//顺序事件（例如＃4521，＃6690，有变通方法）
//甚至在同一事件的冒泡之间（＃6566）。

let timerFunc

// The nextTick behavior leverages the microtask queue, which can be accessed
// via either native Promise.then or MutationObserver.
// MutationObserver has wider support, however it is seriously bugged in
// UIWebView in iOS >= 9.3.3 when triggered in touch event handlers. It
// completely stops working after triggering a few times... so, if native
// Promise is available, we will use it:
/* istanbul ignore next, $flow-disable-line */

// nextTick行为利用可以访问的微任务队列
//通过原生Promise.then或MutationObserver。
// MutationObserver有更广泛的支持，但是它被严重漏洞了
//在触摸事件处理程序中触发时，iOS> = 9.3.3中的UIWebView。 它
//触发几次后完全停止工作......所以，如果是原生的话
//承诺可用，我们将使用它：
//istanbul忽略next，$ flow-disable-line

if (typeof Promise !== 'undefined' && isNative(Promise)) {
  const p = Promise.resolve()
  timerFunc = () => {
    p.then(flushCallbacks)
    // In problematic UIWebViews, Promise.then doesn't completely break, but
    // it can get stuck in a weird state where callbacks are pushed into the
    // microtask queue but the queue isn't being flushed, until the browser
    // needs to do some other work, e.g. handle a timer. Therefore we can
    // "force" the microtask queue to be flushed by adding an empty timer.

    //在有问题的UIWebViews中，Promise.then并没有完全破坏，但是
     //它可能会陷入一种奇怪的状态，其中回调被推入
     //微任务队列但是队列没有被刷新，直到浏览器
     //需要做一些其他工作，例如 处理一个计时器。 因此我们可以
     //通过添加空计时器“强制”刷新微任务队列。
    if (isIOS) setTimeout(noop)
  }
  isUsingMicroTask = true   //标记这是一个微队列
} else if (!isIE && typeof MutationObserver !== 'undefined' && (    //判断当前这个MutationObserver是宿主支持的对象并且不是在ie中
  isNative(MutationObserver) ||
  // PhantomJS and iOS 7.x
  MutationObserver.toString() === '[object MutationObserverConstructor]'  
)) {
  // Use MutationObserver where native Promise is not available,
  // e.g. PhantomJS, iOS7, Android 4.4
  // (#6466 MutationObserver is unreliable in IE11)

  //使用MutationObserver，其中本机Promise不可用，
  //例如 PhantomJS，iOS7，Android 4.4
  //（＃6466 MutationObserver在IE11中不可靠）

  let counter = 1
  const observer = new MutationObserver(flushCallbacks)  //当前节点变化的时候触发 flushCallbacks 方法
  const textNode = document.createTextNode(String(counter))  //创建一个文本节点 
  observer.observe(textNode, {  //设为true以监视当前节点所包含的字符数据的变化
    characterData: true
  })
  timerFunc = () => { 
    counter = (counter + 1) % 2
    textNode.data = String(counter)
  }
  isUsingMicroTask = true    //标记这是一个微队列

} else if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) {   //这是一个ie的专属 只有他才有此方法
  // Fallback to setImmediate.
  // Techinically it leverages the (macro) task queue,
  // but it is still a better choice than setTimeout.

   //回退到setImmediat e。
   //技术上它利用（宏）任务队列，
   //但它仍然是比setTimeout更好的选择。

  timerFunc = () => {       //默认就是一个宏队列 不管他了
    setImmediate(flushCallbacks)
  }
} else {  //最后的环境下 setTimeout上场 宏队列走起
  // Fallback to setTimeout.
  timerFunc = () => {
    setTimeout(flushCallbacks, 0)
  }
}
/**
 * 接受一个回调函数和一个上下文 this
 * @param {*} cb    当前回调函数
 * @param {*} ctx  上下文 this
 */
export function nextTick (cb?: Function, ctx?: Object) {
  let _resolve
  callbacks.push(() => {    //往callbacks数组中添加新的回调函数，并用一个函数来包裹传入的回调函数
    if (cb) {
      try {
        cb.call(ctx)  //执行时指上下文
      } catch (e) {
        handleError(e, ctx, 'nextTick') //用户写的难免有些异常，捕捉一下很正常
      }
    } else if (_resolve) {  //如果当前的宿主环境支持promise那么可以使用promise then调用 文档有写是2.1.0 起新增的
      _resolve(ctx)
    }
  })
  if (!pending) { //当前没有在执行环境下
    pending = true
    timerFunc() //执行当前方法 over
  }
  // $flow-disable-line
  if (!cb && typeof Promise !== 'undefined') {
    return new Promise(resolve => {
      _resolve = resolve
    })
  }
}
