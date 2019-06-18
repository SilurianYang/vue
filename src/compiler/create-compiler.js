/* @flow */

import { extend } from 'shared/util'
import { detectErrors } from './error-detector'
import { createCompileToFunctionFn } from './to-function'

/**
 * 1、生成最终编译器选项 finalOptions
    2、对错误的收集
    3、调用 baseCompile 编译模板
 * @param {*} baseCompile 
 */
export function createCompilerCreator (baseCompile: Function): Function {
  return function createCompiler (baseOptions: CompilerOptions) {
    function compile (
      template: string,     //当前摸模板字符串
      options?: CompilerOptions   //模板字符串需要的一些配置信息
    ): CompiledResult {
      const finalOptions = Object.create(baseOptions)   //创建一个继承于baseOptions的对象
      const errors = []     //继续声明一个错误信息框    
      const tips = []   //一个提示框

      let warn = (msg, range, tip) => {   //接着声明一个变量并赋值函数为结果
        (tip ? tips : errors).push(msg)   //判断当前给定的是tip 还是errors
      }

      if (options) {  //如果开发者有传递options对象
        if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
          // $flow-disable-line
          const leadingSpaceLength = template.match(/^\s*/)[0].length

          warn = (msg, range, tip) => {
            const data: WarningMessage = { msg }
            if (range) {
              if (range.start != null) {
                data.start = range.start + leadingSpaceLength
              }
              if (range.end != null) {
                data.end = range.end + leadingSpaceLength
              }
            }
            (tip ? tips : errors).push(data)
          }
        }
        // merge custom modules   合并参数对象
        if (options.modules) {    //首先判断有没有传 有传递才合并
          finalOptions.modules =
            (baseOptions.modules || []).concat(options.modules)     //使用默认值加传递进来的值进行合并
        }
        // merge custom directives
        if (options.directives) {     //相同上面的  不通的是directives为对象形式  则通过覆盖属性值得形式
          finalOptions.directives = extend(
            Object.create(baseOptions.directives || null),
            options.directives
          )
        }
        // copy other options
        for (const key in options) {  //接着继续赋值其他的值
          if (key !== 'modules' && key !== 'directives') {    //因为modules和directives已经是合并完成后的 所以就不再需要合并了
            finalOptions[key] = options[key]
          }
        }
      }

      finalOptions.warn = warn    //接着把warn警告方法放在最后进行赋值   为啥要放在最后以防被覆盖

      const compiled = baseCompile(template.trim(), finalOptions) //接着我们继续把模板及参数扔到调用createCompilerCreator方法时传递过来的baseCompile方法 等到结果
      if (process.env.NODE_ENV !== 'production') {    //如果是在非开发环境下
        detectErrors(compiled.ast, warn)    //验证当前的ast抽象语法树是否有错误，有则使用warn函数缓存对应的信息
      }
      compiled.errors = errors  //错误信息
      compiled.tips = tips    //提示信息
      return compiled   //都添加到结果上最终返回出去
    }

    return {
      compile,
      compileToFunctions: createCompileToFunctionFn(compile)
    }
  }
}
