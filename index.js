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
const jsonfile = require('jsonfile')
const { addMinutes, formatDistance } = require('date-fns')
const { arrowDown, arrowUp } = require('figures')
const { debounceTime, delay, repeat, retryWhen, switchMap, tap } = require('rxjs/operators')
const { fromEvent, of } = require('rxjs')

dotenv.config()

const store = {
  client: new CoinMarketCap(process.env.APIKEY),
  content: { display: { quotes: '', settings: '' }, header: '' },
  currentMode: 'quotes',
  isWindows: process.platform === 'win32',
  last: {},
  screen: blessed.screen({ forceUnicode: true, fullUnicode: true, smartCSR: true })
}

const appendDisplay = () => {
  const { screen } = store
  const display = blessed.box({
    height: '100%',
    style: { bg: 'black' },
    width: '100%'
  })
  screen.append(display)
  store.display = display
}

const appendHeader = () => {
  const { screen } = store
  const header = blessed.box({
    height: 'shrink',
    style: { bg: 'blue' },
    width: '100%'
  })
  screen.append(header)
  store.header = header
}

const calculateChange = (current, previous) => {
  const change = Math.round(((current - previous) * 1000) / previous) / 10
  return [change, `${change > 0 ? '+' : change === 0 ? ' ' : ''}${change.toFixed(1)}%`]
}

const draw = () => {
  const { content, currentMode, display, header, screen } = store
  display.setContent(content.display[currentMode])
  header.setContent(content.header)
  screen.render()
}

const formatMoney = number => {
  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    style: 'currency'
  }).format(number)
}

const getArrow = (symbol, value) => {
  const { isWindows, last } = store
  return last.values ? (last.values[symbol] > value ? chalk.red(arrowDown) : last.values[symbol] < value ? chalk.green(arrowUp) : chalk.blue('=')) : chalk[isWindows ? 'white' : 'gray']('\u00B7')
}

const getBar = (maxValue, total, value) => {
  const { isWindows } = store
  const bar = []
  const max = (maxValue * 100) / total
  let percentage = (value * 100) / total
  for (let i = 0; i <= max; i++) {
    bar.push(percentage-- > 0 ? chalk.magenta('\u2588') : chalk[isWindows ? 'blue' : 'gray']('\u2591'))
  }
  return bar.join('')
}

const getChange = (change, maxChangeLength, maxToMin) => {
  const { isWindows } = store
  return change ? `${chalk[getColorChange(change[0], maxToMin)](change[1].padEnd(maxChangeLength))} ` : chalk[isWindows ? 'white' : 'gray']('\u00B7')
}

const getColorChange = (change, maxToMin) => {
  if (change > 0) {
    switch (maxToMin.filter(change => change > 0).indexOf(change)) {
      case 0:
        return 'bgGreen'
      case 1:
        return 'bgYellow'
      case 2:
        return 'bgCyan'
    }
  }
  if (change < 0) {
    switch (
      maxToMin
        .filter(change => change < 0)
        .reverse()
        .indexOf(change)
    ) {
      case 0:
        return 'bgRed'
      case 1:
        return 'bgMagenta'
      case 2:
        return 'bgBlue'
    }
  }
  return 'cyan'
}

const getColorMoney = (symbol, value) => {
  const { last } = store
  return last.values ? (last.values[symbol] > value ? 'red' : last.values[symbol] < value ? 'green' : 'blue') : 'white'
}

const getColorTotal = total => {
  const { last } = store
  return last.total ? (last.total > total ? 'red' : last.total < total ? 'green' : 'blue') : 'white'
}

const getColorTotalBTC = totalBTC => {
  const { last } = store
  return last.totalBTC ? (last.totalBTC > totalBTC ? 'red' : last.totalBTC < totalBTC ? 'green' : 'blue') : 'white'
}

const getQuotes = async symbols => {
  const { client } = store
  const symbolsIncludingBTC = symbols.includes('BTC') ? symbols : ['BTC', ...symbols]
  const { data } = await client.getQuotes({ symbol: symbolsIncludingBTC })
  return symbolsIncludingBTC.reduce((quotes, symbol) => {
    quotes[symbol] = data[symbol].quote.USD.price
    return quotes
  }, {})
}

