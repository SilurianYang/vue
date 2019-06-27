/* @flow */

import {
  isPreTag,
  mustUseProp,
  isReservedTag,
  getTagNamespace
} from '../util/index'

import modules from './modules/index'
import directives from './directives/index'
import { genStaticKeys } from 'shared/util'
import { isUnaryTag, canBeLeftOpenTag } from './util'

export const baseOptions: CompilerOptions = {
  expectHTML: true,
  modules,    //最终会返回一个数组形式的所有模块，包含klass、style、 model
  directives, //最终会返回一个对象形式的所有模块，包含model、text、html
  isPreTag,   //是否为一个<pre>标签
  isUnaryTag, //当前是否为一个一元标签
  mustUseProp,    //是否需要对原生的prop做处理
  canBeLeftOpenTag,   //一些已知的可省略开头标签的元素
  isReservedTag,  //一些保留的标签
  getTagNamespace,    //获取到节点的命名空间
  staticKeys: genStaticKeys(modules)  //获取到当前对象的虽有keys
}
