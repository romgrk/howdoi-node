/*
 * howdoi.js
 */

const TurndownService = require('turndown')
const cheerio = require('cheerio')
const request = require('request-promise-native')

const requestHTML = request.defaults({
  proxy: process.env.HTTP_PROXY ? process.env.HTTP_PROXY : undefined,
  headers: {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.45 Safari/537.36'
  },
  transform: body => cheerio.load(body)
})

const turndownService = new TurndownService()

module.exports = howdoi

/*
// Usage:
require('util').inspect.defaultOptions = { depth: 5 }
howdoi({
  query: '.sr-only',
  results: 5,
  answers: 1,
  result: 0,
  answer: 0,
  resultsOnly: false,
  codeOnly: true,
})
.then(console.log, console.error)
*/

/**
 * A howdoi answer
 * @typedef Answer
 * @property {boolean} isAccepted
 * @property {string} language
 * @property {string} code
 * @property {string} [text]
 * @property {string} [html]
 *
 */
/**
 * A howdoi search result
 * @typedef Result
 * @property {string} title
 * @property {string} url
 * @property {string} [tag]
 * @property {Answer[]} answers
 */

/**
 * @param {Object} options
 * @param {string} options.query The search query
 * @param {string} [options.engine='duck'] The search engine ('duck' only for the moment)
 * @param {string} [options.site='stackoverflow.com'] StackExchange site to search
 * @param {number} [options.results=1] Number of results to load
 * @param {number} [options.answers=5] Number of answers to load
 * @param {number} [options.result] Index of result to load
 * @param {number} [options.answer] Index of answer to load
 * @param {boolean} [options.codeOnly=false] Extract code only
 * @param {boolean} [options.resultsOnly=false] Extract results only
 * @returns {Result[]}
 */
function howdoi(options) {
  options.engine = options.engine || 'duck'
  options.site = options.site || 'stackoverflow.com'
  options.results = options.results || 1
  options.answers = options.answers || 5
  options.codeOnly = options.codeOnly !== undefined ? options.codeOnly : false
  options.resultsOnly = options.resultsOnly !== undefined ? options.resultsOnly : false

  const hasResult = options.result !== undefined
  const hasAnswer = options.answer !== undefined

  const details = getEngineDetails(options)

  return requestHTML(details.url)
  .then($ => {

    const links = $(details.linksSelector)
      .map((i, el) => ({
        title: getTitle($(el).text()),
        tag: getTag($(el).text()),
        url: el.attribs.href
      }))
      .slice(0, options.results)

    const link = hasResult ?  links[options.result] : undefined

    if (links.length === 0)
      return options.resultsOnly ? link : []

    if (options.resultsOnly)
      return hasResult ? link : links

    return Promise.all((hasResult ? [link] : links).map(link =>
      requestHTML(link.url)
      .then($ => {
        const answers = $('.answer')
          .map((i, el) => {
            const answer = $(el)
            const element = answer.find('.post-text')

            const codeElement = element.find('pre')

            return options.codeOnly ?
              {
                isAccepted: answer.attr('class').includes('accepted-answer'),
                language: getLang(codeElement.attr('class') || ''),
                code: codeElement.text()
              } :
              {
                isAccepted: answer.attr('class').includes('accepted-answer'),
                text: turndownService.turndown(element.html()),
                html: element.html(),
                language: getLang(codeElement.attr('class') || ''),
                code: codeElement.text()
              }
          })
          .slice(0, options.answers)

        if (hasAnswer)
          return { title: link.title, url: link.url, answers: [answers[options.answer]] }

        return { title: link.title, url: link.url, answers }
      })
    ))
  })
}

function getEngineDetails(options) {
  switch (options.engine) {
    case 'duck':
      return {
        url: 'http://duckduckgo.com/html?q=' + options.query + '+' + encodeURIComponent('site:' + options.site),
        linksSelector: '.result__a'
      }
    /* Not working
    case 'google':
      return {
        url: 'http://www.google.com/cse?cx=003507065920591675867%3Axyxvbg8-oie&ie=UTF-8&q=' + encodeURIComponent(options.query),
        linksSelector: '.r a.l'
      }
    */
    default:
      throw new Error('Unsupported engin')
  }
}

function getTitle(text) {
  const title =
    text.trim()
        .replace(/^[^-]*? - /, '')
        .replace(/ - [^-]*?$/, '')

  return title
}

function getTag(text) {
  const m = text.trim().match(/^(\w+) - /)
  if (m)
    return m[1]
  return undefined
}

function getLang(className) {
  const m = className.match(/lang-(\w+)/)
  if (m)
    return m[1]
  return undefined
}
