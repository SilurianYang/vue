/**
 * Not type-checking this file because it's mostly vendor code.
 */

/*!
 * HTML Parser By John Resig (ejohn.org)
 * Modified by Juriy "kangax" Zaytsev
 * Original code by Erik Arvidsson (MPL-1.1 OR Apache-2.0 OR GPL-2.0-or-later)
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 * 
 * 不对此文件进行类型检查，因为它主要是供应商代码。
    HTML解析器John Resig（ejohn.org）
    由Juriy“kangax”Zaytsev修改
    Erik Arvidsson的原始代码（MPL-1.1或Apache-2.0或GPL-2.0或更高版本）
 */

// import { makeMap, no } from 'shared/util'
// import { isNonPhrasingTag } from 'web/compiler/util'
// import { unicodeRegExp } from 'core/util/lang'

import { makeMap, no } from '../../shared/util'
import { isNonPhrasingTag } from '../../platforms/web/compiler/util'
import { unicodeRegExp } from '../../core/util/lang'

// Regular Expressions for parsing tags and attributes
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/     //节点属性正则
const dynamicArgAttribute = /^\s*((?:v-[\w-]+:|@|:|#)\[[^=]+\][^\s"'<>\/=]*)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/  //动态节点属性正则
const ncname = `[a-zA-Z_][\\-\\.0-9_a-zA-Z${unicodeRegExp.source}]*`    //合法的 XML 名称是什么样的？
const qnameCapture = `((?:${ncname}\\:)?${ncname})`   //qname 实际上就是合法的标签名称，它是由可选项的 前缀、冒号 以及 名称 组成
const startTagOpen = new RegExp(`^<${qnameCapture}`)  //用来匹配开始标签的一部分，这部分包括：< 以及后面的 标签名称，这个表达式的创建用到了上面定义的 qnameCapture 字符串，所以 qnameCapture 这个字符串中所设置的捕获分组，在这里同样适用，也就是说 startTagOpen 这个正则表达式也会有一个捕获的分组，用来捕获匹配的标签名称
const startTagClose = /^\s*(\/?)>/    //用来匹配开始标签的 < 以及标签的名字，但是并不包括开始标签的闭合部分，即：> 或者 />，由于标签可能是一元标签，所以开始标签的闭合部分有可能是 />，比如：<br />，如果不是一元标签，此时就应该是：>
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`)   //endTag 这个正则用来匹配结束标签，由于该正则同样使用了字符串 qnameCapture，所以这个正则也拥有了一个捕获组，用来捕获标签名称
const doctype = /^<!DOCTYPE [^>]+>/i    //这个正则用来匹配文档的 DOCTYPE 标签，没有捕获组
// #7298: escape - to avoid being passed as HTML comment when inlined in page
const comment = /^<!\--/    //<!-- 而并不是 <!\--，之所以改成 <!\-- 是为了允许把 Vue 代码内联到 html 中，否则 <!-- 会被认为是注释节点
const conditionalComment = /^<!\[/  //他们都是从一个字符串的开头位置开始匹配的，因为有 ^ 的存在

// Special Elements (can contain anything)
export const isPlainTextElement = makeMap('script,style,textarea', true)    //标记是当前指定标签
const reCache = {}  //创建一个常量

const decodingMap = {   //一个值的互转
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&amp;': '&',
  '&#10;': '\n',
  '&#9;': '\t',
  '&#39;': "'"
}
const encodedAttr = /&(?:lt|gt|quot|amp|#39);/g     //又是一个匹配正则
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#39|#10|#9);/g  

// #5992
const isIgnoreNewlineTag = makeMap('pre,textarea', true)    //继续标记指定标签
const shouldIgnoreFirstNewline = (tag, html) => tag && isIgnoreNewlineTag(tag) && html[0] === '\n'  //匹配当前标签下开头是否为换行符的

/**
 * 这是一个解析节点的函数 把当前字符串解析成对应编码后的字符串
 * @param {*} value 
 * @param {*} shouldDecodeNewlines 
 */
function decodeAttr (value, shouldDecodeNewlines) {  
  const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
  return value.replace(re, match => decodingMap[match])
}
/**
 * 解析html字符串
 * @param {*} html //当前html字符串
 * @param {*} options   //一个需要的配置信息
 */
export function parseHTML (html, options) {
  // 一开始定义一坨常量
  const stack = []    //如果每次循环遇到一个 非一元标签都会往这里面加
  const expectHTML = options.expectHTML   //
  const isUnaryTag = options.isUnaryTag || no   //用于检查当前是狗为一元标签的，默认值为false
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no   //用来检测一个标签是否是可以省略闭合标签的非一元标签
  let index = 0   //当前字符串所在下标
  let last, lastTag   //最后的html及stack中最顶端的标签名称
  //开始进行循环分析字符串 直到被分析解析完成
  while (html) {
    last = html
    // Make sure we're not in a plaintext content element like script/style
    if (!lastTag || !isPlainTextElement(lastTag)) {   //如果当前标签不存在或者标签名称不为script，style，textarea
      let textEnd = html.indexOf('<')   //开始截取标签的开始位置
      if (textEnd === 0) {  //ok 确实你标签的时候并且是在最开始的位置上   优先作为 注释标签、条件注释、开始标识 以及 结束标签 处理
        // Comment:
        if (comment.test(html)) {   //当前是注释节点开头的
          const commentEnd = html.indexOf('-->')  //为了确保当前是注释节点，我们还需要获取尾巴看看

          if (commentEnd >= 0) {    //如果当前确实是注释节点
            if (options.shouldKeepComment) {      //当前为comments选项，是否保留注释节点，默认是不保留注释节点
              options.comment(html.substring(4, commentEnd), index, index + commentEnd + 3) //截取注释节点的内容并回调一个起始位置加一个结束位置
            }
            advance(commentEnd + 3)   //获取新的字符串
            continue    //注释字符串任务完成 继续循环
          }
        }

        // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
        if (conditionalComment.test(html)) {    //如果当前是条件注释节点
          const conditionalEnd = html.indexOf(']>') //再次确认下是否为条件注释节点

          if (conditionalEnd >= 0) {  //如果确实是
            advance(conditionalEnd + 2) //ok 截取掉 获取新的字符串
            continue    //注释节点字符串任务完成 继续循环
          }
        }

        // Doctype:
        const doctypeMatch = html.match(doctype)    //继续验证当前是否为Doctype 节点
        if (doctypeMatch) {   //如果是则继续
          advance(doctypeMatch[0].length)   //截取掉doc节点，得到新的字符串
          continue    //验证doc节点完成 继续循环
        }

        // End tag:
        const endTagMatch = html.match(endTag)    //验证当前是否为结束节点
        if (endTagMatch) {  //如果是 数据将会是这样[ '</div>', 'div'] 
          const curIndex = index //缓存当前的全局字符串索引 
          advance(endTagMatch[0].length)    //截取当前全局字符串并更新html及index 
          parseEndTag(endTagMatch[1], curIndex, index)  //传入当前结束标签名称及当前未更新过后的index及更新过后的index
          continue    //完成任务继续循环
        }

        // Start tag:
        const startTagMatch = parseStartTag()   //解析开始节点并返回数据
        if (startTagMatch) {  //如果是一个完整的标签的话 
          handleStartTag(startTagMatch)   //格式化完数据并存储成功，通知完毕，结束他的任务
          if (shouldIgnoreFirstNewline(startTagMatch.tagName, html)) {    //如果当前开头是换行符开头的
            advance(1)  //截取掉，并更新html及index
          }
          continue    //完成任务继续循环
        }
      }

      let text, rest, next
      if (textEnd >= 0) {  //解析完开始标签为<的所有有可能的类型后，将会再判断当前是否是一个文本类型或者是一个标签
        rest = html.slice(textEnd)  //把当前字符串截取掉，确保是以<开头的位置
        while (
          !endTag.test(rest) &&   //如果当前这个字符串标签不是结束标签
          !startTagOpen.test(rest) &&   //不是一个正常的开始标签
          !comment.test(rest) &&  //不是一个注释节点
          !conditionalComment.test(rest)  //不是一个条件注释节点
        ) {   //说白了 必须是一个字符串类型的才能走进来分析
          // < in plain text, be forgiving and treat it as text
          next = rest.indexOf('<', 1) //查找下一个<开头的符号，并重第一个开始之后找
          if (next < 0) break //如果当前类似于<开头的标签没找到了，没必要找了，直接返回
          textEnd += next //继续更新当前标签位置
          rest = html.slice(textEnd)  //接续截取
        }
        text = html.substring(0, textEnd)   //获取到已经验证完毕的字符串 确定完这是一个文本类型
      }

      if (textEnd < 0) {    //这里更好说了，反正没找到类似<的标签，直接把你当字符串就行了 
        text = html
      }

      if (text) { //如果当前这个字符串为真
        advance(text.length)  //继续截取整个html和更新index
      }

      if (options.chars && text) {    //如果有传递这个chars回调方法,并且字符串是存在的情况下
        options.chars(text, index - text.length, index)   //开始传递过去，包括当前字符串 、开始位置、结束位置
      }
    } else {    //当前标签存在 并且是一个已知排除的标签
      let endTagLength = 0   //声明一个变量并 设置当前默认值为0  当前结束标签的长度
      const stackedTag = lastTag.toLowerCase()      //当前标签名称的小写状态
      const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))   //正则匹配当前标签的结束已前的所有字符 并缓存到当前模块下
      const rest = html.replace(reStackedTag, function (all, text, endTag) {  //使用一个方法 替换相关的所有数据
        endTagLength = endTag.length  //赋值当前节点名称的长度
        if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {   //当前标签名称不是已知的script，style，textarea 并且也不是noscript标签
          text = text
            .replace(/<!\--([\s\S]*?)-->/g, '$1') // #7298
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
        }
        if (shouldIgnoreFirstNewline(stackedTag, text)) { //匹配当前标签下的内容是否需要换行 第一个位置上
          text = text.slice(1)  //需要则去除第一个换行符
        }
        if (options.chars) {  //继续  如果当前chars回调方法有传递 则继续传递
          options.chars(text) //执行回调 只传递了一个当前字符串
        }
        return '' //并返回一个空字符串来替换所有正则匹配到的
      })
      index += html.length - rest.length    //继续更新index 及html
      html = rest
      parseEndTag(stackedTag, index - endTagLength, index)  //标记当前是否为一个完整的标签
    }

    if (html === last) {  //如果当前什么都没做？ 说明是一个标签但是没有写全哦
      options.chars && options.chars(html)
      if (process.env.NODE_ENV !== 'production' && !stack.length && options.warn) {   //开发环境下给出警告
        options.warn(`Mal-formatted tag at end of template: "${html}"`, { start: index + html.length })
      }
      break
    }

  }

  // Clean up any remaining tags
  parseEndTag()
/**
 * 根据传递过来的字符串索引，截取字符串及获取到新字符串的起始位置
 * @param {*} n 
 */
  function advance (n) {
    index += n
    html = html.substring(n)
  }
/**
 * 解析开始节点
 * 主要是获取当前是否为一个完整的标签 如果是则返回标签名称、标签的开始位置、标签类型、标签的属性值。否则返回undefined
 * 
 */
  function parseStartTag () {
    const start = html.match(startTagOpen)    //匹配到当前节点的开始下标为0的（‘<’ 加 ‘标签名’）和下标为一的标签名
    if (start) { //如果当前匹配到了
      const match = {   //重新组织数据
        tagName: start[1],  //获取到当前的标签名
        attrs: [],    //声明一个空数据来存储数据
        start: index  //当前开始节点在整个字符串中的位置
      }
      advance(start[0].length)   //继续截取掉已经验证过的字符串，并返回新的字符串
      let end, attr     //声明两个变量
      while (!(end = html.match(startTagClose)) && (attr = html.match(dynamicArgAttribute) || html.match(attribute))) {   //如果当前没有匹配到开始标签的闭合部分并且在匹配到属性的情况下继续，直到匹配到了结束标签
        attr.start = index    //把当前的开始位置赋值接start属性
        advance(attr[0].length)   //并重新截取掉已经验证过的字符 得到新的字符及位置
        attr.end = index  //赋值结束位置
        match.attrs.push(attr)    //再赋值当前标签的属性
      }
      if (end) {  //再次判断当前结束标签是否存在 如果当前结束标签是存在的则为一个完整的标签 
        match.unarySlash = end[1] //给定当前是否为一个一元标签
        advance(end[0].length)    //继续更新字符串
        match.end = index //新的位置
        return match    //返回当前match对象
      }
    }
  }
/**
 * 此方法总体来说就是格式化已知的属性对象，并调用回调的start方法通知。存储当前非一元标签的值到stack中，并更新最近一个标签名称lastTag
 * 
 * @param {*} match 包含当前开始标签的所有信息 
 */
  function handleStartTag (match) {
    const tagName = match.tagName   //首先我们缓存当前的节点名称
    const unarySlash = match.unarySlash   //继续缓存当前标签是否为一元标签

    if (expectHTML) {
      if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
        parseEndTag(lastTag)
      }
      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        parseEndTag(tagName)
      }
    }

    const unary = isUnaryTag(tagName) || !!unarySlash     //优先判断当前标签名称是否为一个一元标签，否者就取当前unarySlash值作为值

    const l = match.attrs.length    //缓存一个属性对象的长度
    const attrs = new Array(l)    //并重新创建一个新的数组
    for (let i = 0; i < l; i++) {
      const args = match.attrs[i]   //便利当前数组 并获取到每个值
      const value = args[3] || args[4] || args[5] || ''   //获取到当前最终属性的值
      const shouldDecodeNewlines = tagName === 'a' && args[1] === 'href'    //如果当前标签名是'a'标签并且属性名为'href'
        ? options.shouldDecodeNewlinesForHref   //使用a标签 要对 a 标签的 href 属性值中的换行符或制表符做兼容处理
        : options.shouldDecodeNewlines  //要对属性值中的换行符或制表符做兼容处理
      attrs[i] = {
        name: args[1],   //获取到属性名
        value: decodeAttr(value, shouldDecodeNewlines)    //返回最终处理过后的value值
      }
      if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {   //如果当前是非开发环境下并且outputSourceRange值为真
        attrs[i].start = args.start + args[0].match(/^\s*/).length  //继续添加属性start
        attrs[i].end = args.end   //继续添加属性end
      }
    }

    if (!unary) { //如果当前不是一个一元标签
      stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs, start: match.start, end: match.end })    //存储当前非一元标签的名称、小写节点名称、格式化后的属性及value、节点的起始位置接开始位置
      lastTag = tagName  //把最新的标签名称赋值到lastTag上
    }

    if (options.start) {  //如果当前有传递start方法的情况下
      options.start(tagName, attrs, unary, match.start, match.end)    //则调用并回调给 节点名称、节点属性对象、是否为一元标签、开始位置、结束位置
    }
  }
/**
 * 此方法主要是验证当前结束标签是否存在解析完成，没有就给出警告，并处理特殊标签br及p标签
 * 
 * @param {*} tagName  //结束标签名称
 * @param {*} start   //结束标签在全局字符串下的开始位置
 * @param {*} end //结束标签在全局字符串下的结束位置
 */
  function parseEndTag (tagName, start, end) {
    let pos, lowerCasedTagName    //声明两个变量
    if (start == null) start = index  //如果当前start没有则使用index
    if (end == null) end = index    //如果当前end没有则使用index

    // Find the closest opened tag of the same type
    if (tagName) {  //如果当前结束标签存在
      lowerCasedTagName = tagName.toLowerCase()   //转个小写
      for (pos = stack.length - 1; pos >= 0; pos--) {   //开始循环查找stack中对应的标签
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {   //如果找到了
          break   //结束循环
        }
      }
    } else {    //不存在直接为空处理
      // If no tag name is provided, clean shop
      pos = 0
    }

    if (pos >= 0) {   //如果当前pos大于0，为啥会这样呢？因为标签可能会是没有写全的情况下
      // Close all the open elements, up the stack
      for (let i = stack.length - 1; i >= pos; i--) {   //继续循环stack
        if (process.env.NODE_ENV !== 'production' &&    //如果当前是在开发环境下
          (i > pos || !tagName) &&
          options.warn
        ) {   //并且当前结束标签不存在
          options.warn(
            `tag <${stack[i].tag}> has no matching end tag.`,   //贴出一个警告
            { start: stack[i].start, end: stack[i].end }
          )
        }
        if (options.end) {    //如果有传递end回调方法
          options.end(stack[i].tag, start, end)   //给出end回调 当前节点名称 开始及结束位置
        }
      }

      // Remove the open elements from the stack
      stack.length = pos  //更新stack数组
      lastTag = pos && stack[pos - 1].tag   //并更新lastTag
    } else if (lowerCasedTagName === 'br') {    //走到这里就很奇葩了，一般在没写开始标签的情况下都会被浏览器忽略掉 但是br和p标签则不会
      if (options.start) {    //start回调方法存在？
        options.start(tagName, [], true, start, end)  //ok 回调给他
      }
    } else if (lowerCasedTagName === 'p') {   //p标签也一样
      if (options.start) {
        options.start(tagName, [], false, start, end)
      }
      if (options.end) {    //只是需要手动补全补全标签
        options.end(tagName, start, end)
      }
    }
  }
}
