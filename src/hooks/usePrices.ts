import { useQuery } from '@tanstack/react-query'
import type { ExchangePrice, PriceWithDeviation, OrderBookData } from '../types'

const PROXY = '/.netlify/functions/proxy?url='

// Exchange configurations for COAI
const EXCHANGES = [
  {
    key: 'mexc',
    label: 'MEXC',
    priceUrl: 'https://api.mexc.com/api/v3/ticker/24hr?symbol=COAIUSDT',
    orderBookUrl: 'https://api.mexc.com/api/v3/depth?symbol=COAIUSDT&limit=20',
    parsePrice: (j: any) => ({ price: j?.lastPrice ? Number(j.lastPrice) : null }),
    parseOrderBook: (j: any) => {
      if (!j?.bids || !j?.asks) return null
      const bidVol = j.bids.reduce((sum: number, [, qty]: [string, string]) => sum + Number(qty), 0)
      const askVol = j.asks.reduce((sum: number, [, qty]: [string, string]) => sum + Number(qty), 0)
      return { bidVolume: bidVol, askVolume: askVol }
    },
    link: 'https://www.mexc.com/exchange/COAI_USDT',
    needsProxy: true,
  },
  {
    key: 'gate',
    label: 'Gate.io',
    priceUrl: 'https://api.gateio.ws/api/v4/spot/tickers?currency_pair=COAI_USDT',
    orderBookUrl: 'https://api.gateio.ws/api/v4/spot/order_book?currency_pair=COAI_USDT&limit=20',
    parsePrice: (j: any) => {
      const it = Array.isArray(j) ? j[0] : null
      return { price: it?.last ? Number(it.last) : null }
    },
    parseOrderBook: (j: any) => {
      if (!j?.bids || !j?.asks) return null
      const bidVol = j.bids.reduce((sum: number, [, qty]: [string, string]) => sum + Number(qty), 0)
      const askVol = j.asks.reduce((sum: number, [, qty]: [string, string]) => sum + Number(qty), 0)
      return { bidVolume: bidVol, askVolume: askVol }
    },
    link: 'https://www.gate.io/trade/COAI_USDT',
    needsProxy: true,
  },
  {
    key: 'bitget',
    label: 'Bitget',
    priceUrl: 'https://api.bitget.com/api/v2/spot/market/tickers?symbol=COAIUSDT',
    orderBookUrl: 'https://api.bitget.com/api/v2/spot/market/orderbook?symbol=COAIUSDT&limit=20',
    parsePrice: (j: any) => {
      if (!j || j.code !== '00000' || !Array.isArray(j.data) || !j.data.length) {
        return { price: null, unavailable: true }
      }
      const d = j.data[0]
      return { price: d?.lastPr || d?.last ? Number(d.lastPr || d.last) : null }
    },
    parseOrderBook: (j: any) => {
      if (!j || j.code !== '00000' || !j.data) return null
      const { bids, asks } = j.data
      if (!bids || !asks) return null
      const bidVol = bids.reduce((sum: number, [, qty]: [string, string]) => sum + Number(qty), 0)
      const askVol = asks.reduce((sum: number, [, qty]: [string, string]) => sum + Number(qty), 0)
      return { bidVolume: bidVol, askVolume: askVol }
    },
    link: 'https://www.bitget.com/spot/COAIUSDT',
    needsProxy: true,
  },
  {
    key: 'binance',
    label: 'Binance (선물)',
    priceUrl: 'https://fapi.binance.com/fapi/v1/ticker/price?symbol=COAIUSDT',
    orderBookUrl: 'https://fapi.binance.com/fapi/v1/depth?symbol=COAIUSDT&limit=20',
    parsePrice: (j: any) => ({ price: j?.price || j?.lastPrice ? Number(j.price || j.lastPrice) : null }),
    parseOrderBook: (j: any) => {
      if (!j?.bids || !j?.asks) return null
      const bidVol = j.bids.reduce((sum: number, [, qty]: [string, string]) => sum + Number(qty), 0)
      const askVol = j.asks.reduce((sum: number, [, qty]: [string, string]) => sum + Number(qty), 0)
      return { bidVolume: bidVol, askVolume: askVol }
    },
    link: 'https://www.binance.com/en/futures/COAIUSDT',
    needsProxy: false, // Binance has CORS enabled
  },
]

