# Portfolio tracker 📈 &middot; [![Project Status: Active – The project has reached a stable, usable state and is being actively developed.](https://www.repostatus.org/badges/latest/active.svg)](https://www.repostatus.org/#active) ![GitHub package.json version](https://img.shields.io/github/package-json/v/lropero/portfolio-tracker)

Crypto portfolio tracker.

<img src="tracker.png?raw=true" width="380">

### Requires

- Node v14.15.4

### Installation

```sh
$ npm ci
```

### Configuration

- Create API key at [CoinMarketCap](https://coinmarketcap.com/api/) (_required for price retrieval_)
- Edit `.env` file with your key and time delay between polls (_in minutes_):

```sh
APIKEY=<YOUR_API_KEY>
DELAY=5
```

- Edit `portfolio.json` file with your holdings:

```sh
{
  "BTC": 0.1234,
  "ETH": 1.2
}
```

### Usage

```sh
$ npm run start
```
