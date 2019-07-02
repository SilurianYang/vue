/* @flow */

import he from 'he'
import { parseHTML } from './html-parser'
import { parseText } from './text-parser'
import { parseFilters } from './filter-parser'
import { genAssignmentCode } from '../directives/model'
import { extend, cached, no, camelize, hyphenate } from 'shared/util'
import { isIE, isEdge, isServerRendering } from 'core/util/env'

import {
  addProp,
  addAttr,
  baseWarn,
  addHandler,
  addDirective,
  getBindingAttr,
  getAndRemoveAttr,
  getRawBindingAttr,
  pluckModuleFunction,
  getAndRemoveAttrByRegex
} from '../helpers'

export const onRE = /^@|^v-on:/   //定义一个事件绑定的正则
export const dirRE = process.env.VBIND_PROP_SHORTHAND   //定义一个是否为指令的正则
  ? /^v-|^@|^:|^\.|^#/
  : /^v-|^@|^:|^#/
export const forAliasRE = /([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/  //定义了一个v-for的正则
export const forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/     //定义了一个v-for类型时写法的正则
const stripParensRE = /^\(|\)$/g  //定义一个以(开头的或者)结尾的正则
const dynamicArgRE = /^\[.*\]$/   //定义一个[开头，中间任意字符]结尾的正则

const argRE = /:(.*)$/    //  定义了一个事件是否传递参数的正则
export const bindRE = /^:|^\.|^v-bind:/ //定义一个是否为v-bind的正则
const propBindRE = /^\./      //定义一个已.开头的正则
const modifierRE = /\.[^.\]]+(?=[^\]]*$)/g  //获取一个指令中的修辞符

const slotRE = /^v-slot(:|$)|^#/  //定义一个slot的正则

const lineBreakRE = /[\r\n]/    //匹配一个换行符
const whitespaceRE = /\s+/g     //匹配一个空白符全局

