import { parseHTML } from "../../../src/compiler/parser/html-parser";

let root, cuurentTag;
const stack = [];

parseHTML(document.querySelector("#app").outerHTML, {
  // shouldKeepComment:true,
  start(tag, attrs, unary) {
    const vnode = {
      type: 1,
      tag,
      parent: cuurentTag,
      attrs,
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
  end(...args) {
    stack.pop();
    cuurentTag = stack[stack.length - 1];
  }
  // chars(...args){
  //     console.log(args)
  // },
  // comment(...args){
  //     console.log(args)
  // }
});
console.log(root);
