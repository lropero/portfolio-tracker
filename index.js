const chalk = require('chalk')
const CoinMarketCap = require('coinmarketcap-api')
const dotenv = require('dotenv')
const { arrowRight } = require('figures')

const portfolio = require('./portfolio')

dotenv.config()

const run = async () => {
  const client = new CoinMarketCap(process.env.APIKEY)
  const symbols = Object.keys(portfolio)
  const { data } = await client.getQuotes({ symbol: symbols })
  const quotes = symbols.reduce((quotes, symbol) => {
    quotes[symbol] = data[symbol].quote.USD.price
    return quotes
  }, {})
  const values = symbols.reduce((values, symbol) => {
    values[symbol] = portfolio[symbol] * quotes[symbol]
    return values
  }, {})
  const valuesFormatted = Object.entries(values)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0])
    .reduce((valuesFormatted, symbol) => {
      valuesFormatted[symbol] = new Intl.NumberFormat('es-AR', {
        currency: 'USD',
        style: 'currency'
      }).format(values[symbol])
      return valuesFormatted
    }, {})
  Object.keys(valuesFormatted).forEach(symbol => {
    console.log(
      `${chalk.yellow(symbol)} ${arrowRight} ${chalk.green(
        valuesFormatted[symbol]
      )}`
    )
  })
  const total = Object.values(values).reduce((total, value) => total + value, 0)
  console.log(
    chalk.blue(
      new Intl.NumberFormat('es-AR', {
        currency: 'USD',
        style: 'currency'
      }).format(total)
    )
  )
}

run()