const invalidAttributeRE = /[\s"'<>\/=]/    //匹配一个已知的符号

const decodeHTMLCached = cached(he.decode)    //给予一个缓存的decode方法

export const emptySlotScopeToken = `_empty_`

// configurable state 定义了8个不同平台的标识符
export let warn: any
let delimiters
let transforms
let preTransforms
let postTransforms
let platformIsPreTag
let platformMustUseProp
let platformGetTagNamespace
let maybeComponent

/**
 * 创建一个进本的描述对象
 * @param {*} tag   标签名称
 * @param {*} attrs   标签上所有的属性
 * @param {*} parent    当前标签的父集标签
 */
export function createASTElement (
  tag: string,
  attrs: Array<ASTAttr>,
  parent: ASTElement | void
): ASTElement {
  return {
    type: 1,
    tag,
    attrsList: attrs,
    attrsMap: makeAttrsMap(attrs),    //解析穿入的attrs，成为一个一级对象
    rawAttrsMap: {},
    parent,
    children: []
  }
}

/**
 * Convert HTML string to AST.    将HTML字符串转换为AST
 */
export function parse (
  template: string,
  options: CompilerOptions
): ASTElement | void {
  warn = options.warn || baseWarn //在有传递warn 打印方法时，取warn 否则取baseWarn

  platformIsPreTag = options.isPreTag || no //是否通过isPreTag来判断给定的标签名是否为一个<pre>标签，默认false
  platformMustUseProp = options.mustUseProp || no   //是否需要判读当前给定标签需要使用原生的prop进行绑定，默认false
  platformGetTagNamespace = options.getTagNamespace || no //获取当前标签的命名空间
  const isReservedTag = options.isReservedTag || no   //当前的标签名是否为一个保留的标签名，默认false
  maybeComponent = (el: ASTElement) => !!el.component || !isReservedTag(el.tag)

  transforms = pluckModuleFunction(options.modules, 'transformNode')    //提取指定对象中的transformNode 没有则返回[]
  preTransforms = pluckModuleFunction(options.modules, 'preTransformNode')   //提取指定对象中的preTransformNode 没有则返回[]
  postTransforms = pluckModuleFunction(options.modules, 'postTransformNode')  //提取指定对象中的postTransformNode 没有则返回[]

  delimiters = options.delimiters //当前是否传递了自定义的插入表达式

  const stack = []    //声明一个存入顶级父节点的容器
  const preserveWhitespace = options.preserveWhitespace !== false   //当前是否需要放弃标签之前的空格 默认为true
  const whitespaceOption = options.whitespace 
  let root  //继续声明一个最终tree树
  let currentParent //当前已知的循环到的tree树插入位置
  let inVPre = false  //是否在拥有 v-pre 的标签之内
  let inPre = false //是否在 <pre></pre> 标签之内
  let warned = false  //作为一个打印错误信息的开关 默认为打开

  function warnOnce (msg, range) {
    if (!warned) {
      warned = true
      warn(msg, range)
    }
  }

  function closeElement (element) {
    trimEndingWhitespace(element)
    if (!inVPre && !element.processed) {
      element = processElement(element, options)
    }
    // tree management
    if (!stack.length && element !== root) {  //如果当前需要关闭的标签不是一个根节点标签
      // allow root elements with v-if, v-else-if and v-else
      if (root.if && (element.elseif || element.else)) {  
        if (process.env.NODE_ENV !== 'production') {
          checkRootConstraints(element)
        }
        addIfCondition(root, {
          exp: element.elseif,
          block: element
        })
      } else if (process.env.NODE_ENV !== 'production') {
        warnOnce(
          `Component template should contain exactly one root element. ` +
          `If you are using v-if on multiple elements, ` +
          `use v-else-if to chain them instead.`,
          { start: element.start }
        )
      }
    }
    if (currentParent && !element.forbidden) {    //如果当前这个对象存在 并且当前的描述对象标签名称不是vue禁止的标签名
      if (element.elseif || element.else) {  //如果当然描述对象还使用了v-else-if 或者是 v-else
        processIfConditions(element, currentParent)   //在当前的描述对象下插入对应的描述对象
      } else {
        if (element.slotScope) {
          // scoped slot
          // keep it in the children list so that v-else(-if) conditions can
          // find it as the prev node.
          const name = element.slotTarget || '"default"'
          ;(currentParent.scopedSlots || (currentParent.scopedSlots = {}))[name] = element
        }
        currentParent.children.push(element)
        element.parent = currentParent
      }
    }

    // final children cleanup
    // filter out scoped slots
    element.children = element.children.filter(c => !(c: any).slotScope)
    // remove trailing whitespace node again
    trimEndingWhitespace(element)

    // check pre state
    if (element.pre) {
      inVPre = false
    }
    if (platformIsPreTag(element.tag)) {
      inPre = false
    }
    // apply post-transforms
    for (let i = 0; i < postTransforms.length; i++) {
      postTransforms[i](element, options)
    }
  }

  function trimEndingWhitespace (el) {
    // remove trailing whitespace node
    if (!inPre) {
      let lastNode
      while (
        (lastNode = el.children[el.children.length - 1]) &&
        lastNode.type === 3 &&
        lastNode.text === ' '
      ) {
        el.children.pop()
      }
    }
  }
/**
 * 验证当前跟节点的标签名称是否正确
 * @param {*} el  需要验证的el tree树
 */
  function checkRootConstraints (el) {
    if (el.tag === 'slot' || el.tag === 'template') {   //不允许slot 和 template 一个是具有插槽功能的，取决于外部标签。一个是抽象语法标签template，他是不存在的
      warnOnce(
        `Cannot use <${el.tag}> as component root element because it may ` +
        'contain multiple nodes.',
        { start: el.start }
      )
    }
    if (el.attrsMap.hasOwnProperty('v-for')) {  //跟节点上是不支持有多个节点的 所有是禁止使用v-for的
      warnOnce(
        'Cannot use v-for on stateful component root element because ' +
        'it renders multiple elements.',
        el.rawAttrsMap['v-for']
      )
    }
  }

  parseHTML(template, {
    warn,
    expectHTML: options.expectHTML,
    isUnaryTag: options.isUnaryTag,  
    canBeLeftOpenTag: options.canBeLeftOpenTag,
    shouldDecodeNewlines: options.shouldDecodeNewlines,
    shouldDecodeNewlinesForHref: options.shouldDecodeNewlinesForHref,
    shouldKeepComment: options.comments,
    outputSourceRange: options.outputSourceRange,

    /**
     * 1.start 钩子函数是当解析 html 字符串遇到开始标签时被调用的
     * 2.模板中禁止使用 <style> 标签和那些没有指定 type 属性或 type 属性值为 text/javascript 的 <script> 标签
     * 3.执行preTransforms数组中的函数，为不同的平台编译不同的代码
     * 4.通过process*系列函数加工描述对象
     * 5.判断当前标签是否满足根节点标签，根节点上不能存在使用v-for及  slot template
     * 6.可以定义多个根元素，但必须使用 v-if、v-else-if 以及 v-else 保证有且仅有一个根元素被渲染
     * 7.把当前解析到的非一元标签描述对象存在currentParent中并保留没此顶级对象到stack中
     * 8.遇到一元标签则直接关闭标签，判断当前标签是否使用了 v-else-if 或 v-else 指令，则该元素不会作为子节点，而是会被添加到相符的使用了 v-if 指令的元素描述对象的 ifConditions 数组中
     * 9.使用了 slot-scope 特性，则该元素也不会作为子节点，它会被添加到父级元素描述对象的 scopedSlots 属性中
     * 10.对于没有使用条件指令或 slot-scope 特性的元素，会正常建立父子级关系
     * @param {*} tag 
     * @param {*} attrs 
     * @param {*} unary 
     * @param {*} start 
     * @param {*} end 
     */
    start (tag, attrs, unary, start, end) {     //字符串时每次遇到 开始标签 时就会调用该函数
      // check namespace.
      // inherit parent ns if there is one
      const ns = (currentParent && currentParent.ns) || platformGetTagNamespace(tag)    //获取当前父元素的命名空间 如果当前父元素存在则直接使用父元素的

      // handle IE svg bug
      /* istanbul ignore if */
      if (isIE && ns === 'svg') {   //他说svg在ie上会出现一个bug 需要手动修复下
        attrs = guardIESVGBug(attrs)    //处理完attrs后获取到标准的值
      } 

      let element: ASTElement = createASTElement(tag, attrs, currentParent) //  通过createASTElement函数得到新的数据值
      if (ns) { //继续判断 当前的标签名称是否存在
        element.ns = ns //存在的话 我们在原有的对象上重新声明一个属性
      }

      if (process.env.NODE_ENV !== 'production') {
        if (options.outputSourceRange) {    //在开发环境下 outputSourceRange为真时
          element.start = start
          element.end = end
          element.rawAttrsMap = element.attrsList.reduce((cumulated, attr) => { //重新组装attr的数据
            cumulated[attr.name] = attr
            return cumulated
          }, {})
        }
        attrs.forEach(attr => {
          if (invalidAttributeRE.test(attr.name)) { //验证当前标签是否为已知写法的标签 存在则抛出错误
            warn(
              `Invalid dynamic argument expression: attribute names cannot contain ` +
              `spaces, quotes, <, >, / or =.`,
              {
                start: attr.start + attr.name.indexOf(`[`),
                end: attr.start + attr.name.length
              }
            )
          }
        })
      }

      if (isForbiddenTag(element) && !isServerRendering()) {  //如果当前是宿主环境是在非服务端下 并且是非被vue禁止的标签
        element.forbidden = true  //又添加了一个属性 被禁止的
        process.env.NODE_ENV !== 'production' && warn(    //并给出了警告  你不能使用这个标签哦  巴啦巴拉一大堆
          'Templates should only be responsible for mapping the state to the ' +
          'UI. Avoid placing tags with side-effects in your templates, such as ' +
          `<${tag}>` + ', as they will not be parsed.',
          { start: element.start }
        )
      }

      // apply pre-transforms
      for (let i = 0; i < preTransforms.length; i++) {  //通过不同平台提供的方法 规范并获取到新的值
        element = preTransforms[i](element, options) || element
      }

      if (!inVPre) {  //当前编译器解析的时候是处于一个非v-pre标签模式下
        processPre(element)   //判断当前是否挂载了v-pre指令
        if (element.pre) {  //有挂载？
          inVPre = true   //好的 现在是处于一个v-pre标签解析模式下
        }
      }
      if (platformIsPreTag(element.tag)) {    //查看当前标签是不是原生的pre标签  
        inPre = true    //是的情况下则挂载为true
      }
      if (inVPre) {  //如果当前是在解析v-pre的模式下
        processRawAttrs(element)    //在当前的描述对象上添加上对应的描述信息
      } else if (!element.processed) {  //当前标签是否已经被解析过了？ 解析完成后的tree每个描述对象上都有processed 
        // structural directives
        processFor(element)   //新增一个v-for的描述信息
        processIf(element)    //新增一个v-if、v-else、v-else-if描述信息
        processOnce(element)    //新增一个v-once的描述信息
      }

      if (!root) {    //第一次根节点不存在，ok
        root = element  //赋值根节点
        if (process.env.NODE_ENV !== 'production') {    //在开发环境下需要判断下当前根节点是否满足规范
          checkRootConstraints(root)  
        }
      }

      if (!unary) { //如果当前是一个非一元标签
        currentParent = element   //保留顶级对象
        stack.push(element)   //加入顶级对象到stack中
      } else {
        closeElement(element) //如果当前是一个一元标签，直接关闭
      }
    },

    end (tag, start, end) {   //每次遇到 结束标签 时就会调用该函数
      const element = stack[stack.length - 1]
      // pop stack
      stack.length -= 1
      currentParent = stack[stack.length - 1]
      if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
        element.end = end
      }
      closeElement(element)
    },

    chars (text: string, start: number, end: number) {  //每次遇到 纯文本 时就会调用该函数
      if (!currentParent) {
        if (process.env.NODE_ENV !== 'production') {
          if (text === template) {
            warnOnce(
              'Component template requires a root element, rather than just text.',
              { start }
            )
          } else if ((text = text.trim())) {
            warnOnce(
              `text "${text}" outside root element will be ignored.`,
              { start }
            )
          }
        }
        return
      }
      // IE textarea placeholder bug
      /* istanbul ignore if */
      if (isIE &&
        currentParent.tag === 'textarea' &&
        currentParent.attrsMap.placeholder === text
      ) {
        return
      }
      const children = currentParent.children
      if (inPre || text.trim()) {
        text = isTextTag(currentParent) ? text : decodeHTMLCached(text)
      } else if (!children.length) {
        // remove the whitespace-only node right after an opening tag
        text = ''
      } else if (whitespaceOption) {
        if (whitespaceOption === 'condense') {
          // in condense mode, remove the whitespace node if it contains
          // line break, otherwise condense to a single space
          text = lineBreakRE.test(text) ? '' : ' '
        } else {
          text = ' '
        }
      } else {
        text = preserveWhitespace ? ' ' : ''
      }
      if (text) {
        if (!inPre && whitespaceOption === 'condense') {
          // condense consecutive whitespaces into single space
          text = text.replace(whitespaceRE, ' ')
        }
        let res
        let child: ?ASTNode
        if (!inVPre && text !== ' ' && (res = parseText(text, delimiters))) {
          child = {
            type: 2,
            expression: res.expression,
            tokens: res.tokens,
            text
          }
        } else if (text !== ' ' || !children.length || children[children.length - 1].text !== ' ') {
          child = {
            type: 3,
            text
          }
        }
        if (child) {
          if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
            child.start = start
            child.end = end
          }
          children.push(child)
        }
      }
    },
    comment (text: string, start, end) {  //每次遇到 注释节点 时就会调用该函数
      // adding anyting as a sibling to the root node is forbidden
      // comments should still be allowed, but ignored
      if (currentParent) {
        const child: ASTText = {
          type: 3,
          text,
          isComment: true
        }
        if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
          child.start = start
          child.end = end
        }
        currentParent.children.push(child)
      }
    }
  })
  return root
}
/**
 * 标记一个一个节点是否使用了v-pre
 * @param {*} el 
 */
