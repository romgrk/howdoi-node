/*
 * howdoi.js
 */

const TurndownService = require('turndown')
const cheerio = require('cheerio')
const request = require('request-promise-native')

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.7; rv:11.0) Gecko/20100101 Firefox/11.0',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:22.0) Gecko/20100 101 Firefox/22.0',
  'Mozilla/5.0 (Windows NT 6.1; rv:11.0) Gecko/20100101 Firefox/11.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_4) AppleWebKit/536.5 (KHTML, like Gecko) Chrome/19.0.1084.46 Safari/536.5',
  'Mozilla/5.0 (Windows; Windows NT 6.1) AppleWebKit/536.5 (KHTML, like Gecko) Chrome/19.0.1084.46 Safari/536.5',
]

const requestHTML = uri =>
  request({
    uri: uri,
    proxy: process.env.HTTP_PROXY ? process.env.HTTP_PROXY : undefined,
    headers: {
      'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
    },
    transform: body => cheerio.load(body),
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
  // result: 0,
  // answer: 0,
  resultsOnly: false,
  codeOnly: true,
  engine: 'google',
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
 * @param {string} [options.engine='google'] The search engine ('google', 'duck', 'bing')
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
  options.engine = options.engine || 'google'
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

    return Promise.all((hasResult ? [link] : links).map((link, i) => {

      return requestHTML(link.url)
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
    }))
  })
}

function getEngineDetails(options) {
  switch (options.engine) {
    case 'duck':
      return {
        url: 'https://duckduckgo.com/html?q=' + options.query + encodeURIComponent(' site:' + options.site),
        linksSelector: '.result__a'
      }
    case 'google':
      return {
        url: 'https://www.google.com/search?q=' + options.query + encodeURIComponent(' site:' + options.site),
        linksSelector: '.r a'
      }
    case 'bing':
      return {
        url: 'https://www.bing.com/search?q=' + options.query + encodeURIComponent(' site:' + options.site),
        linksSelector: '#b_results li > *:first-child > a'
      }
    default:
      throw new Error('Unsupported engine')
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
