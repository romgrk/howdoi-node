#!/usr/bin/env node

const clc = require('cli-color')
const ansiTrim = require('cli-color/trim')

const howdoi = require('./howdoi.js')

const args = require('optimist')
    .default({
        engine: 'google',
        site: 'stackoverflow.com',
        results: 1,
        answers: 1,
        color: true,
        codeOnly: false,
        links: false
    })
    .describe('engine', 'google, duck, or bing')
    .describe('site', 'stackexchange site to search')
    .describe('results', 'number of search result')
    .describe('answers', 'number of answer')
    .describe('result', 'which search result')
    .describe('answer', 'which answer')
    .describe('codeOnly', 'extract only code')
    .describe('links', 'show all links')
    .describe('color', 'show results in plain text (default: color)')
    .boolean('color')
    .demand(1)
    .argv;


const query = args._.join(' ').replace(/\^/g,'-');

const style = {
  error: clc.red,
  code: clc.green,
  link: clc.bold,
  title: clc.bold.yellow,
  answer: clc.bold.yellow,
  answerAccepted: clc.bold.green
}

const log = args.color === true ? console.log : function() {
  const args = [].slice.call(arguments).map(a => typeof a === 'string' ? ansiTrim(a) : a)
  console.log.apply(this, args);
}


howdoi({ ...args, query })
.then(results => {

  if (results.length === 0) {
    log(style.error('No results found'))
    return
  }

  results.forEach((result, i) => {

    log(style.title('#' + (i + 1) + ' ' + result.title) + ' ' + style.link('@' + result.url) );

    if (result.answers.length === 0) {
      log(style.error('Result has no answers. Try some other results e.g. --result 2') );
      return
    }

    result.answers.forEach((answer, j) => {
      const n = j + 1
      const header = answer.isAccepted ?
        style.answerAccepted('✔ Answer ' + n) :
        style.answer('• Answer ' + n)

      const text =
        header + '\n'
        + (answer.text ? answer.text.replace(/\n\n\n+/g, '\n\n') : style.code(answer.code))

      log(text)
    })
  })
})