function processPre (el) {
  if (getAndRemoveAttr(el, 'v-pre') != null) {  
    el.pre = true
  }
}
/**
 * 设置一个描述对象是否为pre编译模式 并新增上attrs属性及子节点上新增plain的标识为true
 * 1.如果标签使用了 v-pre 指令，则该标签的元素描述对象的 element.pre 属性将为 true
 * 2.对于使用了 v-pre 指令的标签及其子代标签，它们的任何属性都将会被作为原始属性处理
 * 3.添加 element.attrs 属性 每个value值都是通过JSON.stringify()处理完成得
 * 4.v-pre 指令标签的子代标签在没有使用v-pre的时候 则会设置plain:true
 * @param {*} el 
 */
function processRawAttrs (el) {
  const list = el.attrsList   //获取当前描述对象的attrsList
  const len = list.length
  if (len) {    //如果当前这个属性数组长度不等于0，说明是有属性的
    const attrs: Array<ASTAttr> = el.attrs = new Array(len)   //ok 声明了一个同样长度的数组，并在当前的描述对象上添加上一个attrs的新属性
    for (let i = 0; i < len; i++) {
      attrs[i] = {    //循环并赋值一个新的属性
        name: list[i].name,
        value: JSON.stringify(list[i].value)      //确保是一个真正的字符串
      }
      if (list[i].start != null) {    //如果原始的attrsList有start属性  则新对象上也应该有
        attrs[i].start = list[i].start
        attrs[i].end = list[i].end
      }
    }
  } else if (!el.pre) {  //如果当前这个描述对象上即没有属性并且pre数组又不存在，但是有时在vpre解析模式下  那他绝对是pre标签下的子节点
    // non root node in pre blocks with no attributes
    el.plain = true   //那么设置他的属性plain为true
  }
}

