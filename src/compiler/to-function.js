/* @flow */

import { noop, extend } from 'shared/util'
import { warn as baseWarn, tip } from 'core/util/debug'
import { generateCodeFrame } from './codeframe'

type CompiledFunctionResult = {
  render: Function;
  staticRenderFns: Array<Function>;
};
/**
 * 使用new Function把用户的字符串代码转换成可执行的方法，如果失败则抛出异常并返回一个空函数
 * @param {*} code 
 * @param {*} errors 
 */
function createFunction (code, errors) {
  try {
    return new Function(code)   //尝试视同new function转换开发者的代码
  } catch (err) {
    errors.push({ err, code })    //失败则把失败的信息装入框中
    return noop   //并返回一个空的函数
  }
}
/**
 *  把一个字符串模板转成一个可执行的方法
 * 
 * 1、缓存编译结果，通过 createCompileToFunctionFn 函数内声明的 cache 常量实现。
    2、调用 compile 函数将模板字符串转成渲染函数字符串
    3、调用 createFunction 函数将渲染函数字符串转成真正的渲染函数
    4、打印编译错误，包括：模板字符串 -> 渲染函数字符串 以及 渲染函数字符串 -> 渲染函数 这两个阶段的错误
    最后，真正的 模板字符串 到 渲染函数字符串 的编译工作实际上是通过调用 compile 函数来完成的，所以接下来我们的任务就是弄清楚 compile 函数。
 * 
 * @param {*} compile 
 */
export function createCompileToFunctionFn (compile: Function): Function {
  const cache = Object.create(null)   //创建一个完全空的对象

  return function compileToFunctions (
    template: string,   //当前字符串模板
    options?: CompilerOptions,    //当前字符串需要的一些配置信息
    vm?: Component    //当前实例化对象
  ): CompiledFunctionResult {   
    options = extend({}, options)          //把当前options赋值到新的options上
    const warn = options.warn || baseWarn  //缓存警告方法
    delete options.warn   //并删除options.warn属性

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production') {    //如果在开发环境下我们需要判断下当前环境是否支持new Funtion
      // detect possible CSP restriction
      try {
        new Function('return 1')      //测试下当前环境是否支持new Function
      } catch (e) {
        if (e.toString().match(/unsafe-eval|CSP/)) {        //如果不支持则抛出一个错误，判断当前是否为安全警告
          warn( 
            'It seems you are using the standalone build of Vue.js in an ' +
            'environment with Content Security Policy that prohibits unsafe-eval. ' +
            'The template compiler cannot work in this environment. Consider ' +
            'relaxing the policy to allow unsafe-eval or pre-compiling your ' +
            'templates into render functions.'
          )
        }
      }
    }

    // check cache
    const key = options.delimiters    //如果当前delimiters有传递的情况下
      ? String(options.delimiters) + template   //delimiters+template 组合
      : template      //否则只需要返回模板即可
    if (cache[key]) {   //如果当前闭包中key是存在的情况下 说明有值了  没必要重新编译 直接返回当前值即可
      return cache[key]   
    }

    // compile
    const compiled = compile(template, options)     

    // check compilation errors/tips    //在非生产环境下验证当前 errors及tips是否存在信息
    if (process.env.NODE_ENV !== 'production') {
      if (compiled.errors && compiled.errors.length) {    //打印错误而已 错误信息使用warn方法打印
        if (options.outputSourceRange) {
          compiled.errors.forEach(e => {
            warn(
              `Error compiling template:\n\n${e.msg}\n\n` +
              generateCodeFrame(template, e.start, e.end),
              vm
            )
          })
        } else {
          warn(
            `Error compiling template:\n\n${template}\n\n` +
            compiled.errors.map(e => `- ${e}`).join('\n') + '\n',
            vm
          )
        }
      }
      if (compiled.tips && compiled.tips.length) {    //继续tips信息使用tip 方法打印
        if (options.outputSourceRange) {
          compiled.tips.forEach(e => tip(e.msg, vm))
        } else {
          compiled.tips.forEach(msg => tip(msg, vm))
        }
      }
    }

    // turn code into functions
    const res = {}    //最终的返回集合
    const fnGenErrors = []    //错误信息收集处
    res.render = createFunction(compiled.render, fnGenErrors)   //最终会的到一个可执行的函数
    res.staticRenderFns = compiled.staticRenderFns.map(code => {    //继续添加一个属性 由staticRenderFns便利最终返回的一个函数数组
      return createFunction(code, fnGenErrors)
    })

    // check function generation errors.
    // this should only happen if there is a bug in the compiler itself.
    // mostly for codegen development use
    /* istanbul ignore if */
    /**
     * 检查函数生成错误。
      只有在编译器本身存在错误时才会发生这种情况。
      主要用于codegen开发使用
      伊斯坦布尔无视如果
     */
    if (process.env.NODE_ENV !== 'production') {
      if ((!compiled.errors || !compiled.errors.length) && fnGenErrors.length) {
        warn(
          `Failed to generate render function:\n\n` +
          fnGenErrors.map(({ err, code }) => `${err.toString()} in\n\n${code}\n`).join('\n'),
          vm
        )
      }
    }

    return (cache[key] = res)   //最后一步把res赋值到cache对应的key中并返回出去
  }
}