async function fetchWithTimeout(url: string, timeout = 5000): Promise<any> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return response.json()
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

// Fetch all exchange prices
async function fetchPrices(): Promise<ExchangePrice[]> {
  const results = await Promise.allSettled(
    EXCHANGES.map(async (ex) => {
      const url = ex.needsProxy ? PROXY + encodeURIComponent(ex.priceUrl) : ex.priceUrl
      try {
        const data = await fetchWithTimeout(url)
        const parsed = ex.parsePrice(data) as { price: number | null; unavailable?: boolean }
        return {
          key: ex.key,
          label: ex.label,
          price: parsed.price,
          link: ex.link,
          unavailable: parsed.unavailable,
        }
      } catch {
        return {
          key: ex.key,
          label: ex.label,
          price: null,
          link: ex.link,
        }
      }
    })
  )

  return results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { key: EXCHANGES[i].key, label: EXCHANGES[i].label, price: null, link: EXCHANGES[i].link }
  )
}

// Fetch order book data for all exchanges
async function fetchOrderBooks(): Promise<OrderBookData[]> {
  const results = await Promise.allSettled(
    EXCHANGES.map(async (ex) => {
      const url = ex.needsProxy ? PROXY + encodeURIComponent(ex.orderBookUrl) : ex.orderBookUrl
      try {
        const data = await fetchWithTimeout(url)
        const parsed = ex.parseOrderBook(data)
        if (!parsed) {
          return { exchange: ex.label, bidVolume: 0, askVolume: 0, bidRatio: 50, askRatio: 50 }
        }
        const total = parsed.bidVolume + parsed.askVolume
        const bidRatio = total > 0 ? (parsed.bidVolume / total) * 100 : 50
        const askRatio = total > 0 ? (parsed.askVolume / total) * 100 : 50
        return {
          exchange: ex.label,
          bidVolume: parsed.bidVolume,
          askVolume: parsed.askVolume,
          bidRatio,
          askRatio,
        }
      } catch {
        return { exchange: ex.label, bidVolume: 0, askVolume: 0, bidRatio: 50, askRatio: 50 }
      }
    })
  )

  return results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { exchange: EXCHANGES[i].label, bidVolume: 0, askVolume: 0, bidRatio: 50, askRatio: 50 }
  )
}

// Calculate deviation from Bitget
function calculateDeviations(prices: ExchangePrice[]): PriceWithDeviation[] {
  const bitgetPrice = prices.find((p) => p.key === 'bitget')?.price

  return prices.map((p) => {
    let deviation: number | null = null
    if (bitgetPrice && p.price && p.key !== 'bitget') {
      deviation = ((p.price - bitgetPrice) / bitgetPrice) * 100
    }
    return { ...p, deviation }
  })
}

// Hook for prices with auto-refresh
export function usePrices(refetchInterval = 5000) {
  return useQuery({
    queryKey: ['prices'],
    queryFn: fetchPrices,
    refetchInterval,
    staleTime: 3000,
    select: calculateDeviations,
  })
}

// Hook for order books with auto-refresh
export function useOrderBooks(refetchInterval = 5000) {
  return useQuery({
    queryKey: ['orderBooks'],
    queryFn: fetchOrderBooks,
    refetchInterval,
    staleTime: 3000,
  })
}

// Calculate spread between two exchanges
export function calculateSpread(
  prices: ExchangePrice[],
  exchange1: string,
  exchange2: string
): number | null {
  const price1 = prices.find((p) => p.key === exchange1)?.price
  const price2 = prices.find((p) => p.key === exchange2)?.price
  if (price1 == null || price2 == null) return null
  return price1 - price2
}

export { EXCHANGES }