export function processElement (
  element: ASTElement,
  options: CompilerOptions
) {
  processKey(element)   //添加key相对应的描述对象信息

  // determine whether this is a plain element after
  // removing structural attributes
  element.plain = (
    !element.key &&
    !element.scopedSlots &&
    !element.attrsList.length
  )

  processRef(element)   //添加ref相对应的描述对象信息
  processSlotContent(element)     //添加slot相对应的描述对象信息
  processSlotOutlet(element)    //添加 单元slot相对应的描述对象信息
  processComponent(element)     //查看component 是否使用了 相对应的指令 并设置相对应的描述信息
  for (let i = 0; i < transforms.length; i++) {
    element = transforms[i](element, options) || element
  }
  processAttrs(element)   
  return element
}

function processKey (el) {
  const exp = getBindingAttr(el, 'key')   //继续获取当前描述对象上的key值
  if (exp) {
    if (process.env.NODE_ENV !== 'production') {    //如果当前是在开发环境下
      if (el.tag === 'template') {    //并且这个标签是template标签 给出警告
        warn(   //给出警告 当前的template不需要写key值
          `<template> cannot be keyed. Place the key on real elements instead.`,
          getRawBindingAttr(el, 'key')
        )
      }
      if (el.for) {   //如果当前的 v-for 是开发者写了的情况
        const iterator = el.iterator2 || el.iterator1 //并且for循环中是写上了索引的情况
        const parent = el.parent    //并且缓存一个parent
        if (iterator && iterator === exp && parent && parent.tag === 'transition-group') {    //如果当前父元素上的标签名为transition-group 同样给出警告 
          warn(
            `Do not use v-for index as key on <transition-group> children, ` +
            `this is the same as not using keys.`,
            getRawBindingAttr(el, 'key'),
            true /* tip */
          )
        }
      }
    }
    el.key = exp    //如果当前描述对象上的key存在 则添加上.key等于所对应的值
  }
}

function processRef (el) {
  const ref = getBindingAttr(el, 'ref')   //获取当前ref的值 
  if (ref) {  //有则添加上ref的匹配参数
    el.ref = ref    
    el.refInFor = checkInFor(el)    //添加一个refInfor属性 确保当前ref是否包含在for循环内
  }
}

export function processFor (el: ASTElement) {
  let exp
  if ((exp = getAndRemoveAttr(el, 'v-for'))) {  //判断当前描述对象上是否有写v-for指令
    const res = parseFor(exp)   //解析v-for对应的所有值
    if (res) {  //如果有匹配到值
      extend(el, res) //则直接混入到当前的描述对象中
    } else if (process.env.NODE_ENV !== 'production') {   //如果没有匹配到？ 警告当前这个v-for 这个指令是无效的
      warn(
        `Invalid v-for expression: ${exp}`,
        el.rawAttrsMap['v-for']
      )
    }
  }
}

type ForParseResult = {
  for: string;
  alias: string;
  iterator1?: string;
  iterator2?: string;
};
/**
 *  
 * @param {*} exp  一个v-for 循环的值
 */
