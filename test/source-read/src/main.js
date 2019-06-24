import { parseHTML } from '../../../src/compiler/parser/html-parser'
parseHTML(document.querySelector('#app').outerHTML,{
    shouldKeepComment:true,
    start(...args){
        console.log(args)
    },  
    // end(...args){
    //     console.log(args)
    // },
    // chars(...args){
    //     console.log(args)
    // },
    comment(...args){
        console.log(args)
    }

})