const start = async () => {
  const { isWindows, screen } = store
  const { version } = await jsonfile.readFile('./package.json')
  const portfolio = await jsonfile.readFile('./portfolio.json')
  const symbols = Object.keys(portfolio)
  const maxSymbolLength = Math.max(...symbols.map(symbol => symbol.length))
  const title = `Portfolio tracker v${version}`
  const headerContent = screenWidth => ` ${chalk.green(title)}${`${store.currentMode === 'quotes' && store.last.time ? `${chalk.cyan(`next refresh ${formatDistance(addMinutes(store.last.time, process.env.DELAY), Date.now(), { addSuffix: true, includeSeconds: true })}`)}` : ''}  ${chalk.white('s')}${chalk.cyan(store.currentMode === 'quotes' ? 'ettings' : 'ave')} ${chalk.white('q')}${chalk.cyan('uit')}`.padStart(screenWidth + (store.currentMode === 'quotes' && store.last.time ? 24 : 14))}`
  appendDisplay()
  appendHeader()
  screen.key('q', () => process.exit())
  screen.key('s', () => {
    store.currentMode = store.currentMode === 'quotes' ? 'settings' : 'quotes'
    store.content.header = headerContent(screen.width)
    draw()
  })
  screen.title = title
  store.content.header = headerContent(screen.width)
  store.content.display.settings = `\n\n${symbols.map(symbol => `  ${chalk.yellow(symbol.padStart(maxSymbolLength))} ${chalk[isWindows ? 'white' : 'gray'](portfolio[symbol])}`).join('\n')}`
  draw()
  fromEvent(screen, 'resize')
    .pipe(debounceTime(50))
    .subscribe(() => {
      if (store.currentMode === 'quotes') {
        store.content.header = headerContent(screen.width)
        draw()
      }
    })
  of({})
    .pipe(
      switchMap(() => getQuotes(symbols)),
      retryWhen(errors =>
        errors.pipe(
          tap(() => {
            store.last = { time: Date.now() }
          }),
          delay(1000 * 60 * process.env.DELAY)
        )
      ),
      tap(quotes => {
        const values = Object.fromEntries(
          Object.entries(
            symbols.reduce((values, symbol) => {
              values[symbol] = portfolio[symbol] * quotes[symbol]
              return values
            }, {})
          ).sort((a, b) => b[1] - a[1])
        )
        const changes =
          !!store.last.values &&
          symbols.reduce((changes, symbol) => {
            changes[symbol] = calculateChange(values[symbol], store.last.values[symbol])
            return changes
          }, {})
        const maxChangeLength = changes && Math.max(...Object.values(changes).map(change => change[1].length))
        const maxToMin = [
          ...new Set(
            Object.values(changes)
              .map(change => change[0])
              .sort((a, b) => b - a)
          )
        ]
        const maxValue = Math.max(...Object.values(values))
        const total = Object.values(values).reduce((total, value) => total + value, 0)
        const totalBTC = Math.round((total * 100000000) / quotes.BTC) / 100000000
        store.content.display.quotes = `\n\n${Object.keys(values)
          .map(symbol => `  ${chalk.yellow(symbol.padStart(maxSymbolLength))} ${getArrow(symbol, values[symbol])} ${getBar(maxValue, total, values[symbol])} ${chalk[getColorMoney(symbol, values[symbol])](formatMoney(values[symbol]).padStart(formatMoney(maxValue).length))} ${getChange(changes[symbol], maxChangeLength, maxToMin)} ${chalk[isWindows ? 'white' : 'gray'](`${chalk.inverse(formatMoney(quotes[symbol]))}\u00B7${portfolio[symbol]}`)}`)
          .join('\n')}\n\n${``.padStart(maxSymbolLength + 5)}${chalk.cyan('TOTAL')} ${chalk[getColorTotal(total)](formatMoney(total))}${store.last.total ? ` ${chalk.cyan(calculateChange(total, store.last.total)[1].trim())}` : ''} ${chalk[isWindows ? 'yellow' : 'gray']('-')} ${chalk[getColorTotalBTC(totalBTC)](`${totalBTC} BTC`)}${store.last.totalBTC ? ` ${chalk.cyan(calculateChange(totalBTC, store.last.totalBTC)[1].trim())}` : ''}\n${``.padStart(maxSymbolLength + 5)}${chalk[isWindows ? 'yellow' : 'gray'](`Like it? Buy me a ${isWindows ? 'beer' : '🍺'} :) 1B7owVfYhLjWLh9NWivQAKJHBcf8Doq54i (BTC) `)}`
        store.last = { time: Date.now(), total, totalBTC, values }
        store.content.header = headerContent(screen.width)
        draw()
      }),
      delay(1000 * 60 * process.env.DELAY),
      repeat()
    )
    .subscribe()
  of({})
    .pipe(
      delay(5000),
      tap(() => {
        if (store.currentMode === 'quotes') {
          store.content.header = headerContent(screen.width)
          draw()
        }
      }),
      repeat()
    )
    .subscribe()
}

start()
