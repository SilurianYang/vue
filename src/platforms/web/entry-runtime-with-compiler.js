/* @flow */

import config from 'core/config'
import { warn, cached } from 'core/util/index'
import { mark, measure } from 'core/util/perf'

import Vue from './runtime/index'
import { query } from './util/index'
import { compileToFunctions } from './compiler/index'
import { shouldDecodeNewlines, shouldDecodeNewlinesForHref } from './util/compat'

const idToTemplate = cached(id => {
  const el = query(id)
  return el && el.innerHTML
})

const mount = Vue.prototype.$mount  //缓存当前$mount 函数，加上一个解析器
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && query(el)

  /* istanbul ignore if */
  if (el === document.body || el === document.documentElement) {    //在非生产环境下判断当前挂载点是否是html和body ，因为要替换节点
    process.env.NODE_ENV !== 'production' && warn(    //不允许这么做 抛出警告
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
    )
    return this
  }

  const options = this.$options
  // resolve template/el and convert to render function
  if (!options.render) {   //如果当前用户在没写render 函数的情况下
    let template = options.template   //首先获取template
    if (template) { //判断当前template是否存在  
      if (typeof template === 'string') {
        if (template.charAt(0) === '#') { 
          template = idToTemplate(template) //获取id元素的innerHTML
          /* istanbul ignore if */
          if (process.env.NODE_ENV !== 'production' && !template) { //没有就抛出错误
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
      } else if (template.nodeType) { //当前是一个有效的节点 依旧是获取当前的innerHTML
        template = template.innerHTML 
      } else {
        if (process.env.NODE_ENV !== 'production') {    //不是一个有效的节点抛出异常
          warn('invalid template option:' + template, this)
        }
        return this
      }
    } else if (el) {    //如果以上都不存在则统一使用el来获取 outerHTML
      template = getOuterHTML(el)
    }
    /**
     *  最终OuterHTML获取完毕
     */
    if (template) {  //如果当前的template 不为空,他存在的情况下我们需要把它编译成render函数
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {    //在开发环境下如同_init 函数下的性能标记
        mark('compile')
      }
      const { render, staticRenderFns } = compileToFunctions(template, {
        outputSourceRange: process.env.NODE_ENV !== 'production',
        shouldDecodeNewlines,
        shouldDecodeNewlinesForHref,
        delimiters: options.delimiters,
        comments: options.comments
      }, this)
      options.render = render
      options.staticRenderFns = staticRenderFns

      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {    //性能标记结束
        mark('compile end')
        measure(`vue ${this._name} compile`, 'compile', 'compile end')
      }
    }
  }
  return mount.call(this, el, hydrating)
}

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
function getOuterHTML (el: Element): string {
  if (el.outerHTML) {
    return el.outerHTML
  } else {
    const container = document.createElement('div')
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}

Vue.compile = compileToFunctions

export default Vue
