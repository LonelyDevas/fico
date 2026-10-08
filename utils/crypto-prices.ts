// Live crypto prices from CoinGecko's public API. One request covers every coin you hold, and the
// answer is kept for a minute, so opening screens repeatedly does not use up the free allowance.
// An optional free "demo" key (NEXT_PUBLIC_COINGECKO_KEY) raises the limit.

export type Coin = { id: string; symbol: string; name: string }

/** Popular coins, by their CoinGecko id. Anything else can be added by typing its id. */
export const COINS: Coin[] = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB' },
  { id: 'tether', symbol: 'USDT', name: 'Tether' },
  { id: 'usd-coin', symbol: 'USDC', name: 'USD Coin' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano' },
  { id: 'tron', symbol: 'TRX', name: 'TRON' },
  { id: 'the-open-network', symbol: 'TON', name: 'Toncoin' },
  { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche' },
  { id: 'shiba-inu', symbol: 'SHIB', name: 'Shiba Inu' },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot' },
  { id: 'chainlink', symbol: 'LINK', name: 'Chainlink' },
  { id: 'polygon-ecosystem-token', symbol: 'POL', name: 'Polygon' },
  { id: 'litecoin', symbol: 'LTC', name: 'Litecoin' },
  { id: 'bitcoin-cash', symbol: 'BCH', name: 'Bitcoin Cash' },
  { id: 'uniswap', symbol: 'UNI', name: 'Uniswap' },
  { id: 'stellar', symbol: 'XLM', name: 'Stellar' },
  { id: 'near', symbol: 'NEAR', name: 'NEAR Protocol' },
  { id: 'layerzero', symbol: 'ZRO', name: 'LayerZero' },
  { id: 'pancakeswap-token', symbol: 'CAKE', name: 'PancakeSwap' },
  { id: 'dai', symbol: 'DAI', name: 'Dai' },
  { id: 'aptos', symbol: 'APT', name: 'Aptos' },
  { id: 'arbitrum', symbol: 'ARB', name: 'Arbitrum' },
  { id: 'optimism', symbol: 'OP', name: 'Optimism' },
  { id: 'sui', symbol: 'SUI', name: 'Sui' },
  { id: 'pepe', symbol: 'PEPE', name: 'Pepe' },
  { id: 'internet-computer', symbol: 'ICP', name: 'Internet Computer' },
  { id: 'cosmos', symbol: 'ATOM', name: 'Cosmos' },
  { id: 'monero', symbol: 'XMR', name: 'Monero' },
  { id: 'filecoin', symbol: 'FIL', name: 'Filecoin' },
  { id: 'hedera-hashgraph', symbol: 'HBAR', name: 'Hedera' },
  { id: 'aave', symbol: 'AAVE', name: 'Aave' },
  { id: 'maker', symbol: 'MKR', name: 'Maker' },
  { id: 'ethereum-classic', symbol: 'ETC', name: 'Ethereum Classic' },
  { id: 'algorand', symbol: 'ALGO', name: 'Algorand' },
  { id: 'vechain', symbol: 'VET', name: 'VeChain' },
  { id: 'injective-protocol', symbol: 'INJ', name: 'Injective' },
]

export type CoinPrice = { price: number; change24h: number | null }
export type CoinPrices = { prices: Record<string, CoinPrice>; fetchedAt: number; stale: boolean }

const CACHE_KEY = 'fico:coin-prices'
const FRESH_MS = 60_000

type Cached = { key: string; at: number; prices: Record<string, CoinPrice> }

const readCache = (): Cached | null => {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Cached) : null
  } catch {
    return null
  }
}

const writeCache = (value: Cached) => {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(value))
  } catch {
    // Storage can be blocked; prices just won't be remembered.
  }
}

export const coinLabel = (id?: string | null, symbol?: string | null) =>
  symbol || COINS.find((c) => c.id === id)?.symbol || (id ?? '').toUpperCase()

/** Prices for the given CoinGecko ids in one currency. Falls back to the last known prices if the request fails. */
export async function fetchCoinPrices(ids: string[], currency: string): Promise<CoinPrices> {
  const vs = currency.toLowerCase()
  const unique = [...new Set(ids)].sort()
  const key = `${vs}:${unique.join(',')}`
  const cached = readCache()

  if (cached && cached.key === key && Date.now() - cached.at < FRESH_MS) {
    return { prices: cached.prices, fetchedAt: cached.at, stale: false }
  }

  try {
    const params = new URLSearchParams({ ids: unique.join(','), vs_currencies: vs, include_24hr_change: 'true' })
    const apiKey = process.env.NEXT_PUBLIC_COINGECKO_KEY
    if (apiKey) params.set('x_cg_demo_api_key', apiKey)

    const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?${params.toString()}`)
    if (!response.ok) throw new Error(`CoinGecko ${response.status}`)
    const json = (await response.json()) as Record<string, Record<string, number>>

    const prices: Record<string, CoinPrice> = {}
    for (const id of unique) {
      const row = json[id]
      if (row && typeof row[vs] === 'number') {
        const change = row[`${vs}_24h_change`]
        prices[id] = { price: row[vs], change24h: typeof change === 'number' ? change : null }
      }
    }
    const at = Date.now()
    writeCache({ key, at, prices })
    return { prices, fetchedAt: at, stale: false }
  } catch (error) {
    if (cached && cached.key === key) return { prices: cached.prices, fetchedAt: cached.at, stale: true }
    throw error
  }
}
