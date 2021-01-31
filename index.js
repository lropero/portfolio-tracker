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

const chalk = require('chalk')
const CoinMarketCap = require('coinmarketcap-api')
const dotenv = require('dotenv')
const logUpdate = require('log-update')
const { arrowDown, arrowRight, arrowUp } = require('figures')
const { delay, repeat, retryWhen, switchMap, tap } = require('rxjs/operators')
const { of } = require('rxjs')

const portfolio = require('./portfolio.json')
const { version } = require('./package.json')

dotenv.config()

const client = new CoinMarketCap(process.env.APIKEY)
const symbols = Object.keys(portfolio)
let previousTotal
let previousTotalBTC
let previousValues

const display = quotes => {
  const values = Object.fromEntries(
    Object.entries(
      symbols.reduce((values, symbol) => {
        values[symbol] = portfolio[symbol] * quotes[symbol]
        return values
      }, {})
    ).sort((a, b) => b[1] - a[1])
  )
  const maxValue = Math.max(...Object.values(values))
  const total = Object.values(values).reduce((total, value) => total + value, 0)
  const totalBTC = total / quotes.BTC
  logUpdate(
    `${Object.keys(values)
      .map(symbol => `${chalk[getColor(values[symbol], previousValues?.[symbol])](getArrow(values[symbol], previousValues?.[symbol]))} ${getBar(maxValue, total, values[symbol])} ${chalk.yellow(symbol)} ${chalk.gray(arrowRight)} ${chalk[getColor(values[symbol], previousValues?.[symbol])](formatMoney(values[symbol]))} ${chalk.gray(`${portfolio[symbol]} x ${chalk.inverse(formatMoney(quotes[symbol]))}`)}`)
      .join('\n')}\n${chalk.cyan('TOTAL')} ${chalk[getColor(total, previousTotal)](formatMoney(total))} ${chalk.gray('-')} ${chalk[getColor(totalBTC, previousTotalBTC)](`${totalBTC} BTC`)}`
  )
  previousTotal = total
  previousTotalBTC = totalBTC
  previousValues = values
}

const formatMoney = number => {
  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    style: 'currency'
  }).format(number)
}

const getArrow = (current, previous) => {
  return previous ? (previous > current ? arrowDown : previous < current ? arrowUp : '=') : '-'
}

const getBar = (maxValue, total, value) => {
  const bar = []
  const max = (maxValue * 100) / total
  let percentage = (value * 100) / total
  for (let i = 0; i <= max; i++) {
    bar.push(percentage-- > 0 ? chalk.blue('\u2588') : chalk.gray('\u2591'))
  }
  return bar.join('')
}

const getColor = (current, previous) => {
  return previous ? (previous > current ? 'red' : previous < current ? 'green' : 'blue') : 'white'
}

const tracker = of({}).pipe(
  switchMap(() => updateQuotes()),
  retryWhen(errors => errors.pipe(delay(1000 * 60 * process.env.DELAY))),
  tap(display),
  delay(1000 * 60 * process.env.DELAY),
  repeat()
)

const updateQuotes = async () => {
  const symbolsIncludingBTC = symbols.includes('BTC') ? symbols : ['BTC', ...symbols]
  const { data } = await client.getQuotes({ symbol: symbolsIncludingBTC })
  const quotes = symbolsIncludingBTC.reduce((quotes, symbol) => {
    quotes[symbol] = data[symbol].quote.USD.price
    return quotes
  }, {})
  return quotes
}

console.log(chalk.green(`Portfolio tracker v${version}`))
console.log(chalk.gray(`Like it? Share the love :) 1B7owVfYhLjWLh9NWivQAKJHBcf8Doq54i (BTC)\n`))
tracker.subscribe()
