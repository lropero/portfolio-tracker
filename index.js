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
const { arrowRight } = require('figures')
const { delay, mergeMap, repeat, tap } = require('rxjs/operators')
const { of } = require('rxjs')

const portfolio = require('./portfolio.json')
const { version } = require('./package.json')

dotenv.config()

const client = new CoinMarketCap(process.env.APIKEY)
const symbols = Object.keys(portfolio)

let previousQuotes
let previousTotal

const display = quotes => {
  const values = symbols.reduce((values, symbol) => {
    values[symbol] = portfolio[symbol] * quotes[symbol]
    return values
  }, {})
  const valuesFormatted = Object.entries(values)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0])
    .reduce((valuesFormatted, symbol) => {
      valuesFormatted[symbol] = chalk[
        previousQuotes ? (previousQuotes[symbol] > quotes[symbol] ? 'red' : previousQuotes[symbol] < quotes[symbol] ? 'green' : 'blue') : 'blue'
      ](
        new Intl.NumberFormat('en-US', {
          currency: 'USD',
          style: 'currency'
        }).format(values[symbol])
      )
      return valuesFormatted
    }, {})
  const total = Object.values(values).reduce((total, value) => total + value, 0)
  logUpdate(
    `${Object.keys(valuesFormatted)
      .map(symbol => `${chalk.yellow(symbol)} ${arrowRight} ${valuesFormatted[symbol]}`)
      .join('\n')}\n${chalk.cyan('TOTAL')} ${chalk[previousTotal ? (previousTotal > total ? 'red' : previousTotal < total ? 'green' : 'blue') : 'blue'](
      new Intl.NumberFormat('en-US', {
        currency: 'USD',
        style: 'currency'
      }).format(total)
    )}`
  )
  previousQuotes = quotes
  previousTotal = total
}

const tracker = of({}).pipe(
  mergeMap(_ => updateQuotes()),
  tap(display),
  delay(1000 * 60 * process.env.DELAY),
  repeat()
)

const updateQuotes = async () => {
  const { data } = await client.getQuotes({ symbol: symbols })
  const quotes = symbols.reduce((quotes, symbol) => {
    quotes[symbol] = data[symbol].quote.USD.price
    return quotes
  }, {})
  return quotes
}

console.log(chalk.green(`Portfolio tracker v${version}`))
console.log(chalk.gray(`Like it? Share the love :) ${arrowRight} 1B7owVfYhLjWLh9NWivQAKJHBcf8Doq54i (BTC)\n`))
tracker.subscribe()