export function parseFor (exp: string): ?ForParseResult {
  const inMatch = exp.match(forAliasRE)   //匹配当前for 正则
  if (!inMatch) return  //如果没有匹配到 则直接返回undefined
  const res = {}
  res.for = inMatch[2].trim() //获取当前for的目标
  const alias = inMatch[1].trim().replace(stripParensRE, '')    //获取到当前循环的item
  const iteratorMatch = alias.match(forIteratorRE)    //正则匹配有没有写其他key值
  if (iteratorMatch) {  //如果没有写 
    res.alias = alias.replace(forIteratorRE, '').trim()   //重新匹配到值后 重复赋值
    res.iterator1 = iteratorMatch[1].trim() //第二个key
    if (iteratorMatch[2]) {
      res.iterator2 = iteratorMatch[2].trim() //第三个key
    }
  } else {
    res.alias = alias //直接就使用原来匹配到的item作为值
  }
  return res    //最后返回当前组装完成得数据
}

/**1.如果有使用v-if指令 则在当前描述对象上添加一个.if的属性并赋值为当前v-if指令的值
 * 2.如果有使用v-if指令的时候 并在当前的描述对象上添加一个ifConditions数组，并存入当前tree对象
 * 3.如果有使用v-else指令 则在当前描述对象上添加一个.else的属性并设置为true
 * 4.如果有使用v-else-if指令，则在当前的描述对象上添加一个elseif的属性并设值为当前指令的匹配值
 * 5.使用完v-else及v-else-if指令时 并不会生成正真的tree描述节点，而是在当前v-if描述节点对象上的ifConditions数组中添加当前描述对象
 * @param {*} el 
 */
function processIf (el) {
  const exp = getAndRemoveAttr(el, 'v-if')    //获取到当前的v-if属性值并删除在el中的attrsList属性
  if (exp) {  //如果当前这个用户是写了v-if指令的情况下
    el.if = exp   //在当前的描述对象上添加一个.if的属性并赋值为当前v-if的匹配值
    addIfCondition(el, {    //在当前的描述对象上添加新的ifConditions数组 存储当前的匹配规则及父组件tree对象的引用
      exp: exp,
      block: el
    })
  } else {
    if (getAndRemoveAttr(el, 'v-else') != null) {   //如果当前的v-else属性值有写的情况下
      el.else = true    //并在当前描述对象上添加一个.else的属性值
    }
    const elseif = getAndRemoveAttr(el, 'v-else-if')    //获取当前v-else-if的属性值
    if (elseif) { //如果当前elseif有写的情况下
      el.elseif = elseif  //在当前描述对象上添加一个.elseif的属性并赋值当前的v-else-if的匹配值
    }
  }
}
/**
 * if else-if else 节点的生成
 * @param {*} el  当前节点
 * @param {*} parent  当前parent节点
 */
function processIfConditions (el, parent) {
  const prev = findPrevElement(parent.children) //获取到一个指定的tree树
  if (prev && prev.if) {  //如果当前这个tree树存在，并且是使用v-if的情况下
    addIfCondition(prev, {
      exp: el.elseif,
      block: el
    })
  } else if (process.env.NODE_ENV !== 'production') {
    warn(
      `v-${el.elseif ? ('else-if="' + el.elseif + '"') : 'else'} ` +
      `used on element <${el.tag}> without corresponding v-if.`,
      el.rawAttrsMap[el.elseif ? 'v-else-if' : 'v-else']
    )
  }
}
/**
 * 查找当前指定描述对象，并把多余的删除。更改的原始对象
 * @param {*} children 
 */
function findPrevElement (children: Array<any>): ASTElement | void {
  let i = children.length
  while (i--) {
    if (children[i].type === 1) {   //查找一个节点为元素节点的 返回过去
      return children[i]
    } else {  //没有找到则删除最后一个元素
      if (process.env.NODE_ENV !== 'production' && children[i].text !== ' ') {  //如果当前在开发环境下及当前text等于空 则警告 
        warn(
          `text "${children[i].text.trim()}" between v-if and v-else(-if) ` +
          `will be ignored.`,
          children[i]
        )
      }
      children.pop()
    }
  }
}
/**
 * 在当前的描述对象下 添加新的描述信息
 * @param {*} el  当前指定父级描述对象
 * @param {*} condition     包含匹配规则及当前子描述对象
 */
export function addIfCondition (el: ASTElement, condition: ASTIfCondition) {
  if (!el.ifConditions) {
    el.ifConditions = []
  }
  el.ifConditions.push(condition) 
}

function processOnce (el) {
  const once = getAndRemoveAttr(el, 'v-once')   //获取当前v-once属性
  if (once != null) {   //如果当前v-once指令存在
    el.once = true    //则在当前的藐视对象上添加一个.once的属性并赋值为true
  }
}

