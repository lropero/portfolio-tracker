# Portfolio tracker

Crypto portfolio tracker.

<img src="tracker.png?raw=true" width="380">

### Requires

- Node v14.15.4

### Installation

```sh
$ npm ci
```

### Configuration

- Create API key at [CoinMarketCap](https://coinmarketcap.com/api/)
- Edit `.env` file with your key, time delay between polls (in minutes) and your holdings:

```sh
APIKEY=<YOUR_API_KEY>
DELAY=5
PORTFOLIO={"BTC":0.1234,"ETH":1.2}
```

### Usage

```sh
$ npm run start
```
