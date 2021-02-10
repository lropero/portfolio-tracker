#!/usr/bin/env node
/**
 * Copyright (c) 2021, Luciano Ropero <lropero@gmail.com>
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

const blessed = require('blessed')
const chalk = require('chalk')
const CoinMarketCap = require('coinmarketcap-api')
const dotenv = require('dotenv')
const { arrowDown, arrowUp } = require('figures')
const { delay, repeat, retryWhen, switchMap, tap } = require('rxjs/operators')
const { of } = require('rxjs')

const portfolio = require('./portfolio.json')
const { version } = require('./package.json')

dotenv.config()

const client = new CoinMarketCap(process.env.APIKEY)
const screen = blessed.screen({ smartCSR: true })
const symbols = Object.keys(portfolio)
const maxSymbolLength = Math.max(...symbols.map(symbol => symbol.length))
let previous = {}

const appendDisplay = () => {
  const display = blessed.box({
    height: '100%',
    style: { bg: 'black' },
    width: '100%'
  })
  screen.append(display)
  return getDraw(display)
}

const appendHeader = title => {
  screen.append(
    blessed.box({
      content: ` ${chalk.green(title)}  ${chalk.gray('Like it? Share the love :) 1B7owVfYhLjWLh9NWivQAKJHBcf8Doq54i (BTC)')}  ${chalk.white('q')}${chalk.gray('uit')}`,
      height: 'shrink',
      style: { bg: 'blue' },
      width: '100%'
    })
  )
}

const formatMoney = number => {
  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    style: 'currency'
  }).format(number)
}

const getArrow = (symbol, value) => {
  return Object.keys(previous).length ? (previous.values[symbol] > value ? chalk.red(arrowDown) : previous.values[symbol] < value ? chalk.green(arrowUp) : chalk.blue('=')) : chalk.gray('\u00B7')
}

const getBar = (maxValue, total, value) => {
  const bar = []
  const max = (maxValue * 100) / total
  let percentage = (value * 100) / total
  for (let i = 0; i <= max; i++) {
    bar.push(percentage-- > 0 ? chalk.magenta('\u2588') : chalk.gray('\u2591'))
  }
  return bar.join('')
}

const getChange = (current, previous) => {
  return `${current - previous > 0 ? '+' : ''}${(((current - previous) * 100) / previous).toFixed(1)}%`
}

const getColor = (symbol, value) => {
  return Object.keys(previous).length ? (previous.values[symbol] > value ? 'red' : previous.values[symbol] < value ? 'green' : 'blue') : 'white'
}

const getColorTotal = total => {
  return Object.keys(previous).length ? (previous.total > total ? 'red' : previous.total < total ? 'green' : 'blue') : 'white'
}

const getColorTotalBTC = totalBTC => {
  return Object.keys(previous).length ? (previous.totalBTC > totalBTC ? 'red' : previous.totalBTC < totalBTC ? 'green' : 'blue') : 'white'
}

const getDraw = display => quotes => {
  const values = Object.fromEntries(
    Object.entries(
      symbols.reduce((values, symbol) => {
        values[symbol] = portfolio[symbol] * quotes[symbol]
        return values
      }, {})
    ).sort((a, b) => b[1] - a[1])
  )
  const changes =
    !!Object.keys(previous).length &&
    symbols.reduce((changes, symbol) => {
      changes[symbol] = getChange(values[symbol], previous.values[symbol])
      return changes
    }, {})
  const maxChangeLength = changes && Math.max(...Object.values(changes).map(change => change.length))
  const maxValue = Math.max(...Object.values(values))
  const total = Object.values(values).reduce((total, value) => total + value, 0)
  const totalBTC = total / quotes.BTC
  display.setContent(
    `\n\n${Object.keys(values)
      .map(symbol => `  ${chalk.yellow(symbol.padStart(maxSymbolLength))} ${getArrow(symbol, values[symbol])} ${getBar(maxValue, total, values[symbol])} ${chalk[getColor(symbol, values[symbol])](formatMoney(values[symbol]).padEnd(formatMoney(maxValue).length))} ${changes ? chalk.cyan(changes[symbol].padEnd(maxChangeLength)) : ''} ${chalk.gray(`${chalk.inverse(formatMoney(quotes[symbol]))}\u00B7${portfolio[symbol]}`)}`)
      .join('\n')}\n\n${chalk.cyan('TOTAL'.padStart(maxSymbolLength + 10))} ${chalk[getColorTotal(total)](formatMoney(total))}${previous.total ? ` ${chalk.cyan(getChange(total, previous.total))}` : ''} ${chalk.gray('-')} ${chalk[getColorTotalBTC(totalBTC)](`${totalBTC} BTC`)}${previous.totalBTC ? ` ${chalk.cyan(getChange(totalBTC, previous.totalBTC))}` : ''}`
  )
  previous = { total, totalBTC, values }
  screen.render()
}

const start = () => {
  const title = `Portfolio tracker v${version}`
  screen.title = title
  const draw = appendDisplay()
  appendHeader(title)
  screen.key('q', () => process.exit())
  screen.render()
  of({})
    .pipe(
      switchMap(() => updateQuotes()),
      retryWhen(errors => errors.pipe(delay(1000 * 60 * process.env.DELAY))),
      tap(draw),
      delay(1000 * 60 * process.env.DELAY),
      repeat()
    )
    .subscribe()
}

const updateQuotes = async () => {
  const symbolsIncludingBTC = symbols.includes('BTC') ? symbols : ['BTC', ...symbols]
  const { data } = await client.getQuotes({ symbol: symbolsIncludingBTC })
  const quotes = symbolsIncludingBTC.reduce((quotes, symbol) => {
    quotes[symbol] = data[symbol].quote.USD.price
    return quotes
  }, {})
  return quotes
}

start()