// handle content being passed to a component as slot,
// e.g. <template slot="xxx">, <div slot-scope="xxx">
function processSlotContent (el) {
  let slotScope
  if (el.tag === 'template') {    //判断下当前这个节点名称是否为template
    slotScope = getAndRemoveAttr(el, 'scope') //并且获取 scope 属性
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && slotScope) {   //如果还在使用scope属性，抛出一个警告
      warn(
        `the "scope" attribute for scoped slots have been deprecated and ` +
        `replaced by "slot-scope" since 2.5. The new "slot-scope" attribute ` +
        `can also be used on plain elements in addition to <template> to ` +
        `denote scoped slots.`,
        el.rawAttrsMap['scope'],
        true
      )
    }
    el.slotScope = slotScope || getAndRemoveAttr(el, 'slot-scope')
  } else if ((slotScope = getAndRemoveAttr(el, 'slot-scope'))) {    //如果当前slot-scope也存在？同样抛出一个错误
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && el.attrsMap['v-for']) {
      warn(
        `Ambiguous combined usage of slot-scope and v-for on <${el.tag}> ` +
        `(v-for takes higher priority). Use a wrapper <template> for the ` +
        `scoped slot to make it clearer.`,
        el.rawAttrsMap['slot-scope'],
        true
      )
    }
    el.slotScope = slotScope
  }

  // slot="xxx" 
  const slotTarget = getBindingAttr(el, 'slot')   //获取动态的绑定值slot
  if (slotTarget) {   //如果当前slot是存在的情况下
    el.slotTarget = slotTarget === '""' ? '"default"' : slotTarget    //并重新声明了一个属性 赋值为default默认值 及slotTarget本身值
    el.slotTargetDynamic = !!(el.attrsMap[':slot'] || el.attrsMap['v-bind:slot'])   //获取这个slot是否为一个动态绑定的slot 
    // preserve slot as an attribute for native shadow DOM compat
    // only for non-scoped slots.
    if (el.tag !== 'template' && !el.slotScope) {   //如果当前标签名不为template 并且 也没有使用scope、slot-scope属性
      addAttr(el, 'slot', slotTarget, getRawBindingAttr(el, 'slot'))
    }
  }

  // 2.6 v-slot syntax
  if (process.env.NEW_SLOT_SYNTAX) {
    if (el.tag === 'template') {    //如果当前这个是在template模板描述对象上
      // v-slot on <template>
      const slotBinding = getAndRemoveAttrByRegex(el, slotRE)   //获取到当前动态绑定的属性集合
      if (slotBinding) {    //如果是有找到的情况下
        if (process.env.NODE_ENV !== 'production') {    //并且是在开发环境下
          if (el.slotTarget || el.slotScope) {  //如果slotTarget或者slotScope 都存在则提示当前插槽语法不是一个期望的，因为2.6.0以后将会全部清除掉
            warn(
              `Unexpected mixed usage of different slot syntaxes.`,
              el
            )
          }
          if (el.parent && !maybeComponent(el.parent)) {    //如果当前parent存在的情况下并且当前这个标签是一个保留标签
            warn(
              `<template v-slot> can only appear at the root level inside ` +
              `the receiving the component`,
              el
            )
          }
        }
        const { name, dynamic } = getSlotName(slotBinding)      //解析结构对象
        el.slotTarget = name  //声明一个属性并赋值为新的name值
        el.slotTargetDynamic = dynamic  //赋值slotTargetDynamic为dynamic对应的值
        el.slotScope = slotBinding.value || emptySlotScopeToken // force it into a scoped slot for perf
      }
    } else {
      // v-slot on component, denotes default slot
      const slotBinding = getAndRemoveAttrByRegex(el, slotRE)
      if (slotBinding) {
        if (process.env.NODE_ENV !== 'production') {
          if (!maybeComponent(el)) {
            warn(
              `v-slot can only be used on components or <template>.`,
              slotBinding
            )
          }
          if (el.slotScope || el.slotTarget) {
            warn(
              `Unexpected mixed usage of different slot syntaxes.`,
              el
            )
          }
          if (el.scopedSlots) {
            warn(
              `To avoid scope ambiguity, the default slot should also use ` +
              `<template> syntax when there are other named slots.`,
              slotBinding
            )
          }
        }
        // add the component's children to its default slot
        const slots = el.scopedSlots || (el.scopedSlots = {})
        const { name, dynamic } = getSlotName(slotBinding)
        const slotContainer = slots[name] = createASTElement('template', [], el)
        slotContainer.slotTarget = name
        slotContainer.slotTargetDynamic = dynamic
        slotContainer.children = el.children.filter((c: any) => {
          if (!c.slotScope) {
            c.parent = slotContainer
            return true
          }
        })
        slotContainer.slotScope = slotBinding.value || emptySlotScopeToken
        // remove children as they are returned from scopedSlots now
        el.children = []
        // mark el non-plain so data gets generated
        el.plain = false
      }
    }
  }
}

function getSlotName (binding) {
  let name = binding.name.replace(slotRE, '')   //移除一下不管是任何形式的动态绑定都替换为空
  if (!name) {  //如果当前这是一个简写的slot
    if (binding.name[0] !== '#') { //如果当前不是已#简写开头的
      name = 'default'    //那我们需要重新给他命名一个默认值
    } else if (process.env.NODE_ENV !== 'production') {   //在开发环境下 给出警告
      warn(
        `v-slot shorthand syntax requires a slot name.`,
        binding
      )
    }
  }
  return dynamicArgRE.test(name)    //匹配当前执行的reg并返回一个对象
    // dynamic [name]
    ? { name: name.slice(1, -1), dynamic: true }
    // static name
    : { name: `"${name}"`, dynamic: false }
}

