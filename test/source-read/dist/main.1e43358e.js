// modules are defined as an array
// [ module function, map of requires ]
//
// map of requires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the require for previous bundles
parcelRequire = (function (modules, cache, entry, globalName) {
  // Save the require from previous bundle to this closure if any
  var previousRequire = typeof parcelRequire === 'function' && parcelRequire;
  var nodeRequire = typeof require === 'function' && require;

  function newRequire(name, jumped) {
    if (!cache[name]) {
      if (!modules[name]) {
        // if we cannot find the module within our internal map or
        // cache jump to the current global require ie. the last bundle
        // that was added to the page.
        var currentRequire = typeof parcelRequire === 'function' && parcelRequire;
        if (!jumped && currentRequire) {
          return currentRequire(name, true);
        }

        // If there are other bundles on this page the require from the
        // previous one is saved to 'previousRequire'. Repeat this as
        // many times as there are bundles until the module is found or
        // we exhaust the require chain.
        if (previousRequire) {
          return previousRequire(name, true);
        }

        // Try the node require function if it exists.
        if (nodeRequire && typeof name === 'string') {
          return nodeRequire(name);
        }

        var err = new Error('Cannot find module \'' + name + '\'');
        err.code = 'MODULE_NOT_FOUND';
        throw err;
      }

      localRequire.resolve = resolve;
      localRequire.cache = {};

      var module = cache[name] = new newRequire.Module(name);

      modules[name][0].call(module.exports, localRequire, module, module.exports, this);
    }

    return cache[name].exports;

    function localRequire(x){
      return newRequire(localRequire.resolve(x));
    }

    function resolve(x){
      return modules[name][1][x] || x;
    }
  }

  function Module(moduleName) {
    this.id = moduleName;
    this.bundle = newRequire;
    this.exports = {};
  }

  newRequire.isParcelRequire = true;
  newRequire.Module = Module;
  newRequire.modules = modules;
  newRequire.cache = cache;
  newRequire.parent = previousRequire;
  newRequire.register = function (id, exports) {
    modules[id] = [function (require, module) {
      module.exports = exports;
    }, {}];
  };

  var error;
  for (var i = 0; i < entry.length; i++) {
    try {
      newRequire(entry[i]);
    } catch (e) {
      // Save first error but execute all entries
      if (!error) {
        error = e;
      }
    }
  }

  if (entry.length) {
    // Expose entry point to Node, AMD or browser globals
    // Based on https://github.com/ForbesLindesay/umd/blob/master/template.js
    var mainExports = newRequire(entry[entry.length - 1]);

    // CommonJS
    if (typeof exports === "object" && typeof module !== "undefined") {
      module.exports = mainExports;

    // RequireJS
    } else if (typeof define === "function" && define.amd) {
     define(function () {
       return mainExports;
     });

    // <script>
    } else if (globalName) {
      this[globalName] = mainExports;
    }
  }

  // Override the current require with this new one
  parcelRequire = newRequire;

  if (error) {
    // throw error from earlier, _after updating parcelRequire_
    throw error;
  }

  return newRequire;
})({"../../src/shared/util.js":[function(require,module,exports) {
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isUndef = isUndef;
exports.isDef = isDef;
exports.isTrue = isTrue;
exports.isFalse = isFalse;
exports.isPrimitive = isPrimitive;
exports.isObject = isObject;
exports.toRawType = toRawType;
exports.isPlainObject = isPlainObject;
exports.isRegExp = isRegExp;
exports.isValidArrayIndex = isValidArrayIndex;
exports.isPromise = isPromise;
exports.toString = toString;
exports.toNumber = toNumber;
exports.makeMap = makeMap;
exports.remove = remove;
exports.hasOwn = hasOwn;
exports.cached = cached;
exports.toArray = toArray;
exports.extend = extend;
exports.toObject = toObject;
exports.noop = noop;
exports.genStaticKeys = genStaticKeys;
exports.looseEqual = looseEqual;
exports.looseIndexOf = looseIndexOf;
exports.once = once;
exports.identity = exports.no = exports.bind = exports.hyphenate = exports.capitalize = exports.camelize = exports.isReservedAttribute = exports.isBuiltInTag = exports.emptyObject = void 0;

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

var emptyObject = Object.freeze({}); // These helpers produce better VM code in JS engines due to their
// explicitness and function inlining.

exports.emptyObject = emptyObject;

function isUndef(v) {
  return v === undefined || v === null;
}

function isDef(v) {
  return v !== undefined && v !== null;
}

function isTrue(v) {
  return v === true;
}

function isFalse(v) {
  return v === false;
}
/**
 * Check if value is primitive.
 */


function isPrimitive(value) {
  return typeof value === 'string' || typeof value === 'number' || // $flow-disable-line
  _typeof(value) === 'symbol' || typeof value === 'boolean';
}
/**
 * Quick object check - this is primarily used to tell
 * Objects from primitive values when we know the value
 * is a JSON-compliant type.
 */


function isObject(obj) {
  return obj !== null && _typeof(obj) === 'object';
}
/**
 * Get the raw type string of a value, e.g., [object Object].
 */


var _toString = Object.prototype.toString;

function toRawType(value) {
  return _toString.call(value).slice(8, -1);
}
/**
 * Strict object type check. Only returns true
 * for plain JavaScript objects.
 */


function isPlainObject(obj) {
  return _toString.call(obj) === '[object Object]';
}

function isRegExp(v) {
  return _toString.call(v) === '[object RegExp]';
}
/**
 * Check if val is a valid array index.
 */


function isValidArrayIndex(val) {
  var n = parseFloat(String(val));
  return n >= 0 && Math.floor(n) === n && isFinite(val);
}

function isPromise(val) {
  return isDef(val) && typeof val.then === 'function' && typeof val.catch === 'function';
}
/**
 * Convert a value to a string that is actually rendered.
 */


function toString(val) {
  return val == null ? '' : Array.isArray(val) || isPlainObject(val) && val.toString === _toString ? JSON.stringify(val, null, 2) : String(val);
}
/**
 * Convert an input value to a number for persistence.
 * If the conversion fails, return original string.
 */


function toNumber(val) {
  var n = parseFloat(val);
  return isNaN(n) ? val : n;
}
/**
 * Make a map and return a function for checking if a key
 * is in that map.
 * 遍历一个已知对象并返回一个函数
 */


function makeMap(str, expectsLowerCase) {
  var map = Object.create(null);
  var list = str.split(',');

  for (var i = 0; i < list.length; i++) {
    map[list[i]] = true;
  }

  return expectsLowerCase ? function (val) {
    return map[val.toLowerCase()];
  } : function (val) {
    return map[val];
  };
}
/**
 * Check if a tag is a built-in tag.
 */


var isBuiltInTag = makeMap('slot,component', true);
/**
 * Check if an attribute is a reserved attribute.
 */

exports.isBuiltInTag = isBuiltInTag;
var isReservedAttribute = makeMap('key,ref,slot,slot-scope,is');
/**
 * Remove an item from an array.
 */

exports.isReservedAttribute = isReservedAttribute;

function remove(arr, item) {
  if (arr.length) {
    var index = arr.indexOf(item);

    if (index > -1) {
      return arr.splice(index, 1);
    }
  }
}
/**
 * Check whether an object has the property.
 */


var hasOwnProperty = Object.prototype.hasOwnProperty;

function hasOwn(obj, key) {
  return hasOwnProperty.call(obj, key);
}
/**
 * Create a cached version of a pure function.
 */


function cached(fn) {
  var cache = Object.create(null);
  return function cachedFn(str) {
    var hit = cache[str];
    return hit || (cache[str] = fn(str));
  };
}
/**
 * Camelize a hyphen-delimited string.
 */


var camelizeRE = /-(\w)/g;
var camelize = cached(function (str) {
  return str.replace(camelizeRE, function (_, c) {
    return c ? c.toUpperCase() : '';
  });
});
/**
 * Capitalize a string.
 */

exports.camelize = camelize;
var capitalize = cached(function (str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
});
/**
 * Hyphenate a camelCase string.
 */

exports.capitalize = capitalize;
var hyphenateRE = /\B([A-Z])/g;
var hyphenate = cached(function (str) {
  return str.replace(hyphenateRE, '-$1').toLowerCase();
});
/**
 * Simple bind polyfill for environments that do not support it,
 * e.g., PhantomJS 1.x. Technically, we don't need this anymore
 * since native bind is now performant enough in most browsers.
 * But removing it would mean breaking code that was able to run in
 * PhantomJS 1.x, so this must be kept for backward compatibility.
 */

/* istanbul ignore next */

exports.hyphenate = hyphenate;

function polyfillBind(fn, ctx) {
  function boundFn(a) {
    var l = arguments.length;
    return l ? l > 1 ? fn.apply(ctx, arguments) : fn.call(ctx, a) : fn.call(ctx);
  }

  boundFn._length = fn.length;
  return boundFn;
}

function nativeBind(fn, ctx) {
  return fn.bind(ctx);
}

var bind = Function.prototype.bind ? nativeBind : polyfillBind;
/**
 * Convert an Array-like object to a real Array.
 */

exports.bind = bind;

function toArray(list, start) {
  start = start || 0;
  var i = list.length - start;
  var ret = new Array(i);

  while (i--) {
    ret[i] = list[i + start];
  }

  return ret;
}
/**
 * Mix properties into target object.
 */


function extend(to, _from) {
  for (var _key in _from) {
    to[_key] = _from[_key];
  }

  return to;
}
/**
 * Merge an Array of Objects into a single Object.
 */


function toObject(arr) {
  var res = {};

  for (var i = 0; i < arr.length; i++) {
    if (arr[i]) {
      extend(res, arr[i]);
    }
  }

  return res;
}
/* eslint-disable no-unused-vars */

/**
 * Perform no operation.
 * Stubbing args to make Flow happy without leaving useless transpiled code
 * with ...rest (https://flow.org/blog/2017/05/07/Strict-Function-Call-Arity/).
 */


function noop(a, b, c) {}
/**
 * Always return false.
 */


var no = function no(a, b, c) {
  return false;
};
/* eslint-enable no-unused-vars */

/**
 * Return the same value.
 */


exports.no = no;

var identity = function identity(_) {
  return _;
};
/**
 * Generate a string containing static keys from compiler modules.
 */


exports.identity = identity;

function genStaticKeys(modules) {
  return modules.reduce(function (keys, m) {
    return keys.concat(m.staticKeys || []);
  }, []).join(',');
}
/**
 * Check if two values are loosely equal - that is,
 * if they are plain objects, do they have the same shape?
 */


function looseEqual(a, b) {
  if (a === b) return true;
  var isObjectA = isObject(a);
  var isObjectB = isObject(b);

  if (isObjectA && isObjectB) {
    try {
      var isArrayA = Array.isArray(a);
      var isArrayB = Array.isArray(b);

      if (isArrayA && isArrayB) {
        return a.length === b.length && a.every(function (e, i) {
          return looseEqual(e, b[i]);
        });
      } else if (a instanceof Date && b instanceof Date) {
        return a.getTime() === b.getTime();
      } else if (!isArrayA && !isArrayB) {
        var keysA = Object.keys(a);
        var keysB = Object.keys(b);
        return keysA.length === keysB.length && keysA.every(function (key) {
          return looseEqual(a[key], b[key]);
        });
      } else {
        /* istanbul ignore next */
        return false;
      }
    } catch (e) {
      /* istanbul ignore next */
      return false;
    }
  } else if (!isObjectA && !isObjectB) {
    return String(a) === String(b);
  } else {
    return false;
  }
}
/**
 * Return the first index at which a loosely equal value can be
 * found in the array (if value is a plain object, the array must
 * contain an object of the same shape), or -1 if it is not present.
 */


function looseIndexOf(arr, val) {
  for (var i = 0; i < arr.length; i++) {
    if (looseEqual(arr[i], val)) return i;
  }

  return -1;
}
/**
 * Ensure a function is called only once.
 */


function once(fn) {
  var called = false;
  return function () {
    if (!called) {
      called = true;
      fn.apply(this, arguments);
    }
  };
}
},{}],"../../src/platforms/web/compiler/util.js":[function(require,module,exports) {
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isNonPhrasingTag = exports.canBeLeftOpenTag = exports.isUnaryTag = void 0;

var _util = require("../../../shared/util");

// import { makeMap } from 'shared/util'
var isUnaryTag = (0, _util.makeMap)('area,base,br,col,embed,frame,hr,img,input,isindex,keygen,' + 'link,meta,param,source,track,wbr'); // Elements that you can, intentionally, leave open
// (and which close themselves)

exports.isUnaryTag = isUnaryTag;
var canBeLeftOpenTag = (0, _util.makeMap)('colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr,source'); // HTML5 tags https://html.spec.whatwg.org/multipage/indices.html#elements-3
// Phrasing Content https://html.spec.whatwg.org/multipage/dom.html#phrasing-content

exports.canBeLeftOpenTag = canBeLeftOpenTag;
var isNonPhrasingTag = (0, _util.makeMap)('address,article,aside,base,blockquote,body,caption,col,colgroup,dd,' + 'details,dialog,div,dl,dt,fieldset,figcaption,figure,footer,form,' + 'h1,h2,h3,h4,h5,h6,head,header,hgroup,hr,html,legend,li,menuitem,meta,' + 'optgroup,option,param,rp,rt,source,style,summary,tbody,td,tfoot,th,thead,' + 'title,tr,track');
exports.isNonPhrasingTag = isNonPhrasingTag;
},{"../../../shared/util":"../../src/shared/util.js"}],"../../src/core/util/lang.js":[function(require,module,exports) {
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isReserved = isReserved;
exports.def = def;
exports.parsePath = parsePath;
exports.unicodeRegExp = void 0;

/**
 * unicode letters used for parsing html tags, component names and property paths.
 * using https://www.w3.org/TR/html53/semantics-scripting.html#potentialcustomelementname
 * skipping \u10000-\uEFFFF due to it freezing up PhantomJS
 */
var unicodeRegExp = /a-zA-Z\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD/;
/**
 * Check if a string starts with $ or _
 */

exports.unicodeRegExp = unicodeRegExp;

function isReserved(str) {
  var c = (str + '').charCodeAt(0);
  return c === 0x24 || c === 0x5F;
}
/**
 * Define a property.
 */


function def(obj, key, val, enumerable) {
  Object.defineProperty(obj, key, {
    value: val,
    enumerable: !!enumerable,
    writable: true,
    configurable: true
  });
}
/**
 * Parse simple path.
 * 验证一个合法的表达式，并拆分obj.a 以点分隔的字符串 最终返回一个函数
 */


var bailRE = new RegExp("[^".concat(unicodeRegExp.source, ".$_\\d]"));

function parsePath(path) {
  if (bailRE.test(path)) {
    return;
  }

  var segments = path.split('.');
  return function (obj) {
    for (var i = 0; i < segments.length; i++) {
      if (!obj) return;
      obj = obj[segments[i]];
    }

    return obj;
  };
}
},{}],"../../src/compiler/parser/html-parser.js":[function(require,module,exports) {
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.parseHTML = parseHTML;
exports.isPlainTextElement = void 0;

var _util = require("../../shared/util");

var _util2 = require("../../platforms/web/compiler/util");

var _lang = require("../../core/util/lang");

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
// Regular Expressions for parsing tags and attributes
var attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/; //节点属性正则

var dynamicArgAttribute = /^\s*((?:v-[\w-]+:|@|:|#)\[[^=]+\][^\s"'<>\/=]*)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/; //动态节点属性正则

var ncname = "[a-zA-Z_][\\-\\.0-9_a-zA-Z".concat(_lang.unicodeRegExp.source, "]*"); //合法的 XML 名称是什么样的？

var qnameCapture = "((?:".concat(ncname, "\\:)?").concat(ncname, ")"); //qname 实际上就是合法的标签名称，它是由可选项的 前缀、冒号 以及 名称 组成

var startTagOpen = new RegExp("^<".concat(qnameCapture)); //用来匹配开始标签的一部分，这部分包括：< 以及后面的 标签名称，这个表达式的创建用到了上面定义的 qnameCapture 字符串，所以 qnameCapture 这个字符串中所设置的捕获分组，在这里同样适用，也就是说 startTagOpen 这个正则表达式也会有一个捕获的分组，用来捕获匹配的标签名称

var startTagClose = /^\s*(\/?)>/; //用来匹配开始标签的 < 以及标签的名字，但是并不包括开始标签的闭合部分，即：> 或者 />，由于标签可能是一元标签，所以开始标签的闭合部分有可能是 />，比如：<br />，如果不是一元标签，此时就应该是：>

var endTag = new RegExp("^<\\/".concat(qnameCapture, "[^>]*>")); //endTag 这个正则用来匹配结束标签，由于该正则同样使用了字符串 qnameCapture，所以这个正则也拥有了一个捕获组，用来捕获标签名称

var doctype = /^<!DOCTYPE [^>]+>/i; //这个正则用来匹配文档的 DOCTYPE 标签，没有捕获组
// #7298: escape - to avoid being passed as HTML comment when inlined in page

var comment = /^<!\--/; //<!-- 而并不是 <!\--，之所以改成 <!\-- 是为了允许把 Vue 代码内联到 html 中，否则 <!-- 会被认为是注释节点

var conditionalComment = /^<!\[/; //他们都是从一个字符串的开头位置开始匹配的，因为有 ^ 的存在
// Special Elements (can contain anything)

var isPlainTextElement = (0, _util.makeMap)('script,style,textarea', true); //标记是当前指定标签

exports.isPlainTextElement = isPlainTextElement;
var reCache = {}; //创建一个常量

var decodingMap = {
  //一个值的互转
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&amp;': '&',
  '&#10;': '\n',
  '&#9;': '\t',
  '&#39;': "'"
};
var encodedAttr = /&(?:lt|gt|quot|amp|#39);/g; //又是一个匹配正则

var encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#39|#10|#9);/g; // #5992

var isIgnoreNewlineTag = (0, _util.makeMap)('pre,textarea', true); //继续标记指定标签

var shouldIgnoreFirstNewline = function shouldIgnoreFirstNewline(tag, html) {
  return tag && isIgnoreNewlineTag(tag) && html[0] === '\n';
}; //匹配当前标签下开头是否为换行符的

/**
 * 这是一个解析节点的函数 把当前字符串解析成对应编码后的字符串
 * @param {*} value 
 * @param {*} shouldDecodeNewlines 
 */


function decodeAttr(value, shouldDecodeNewlines) {
  var re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr;
  return value.replace(re, function (match) {
    return decodingMap[match];
  });
}
/**
 * 解析html字符串
 * @param {*} html //当前html字符串
 * @param {*} options   //一个需要的配置信息
 */


function parseHTML(html, options) {
  // 一开始定义一坨常量
  var stack = []; //如果每次循环遇到一个 非一元标签都会往这里面加

  var expectHTML = options.expectHTML; //

  var isUnaryTag = options.isUnaryTag || _util.no; //用于检查当前是狗为一元标签的，默认值为false

  var canBeLeftOpenTag = options.canBeLeftOpenTag || _util.no; //用来检测一个标签是否是可以省略闭合标签的非一元标签

  var index = 0; //当前字符串所在下标

  var last, lastTag; //最后的html及stack中最顶端的标签名称
  //开始进行循环分析字符串 直到被分析解析完成

  while (html) {
    last = html; // Make sure we're not in a plaintext content element like script/style

    if (!lastTag || !isPlainTextElement(lastTag)) {
      //如果当前标签不存在或者标签名称不为script，style，textarea
      var textEnd = html.indexOf('<'); //开始截取标签的开始位置

      if (textEnd === 0) {
        //ok 确实你标签的时候并且是在最开始的位置上   优先作为 注释标签、条件注释、开始标识 以及 结束标签 处理
        // Comment:
        if (comment.test(html)) {
          //当前是注释节点开头的
          var commentEnd = html.indexOf('-->'); //为了确保当前是注释节点，我们还需要获取尾巴看看

          if (commentEnd >= 0) {
            //如果当前确实是注释节点
            if (options.shouldKeepComment) {
              //当前为comments选项，是否保留注释节点，默认是不保留注释节点
              options.comment(html.substring(4, commentEnd), index, index + commentEnd + 3); //截取注释节点的内容并回调一个起始位置加一个结束位置
            }

            advance(commentEnd + 3); //获取新的字符串

            continue; //注释字符串任务完成 继续循环
          }
        } // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment


        if (conditionalComment.test(html)) {
          //如果当前是条件注释节点
          var conditionalEnd = html.indexOf(']>'); //再次确认下是否为条件注释节点

          if (conditionalEnd >= 0) {
            //如果确实是
            advance(conditionalEnd + 2); //ok 截取掉 获取新的字符串

            continue; //注释节点字符串任务完成 继续循环
          }
        } // Doctype:


        var doctypeMatch = html.match(doctype); //继续验证当前是否为Doctype 节点

        if (doctypeMatch) {
          //如果是则继续
          advance(doctypeMatch[0].length); //截取掉doc节点，得到新的字符串

          continue; //验证doc节点完成 继续循环
        } // End tag:


        var endTagMatch = html.match(endTag); //验证当前是否为结束节点

        if (endTagMatch) {
          //如果是 数据将会是这样[ '</div>', 'div'] 
          var curIndex = index; //缓存当前的全局字符串索引 

          advance(endTagMatch[0].length); //截取当前全局字符串并更新html及index 

          parseEndTag(endTagMatch[1], curIndex, index); //传入当前结束标签名称及当前未更新过后的index及更新过后的index

          continue; //完成任务继续循环
        } // Start tag:


        var startTagMatch = parseStartTag(); //解析开始节点并返回数据

        if (startTagMatch) {
          //如果是一个完整的标签的话 
          handleStartTag(startTagMatch); //格式化完数据并存储成功，通知完毕，结束他的任务

          if (shouldIgnoreFirstNewline(startTagMatch.tagName, html)) {
            //如果当前开头是换行符开头的
            advance(1); //截取掉，并更新html及index
          }

          continue; //完成任务继续循环
        }
      }

      var text = void 0,
          rest = void 0,
          next = void 0;

      if (textEnd >= 0) {
        //解析完开始标签为<的所有有可能的类型后，将会再判断当前是否是一个文本类型或者是一个标签
        rest = html.slice(textEnd); //把当前字符串截取掉，确保是以<开头的位置

        while (!endTag.test(rest) && //如果当前这个字符串标签不是结束标签
        !startTagOpen.test(rest) && //不是一个正常的开始标签
        !comment.test(rest) && //不是一个注释节点
        !conditionalComment.test(rest) //不是一个条件注释节点
        ) {
          //说白了 必须是一个字符串类型的才能走进来分析
          // < in plain text, be forgiving and treat it as text
          next = rest.indexOf('<', 1); //查找下一个<开头的符号，并重第一个开始之后找

          if (next < 0) break; //如果当前类似于<开头的标签没找到了，没必要找了，直接返回

          textEnd += next; //继续更新当前标签位置

          rest = html.slice(textEnd); //接续截取
        }

        text = html.substring(0, textEnd); //获取到已经验证完毕的字符串 确定完这是一个文本类型
      }

      if (textEnd < 0) {
        //这里更好说了，反正没找到类似<的标签，直接把你当字符串就行了 
        text = html;
      }

      if (text) {
        //如果当前这个字符串为真
        advance(text.length); //继续截取整个html和更新index
      }

      if (options.chars && text) {
        //如果有传递这个chars回调方法,并且字符串是存在的情况下
        options.chars(text, index - text.length, index); //开始传递过去，包括当前字符串 、开始位置、结束位置
      }
    } else {
      (function () {
        //当前标签存在 并且是一个已知排除的标签
        var endTagLength = 0; //声明一个变量并 设置当前默认值为0  当前结束标签的长度

        var stackedTag = lastTag.toLowerCase(); //当前标签名称的小写状态

        var reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i')); //正则匹配当前标签的结束已前的所有字符 并缓存到当前模块下

        var rest = html.replace(reStackedTag, function (all, text, endTag) {
          //使用一个方法 替换相关的所有数据
          endTagLength = endTag.length; //赋值当前节点名称的长度

          if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
            //当前标签名称不是已知的script，style，textarea 并且也不是noscript标签
            text = text.replace(/<!\--([\s\S]*?)-->/g, '$1') // #7298
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1');
          }

          if (shouldIgnoreFirstNewline(stackedTag, text)) {
            //匹配当前标签下的内容是否需要换行 第一个位置上
            text = text.slice(1); //需要则去除第一个换行符
          }

          if (options.chars) {
            //继续  如果当前chars回调方法有传递 则继续传递
            options.chars(text); //执行回调 只传递了一个当前字符串
          }

          return ''; //并返回一个空字符串来替换所有正则匹配到的
        });
        index += html.length - rest.length; //继续更新index 及html

        html = rest;
        parseEndTag(stackedTag, index - endTagLength, index); //标记当前是否为一个完整的标签
      })();
    }

    if (html === last) {
      //如果当前什么都没做？ 说明是一个标签但是没有写全哦
      options.chars && options.chars(html);

      if ("development" !== 'production' && !stack.length && options.warn) {
        //开发环境下给出警告
        options.warn("Mal-formatted tag at end of template: \"".concat(html, "\""), {
          start: index + html.length
        });
      }

      break;
    }
  } // Clean up any remaining tags


  parseEndTag();
  /**
   * 根据传递过来的字符串索引，截取字符串及获取到新字符串的起始位置
   * @param {*} n 
   */

  function advance(n) {
    index += n;
    html = html.substring(n);
  }
  /**
   * 解析开始节点
   * 主要是获取当前是否为一个完整的标签 如果是则返回标签名称、标签的开始位置、标签类型、标签的属性值。否则返回undefined
   * 
   */


  function parseStartTag() {
    var start = html.match(startTagOpen); //匹配到当前节点的开始下标为0的（‘<’ 加 ‘标签名’）和下标为一的标签名

    if (start) {
      //如果当前匹配到了
      var match = {
        //重新组织数据
        tagName: start[1],
        //获取到当前的标签名
        attrs: [],
        //声明一个空数据来存储数据
        start: index //当前开始节点在整个字符串中的位置

      };
      advance(start[0].length); //继续截取掉已经验证过的字符串，并返回新的字符串

      var end, attr; //声明两个变量

      while (!(end = html.match(startTagClose)) && (attr = html.match(dynamicArgAttribute) || html.match(attribute))) {
        //如果当前没有匹配到开始标签的闭合部分并且在匹配到属性的情况下继续，直到匹配到了结束标签
        attr.start = index; //把当前的开始位置赋值接start属性

        advance(attr[0].length); //并重新截取掉已经验证过的字符 得到新的字符及位置

        attr.end = index; //赋值结束位置

        match.attrs.push(attr); //再赋值当前标签的属性
      }

      if (end) {
        //再次判断当前结束标签是否存在 如果当前结束标签是存在的则为一个完整的标签 
        match.unarySlash = end[1]; //给定当前是否为一个一元标签

        advance(end[0].length); //继续更新字符串

        match.end = index; //新的位置

        return match; //返回当前match对象
      }
    }
  }
  /**
   * 此方法总体来说就是格式化已知的属性对象，并调用回调的start方法通知。存储当前非一元标签的值到stack中，并更新最近一个标签名称lastTag
   * 
   * @param {*} match 包含当前开始标签的所有信息 
   */


  function handleStartTag(match) {
    var tagName = match.tagName; //首先我们缓存当前的节点名称

    var unarySlash = match.unarySlash; //继续缓存当前标签是否为一元标签

    if (expectHTML) {
      if (lastTag === 'p' && (0, _util2.isNonPhrasingTag)(tagName)) {
        parseEndTag(lastTag);
      }

      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        parseEndTag(tagName);
      }
    }

    var unary = isUnaryTag(tagName) || !!unarySlash; //优先判断当前标签名称是否为一个一元标签，否者就取当前unarySlash值作为值

    var l = match.attrs.length; //缓存一个属性对象的长度

    var attrs = new Array(l); //并重新创建一个新的数组

    for (var i = 0; i < l; i++) {
      var args = match.attrs[i]; //便利当前数组 并获取到每个值

      var value = args[3] || args[4] || args[5] || ''; //获取到当前最终属性的值

      var shouldDecodeNewlines = tagName === 'a' && args[1] === 'href' //如果当前标签名是'a'标签并且属性名为'href'
      ? options.shouldDecodeNewlinesForHref //使用a标签 要对 a 标签的 href 属性值中的换行符或制表符做兼容处理
      : options.shouldDecodeNewlines; //要对属性值中的换行符或制表符做兼容处理

      attrs[i] = {
        name: args[1],
        //获取到属性名
        value: decodeAttr(value, shouldDecodeNewlines) //返回最终处理过后的value值

      };

      if ("development" !== 'production' && options.outputSourceRange) {
        //如果当前是非开发环境下并且outputSourceRange值为真
        attrs[i].start = args.start + args[0].match(/^\s*/).length; //继续添加属性start

        attrs[i].end = args.end; //继续添加属性end
      }
    }

    if (!unary) {
      //如果当前不是一个一元标签
      stack.push({
        tag: tagName,
        lowerCasedTag: tagName.toLowerCase(),
        attrs: attrs,
        start: match.start,
        end: match.end
      }); //存储当前非一元标签的名称、小写节点名称、格式化后的属性及value、节点的起始位置接开始位置

      lastTag = tagName; //把最新的标签名称赋值到lastTag上
    }

    if (options.start) {
      //如果当前有传递start方法的情况下
      options.start(tagName, attrs, unary, match.start, match.end); //则调用并回调给 节点名称、节点属性对象、是否为一元标签、开始位置、结束位置
    }
  }
  /**
   * 此方法主要是验证当前结束标签是否存在解析完成，没有就给出警告，并处理特殊标签br及p标签
   * 
   * @param {*} tagName  //结束标签名称
   * @param {*} start   //结束标签在全局字符串下的开始位置
   * @param {*} end //结束标签在全局字符串下的结束位置
   */


  function parseEndTag(tagName, start, end) {
    var pos, lowerCasedTagName; //声明两个变量

    if (start == null) start = index; //如果当前start没有则使用index

    if (end == null) end = index; //如果当前end没有则使用index
    // Find the closest opened tag of the same type

    if (tagName) {
      //如果当前结束标签存在
      lowerCasedTagName = tagName.toLowerCase(); //转个小写

      for (pos = stack.length - 1; pos >= 0; pos--) {
        //开始循环查找stack中对应的标签
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          //如果找到了
          break; //结束循环
        }
      }
    } else {
      //不存在直接为空处理
      // If no tag name is provided, clean shop
      pos = 0;
    }

    if (pos >= 0) {
      //如果当前pos大于0，为啥会这样呢？因为标签可能会是没有写全的情况下
      // Close all the open elements, up the stack
      for (var i = stack.length - 1; i >= pos; i--) {
        //继续循环stack
        if ("development" !== 'production' && ( //如果当前是在开发环境下
        i > pos || !tagName) && options.warn) {
          //并且当前结束标签不存在
          options.warn("tag <".concat(stack[i].tag, "> has no matching end tag."), //贴出一个警告
          {
            start: stack[i].start,
            end: stack[i].end
          });
        }

        if (options.end) {
          //如果有传递end回调方法
          options.end(stack[i].tag, start, end); //给出end回调 当前节点名称 开始及结束位置
        }
      } // Remove the open elements from the stack


      stack.length = pos; //更新stack数组

      lastTag = pos && stack[pos - 1].tag; //并更新lastTag
    } else if (lowerCasedTagName === 'br') {
      //走到这里就很奇葩了，一般在没写开始标签的情况下都会被浏览器忽略掉 但是br和p标签则不会
      if (options.start) {
        //start回调方法存在？
        options.start(tagName, [], true, start, end); //ok 回调给他
      }
    } else if (lowerCasedTagName === 'p') {
      //p标签也一样
      if (options.start) {
        options.start(tagName, [], false, start, end);
      }

      if (options.end) {
        //只是需要手动补全补全标签
        options.end(tagName, start, end);
      }
    }
  }
}
},{"../../shared/util":"../../src/shared/util.js","../../platforms/web/compiler/util":"../../src/platforms/web/compiler/util.js","../../core/util/lang":"../../src/core/util/lang.js"}],"src/main.js":[function(require,module,exports) {
"use strict";

var _htmlParser = require("../../../src/compiler/parser/html-parser");

var root, cuurentTag;
var stack = [];
(0, _htmlParser.parseHTML)(document.querySelector('#app').outerHTML, {
  // shouldKeepComment:true,
  start: function start(tag, attrs, unary) {
    var vnode = {
      type: 1,
      tag: tag,
      parent: cuurentTag,
      attrs: attrs,
      children: []
    };

    if (!root) {
      root = vnode;
    } else if (cuurentTag) {
      cuurentTag.children.push(vnode);
    }

    if (!unary) {
      cuurentTag = vnode;
      stack.push(cuurentTag);
      console.log(stack);
    }
  },
  end: function end() {
    stack.pop();
    cuurentTag = stack[stack.length - 1];
  }
});
console.log(root);
},{"../../../src/compiler/parser/html-parser":"../../src/compiler/parser/html-parser.js"}],"C:/Users/Administrator/AppData/Roaming/npm/node_modules/parcel-bundler/src/builtins/hmr-runtime.js":[function(require,module,exports) {
var global = arguments[3];
var OVERLAY_ID = '__parcel__error__overlay__';
var OldModule = module.bundle.Module;

function Module(moduleName) {
  OldModule.call(this, moduleName);
  this.hot = {
    data: module.bundle.hotData,
    _acceptCallbacks: [],
    _disposeCallbacks: [],
    accept: function (fn) {
      this._acceptCallbacks.push(fn || function () {});
    },
    dispose: function (fn) {
      this._disposeCallbacks.push(fn);
    }
  };
  module.bundle.hotData = null;
}

module.bundle.Module = Module;
var checkedAssets, assetsToAccept;
var parent = module.bundle.parent;

if ((!parent || !parent.isParcelRequire) && typeof WebSocket !== 'undefined') {
  var hostname = "" || location.hostname;
  var protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  var ws = new WebSocket(protocol + '://' + hostname + ':' + "57161" + '/');

  ws.onmessage = function (event) {
    checkedAssets = {};
    assetsToAccept = [];
    var data = JSON.parse(event.data);

    if (data.type === 'update') {
      var handled = false;
      data.assets.forEach(function (asset) {
        if (!asset.isNew) {
          var didAccept = hmrAcceptCheck(global.parcelRequire, asset.id);

          if (didAccept) {
            handled = true;
          }
        }
      }); // Enable HMR for CSS by default.

      handled = handled || data.assets.every(function (asset) {
        return asset.type === 'css' && asset.generated.js;
      });

      if (handled) {
        console.clear();
        data.assets.forEach(function (asset) {
          hmrApply(global.parcelRequire, asset);
        });
        assetsToAccept.forEach(function (v) {
          hmrAcceptRun(v[0], v[1]);
        });
      } else {
        window.location.reload();
      }
    }

    if (data.type === 'reload') {
      ws.close();

      ws.onclose = function () {
        location.reload();
      };
    }

    if (data.type === 'error-resolved') {
      console.log('[parcel] ✨ Error resolved');
      removeErrorOverlay();
    }

    if (data.type === 'error') {
      console.error('[parcel] 🚨  ' + data.error.message + '\n' + data.error.stack);
      removeErrorOverlay();
      var overlay = createErrorOverlay(data);
      document.body.appendChild(overlay);
    }
  };
}

function removeErrorOverlay() {
  var overlay = document.getElementById(OVERLAY_ID);

  if (overlay) {
    overlay.remove();
  }
}

function createErrorOverlay(data) {
  var overlay = document.createElement('div');
  overlay.id = OVERLAY_ID; // html encode message and stack trace

  var message = document.createElement('div');
  var stackTrace = document.createElement('pre');
  message.innerText = data.error.message;
  stackTrace.innerText = data.error.stack;
  overlay.innerHTML = '<div style="background: black; font-size: 16px; color: white; position: fixed; height: 100%; width: 100%; top: 0px; left: 0px; padding: 30px; opacity: 0.85; font-family: Menlo, Consolas, monospace; z-index: 9999;">' + '<span style="background: red; padding: 2px 4px; border-radius: 2px;">ERROR</span>' + '<span style="top: 2px; margin-left: 5px; position: relative;">🚨</span>' + '<div style="font-size: 18px; font-weight: bold; margin-top: 20px;">' + message.innerHTML + '</div>' + '<pre>' + stackTrace.innerHTML + '</pre>' + '</div>';
  return overlay;
}

function getParents(bundle, id) {
  var modules = bundle.modules;

  if (!modules) {
    return [];
  }

  var parents = [];
  var k, d, dep;

  for (k in modules) {
    for (d in modules[k][1]) {
      dep = modules[k][1][d];

      if (dep === id || Array.isArray(dep) && dep[dep.length - 1] === id) {
        parents.push(k);
      }
    }
  }

  if (bundle.parent) {
    parents = parents.concat(getParents(bundle.parent, id));
  }

  return parents;
}

function hmrApply(bundle, asset) {
  var modules = bundle.modules;

  if (!modules) {
    return;
  }

  if (modules[asset.id] || !bundle.parent) {
    var fn = new Function('require', 'module', 'exports', asset.generated.js);
    asset.isNew = !modules[asset.id];
    modules[asset.id] = [fn, asset.deps];
  } else if (bundle.parent) {
    hmrApply(bundle.parent, asset);
  }
}

function hmrAcceptCheck(bundle, id) {
  var modules = bundle.modules;

  if (!modules) {
    return;
  }

  if (!modules[id] && bundle.parent) {
    return hmrAcceptCheck(bundle.parent, id);
  }

  if (checkedAssets[id]) {
    return;
  }

  checkedAssets[id] = true;
  var cached = bundle.cache[id];
  assetsToAccept.push([bundle, id]);

  if (cached && cached.hot && cached.hot._acceptCallbacks.length) {
    return true;
  }

  return getParents(global.parcelRequire, id).some(function (id) {
    return hmrAcceptCheck(global.parcelRequire, id);
  });
}

function hmrAcceptRun(bundle, id) {
  var cached = bundle.cache[id];
  bundle.hotData = {};

  if (cached) {
    cached.hot.data = bundle.hotData;
  }

  if (cached && cached.hot && cached.hot._disposeCallbacks.length) {
    cached.hot._disposeCallbacks.forEach(function (cb) {
      cb(bundle.hotData);
    });
  }

  delete bundle.cache[id];
  bundle(id);
  cached = bundle.cache[id];

  if (cached && cached.hot && cached.hot._acceptCallbacks.length) {
    cached.hot._acceptCallbacks.forEach(function (cb) {
      cb();
    });

    return true;
  }
}
},{}]},{},["C:/Users/Administrator/AppData/Roaming/npm/node_modules/parcel-bundler/src/builtins/hmr-runtime.js","src/main.js"], null)
//# sourceMappingURL=/main.1e43358e.js.map