// handle <slot/> outlets
function processSlotOutlet (el) {
  if (el.tag === 'slot') {    //如果当前这个描述对象的节点名称为slot
    el.slotName = getBindingAttr(el, 'name')  //则在当前描述对象上添加一个slotName的属性 并赋值动态绑定的name值
    if (process.env.NODE_ENV !== 'production' && el.key) {    //如果在开发环境下slot上写了key 则给出警告
      warn(
        `\`key\` does not work on <slot> because slots are abstract outlets ` +
        `and can possibly expand into multiple elements. ` +
        `Use the key on a wrapping element instead.`,
        getRawBindingAttr(el, 'key')
      )
    }
  }
}

function processComponent (el) {
  let binding
  if ((binding = getBindingAttr(el, 'is'))) {   //如果当前is有写 不管是的动态属性还是静态属性
    el.component = binding  //赋值当前component为 binding值
  }
  if (getAndRemoveAttr(el, 'inline-template') != null) {    //如果inline-template 存在
    el.inlineTemplate = true    //则赋值inlineTemplate 为true 完成了
  }
}

function processAttrs (el) {
  const list = el.attrsList   //获取当前剩余的所有剩余的属性
  let i, l, name, rawName, value, modifiers, syncGen, isDynamic   //声明了一推变量
  for (i = 0, l = list.length; i < l; i++) {      //循环处理当前还有并且存在的属性信息
    name = rawName = list[i].name     //获取到当前属性的名称
    value = list[i].value   //获取到当前属性的值
    if (dirRE.test(name)) {   //判断当前这个属性值是否为动态数据绑定的，如果是则继续走下去
      // mark element as dynamic
      el.hasBindings = true   //并在当前的描述对象上添加一个属性为true
      // modifiers
      modifiers = parseModifiers(name.replace(dirRE, ''))   //先使用正则除去动态绑定属性的写法，再把完整的修饰符字符串传入parseModifiers函数进行解析
      // support .foo shorthand syntax for the .prop modifier   支持.foo .prop修饰符的简写语法
      if (process.env.VBIND_PROP_SHORTHAND && propBindRE.test(name)) {      //如果当前这个属性写法为‘.’开头的
        (modifiers || (modifiers = {})).prop = true   //如果当前用户没有写修饰符  那个就直接只用空对象默认赋值并添加一个.prop等于true的属性
        name = `.` + name.slice(1).replace(modifierRE, '')  //把当前字符串重新去除所有修饰符，并重新组装
      } else if (modifiers) {   //如果属性名称不是已‘.’开头的，并且有写修饰符的情况下
        name = name.replace(modifierRE, '')  //去除修饰符部分并重新组装属性名称
      }
      if (bindRE.test(name)) { // v-bind    //如果这个是已一个动态绑定的属性
        name = name.replace(bindRE, '')     //去除已动态绑定语法的开头形式，重新组装属性名
        value = parseFilters(value) // 继续把当前value作为表达式验证
        isDynamic = dynamicArgRE.test(name)   //并使用正则来匹配当前的属性值是否为[xxx]开头的写法
        if (isDynamic) {  //如果当前是则去除双大括号
          name = name.slice(1, -1)
        }
        if (
          process.env.NODE_ENV !== 'production' &&
          value.trim().length === 0     //如果绑定的值为空的话  则抛出一个错误
        ) {
          warn(
            `The value for a v-bind expression cannot be empty. Found in "v-bind:${name}"`      //哦 你绑定的值是空的，没找到 请你明细一下
          ) 
        }
        if (modifiers) {    //继续 如果当前修饰符有写
          if (modifiers.prop && !isDynamic) { //如果当前动态绑定使用了prop 并且不是已[xxx] 写法开头的
            name = camelize(name) //把属性名驼峰命名一下
            if (name === 'innerHtml') name = 'innerHTML'    //当遇到innerHtml需要特殊处理一下
          }
          if (modifiers.camel && !isDynamic) {    //如果不是[xxx]这样的写法 并且使用了camel修饰符
            name = camelize(name)   //把属性名驼峰命名一下
          }
          if (modifiers.sync) {   //如果当前使用了sync修饰符
            syncGen = genAssignmentCode(value, `$event`)
            if (!isDynamic) {   //并且不是一个动态[xxxx]的写法
              addHandler(
                el,
                `update:${camelize(name)}`,
                syncGen,
                null,
                false,
                warn,
                list[i]
              )
              if (hyphenate(name) !== camelize(name)) {
                addHandler(
                  el,
                  `update:${hyphenate(name)}`,
                  syncGen,
                  null,
                  false,
                  warn,
                  list[i]
                )
              }
            } else {
              // handler w/ dynamic event name
              addHandler(
                el,
                `"update:"+(${name})`,
                syncGen,
                null,
                false,
                warn,
                list[i],
                true // dynamic
              )
            }
          }
        }
        if ((modifiers && modifiers.prop) || (
          !el.component && platformMustUseProp(el.tag, el.attrsMap.type, name)
        )) {
          addProp(el, name, value, list[i], isDynamic)    //设置当前的prop属性
        } else {  
          addAttr(el, name, value, list[i], isDynamic)    //设置当前的attr属性
        }
      } else if (onRE.test(name)) { // v-on   //事件绑定
        name = name.replace(onRE, '') //同样去除事件绑定语法部分
        isDynamic = dynamicArgRE.test(name) //同样验证下是否为[xxx]的写法
        if (isDynamic) {  //如果当前这个是2.6.0动态事件
          name = name.slice(1, -1)  //及继续去除[]开头和结尾 拿到最终的属性名
        }
        addHandler(el, name, value, modifiers, false, warn, list[i], isDynamic)   //添加完相应是事件修饰符及事件信息
      } else { // normal directives     //其他指令绑定
        name = name.replace(dirRE, '')    //同样去除vue的其他指令的语法部分
        // parse arg
        const argMatch = name.match(argRE)  //获取到当前是否有传递额外参数
        let arg = argMatch && argMatch[1] //如果argMatch有匹配到 则获取匹配到的第二个参数赋值到arg上
        isDynamic = false //并标记当前动态标签为false
        if (arg) {  //如果是有传递额外参数的情况下
          name = name.slice(0, -(arg.length + 1))     //及重新获取下name的值
          if (dynamicArgRE.test(arg)) {  //判断下当前这个表达式是否为动态编译的事件类型
            arg = arg.slice(1, -1)    //如果是则获取到最终的属性名
            isDynamic = true  //并设置当前为动态编译节点
          }
        }
        addDirective(el, name, rawName, value, arg, isDynamic, modifiers, list[i])    //添加上当前自定义事件及其他事件到当前藐视对象上
        if (process.env.NODE_ENV !== 'production' && name === 'model') {    //如果当前是使用了v-model 的形式 
          checkForAliasModel(el, value) //判断当前model是否在使用for的循环item
        }
      }
    } else {    //解析一些非指令标签的属性
      // literal attribute
      if (process.env.NODE_ENV !== 'production') {
        const res = parseText(value, delimiters)
        if (res) {
          warn(
            `${name}="${value}": ` +
            'Interpolation inside attributes has been removed. ' +
            'Use v-bind or the colon shorthand instead. For example, ' +
            'instead of <div id="{{ val }}">, use <div :id="val">.',
            list[i]
          )
        }
      }
      addAttr(el, name, JSON.stringify(value), list[i])   //添加一个属性到当前描述对象的attrs数组中
      // #6887 firefox doesn't update muted state if set via attribute
      // even immediately after element creation
      /**
       * 他说这是一个狐火的bug  muted 属性在火狐上无法通过setAttribute设置进去
       */
      if (!el.component &&
          name === 'muted' &&
          platformMustUseProp(el.tag, el.attrsMap.type, name)) {    //则声明一个props来存储信息
        addProp(el, name, 'true', list[i])
      }
    }
  }
}
/**
 * 查找父指定父元素是有包含for节点的
 * @param {*} el 
 */
function checkInFor (el: ASTElement): boolean {
  let parent = el
  while (parent) {
    if (parent.for !== undefined) {
      return true
    }
    parent = parent.parent
  }
  return false
}
/**
 * 从一个属性中获取已知写法的修饰符 以对象的形式返回或者是undefined
 * @param {*} name 
 */
function parseModifiers (name: string): Object | void {
  const match = name.match(modifierRE)  //获取到当前存在的修饰符
  if (match) {    //如果开发这是有写修饰符的情况下
    const ret = {}  //声明了一个结果集框
    match.forEach(m => { ret[m.slice(1)] = true })    //截取修饰符的第一个字符‘.’最后赋值到res中
    return ret    //最终返回结果集
  }
}

function makeAttrsMap (attrs: Array<Object>): Object {
  const map = {}
  for (let i = 0, l = attrs.length; i < l; i++) {
    if (
      process.env.NODE_ENV !== 'production' &&
      map[attrs[i].name] && !isIE && !isEdge
    ) {
      warn('duplicate attribute: ' + attrs[i].name, attrs[i])
    }
    map[attrs[i].name] = attrs[i].value
  }
  return map
}

// for script (e.g. type="x/template") or style, do not decode content
function isTextTag (el): boolean {
  return el.tag === 'script' || el.tag === 'style'
}
/**
 * 当前禁止使用脚本在dom中插入 或者是style标签
 * @param {*} el 当前tree数据 
 */
function isForbiddenTag (el): boolean {
  return (
    el.tag === 'style' ||
    (el.tag === 'script' && (
      !el.attrsMap.type ||
      el.attrsMap.type === 'text/javascript'
    ))
  )
}

const ieNSBug = /^xmlns:NS\d+/  //声明了两个正则
const ieNSPrefix = /^NS\d+:/

/* istanbul ignore next */  
/**
 * 重新改造attr中多余的元素，并返回处理完成后的值
 * @param {*} attrs 
 */
function guardIESVGBug (attrs) {
  const res = []
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i]
    if (!ieNSBug.test(attr.name)) {
      attr.name = attr.name.replace(ieNSPrefix, '')
      res.push(attr)
    }
  }
  return res
}

/**
 * 给出开发者提示 在使用v-for的时候不能把当前对象绑定在响应式数据上
 * @param {*} el 
 * @param {*} value 
 */
function checkForAliasModel (el, value) {
  let _el = el
  while (_el) {
    if (_el.for && _el.alias === value) {  
      warn(
        `<${el.tag} v-model="${value}">: ` +
        `You are binding v-model directly to a v-for iteration alias. ` +
        `This will not be able to modify the v-for source array because ` +
        `writing to the alias is like modifying a function local variable. ` +
        `Consider using an array of objects and use v-model on an object property instead.`,
        el.rawAttrsMap['v-model']
      )
    }
    _el = _el.parent
  }
}
