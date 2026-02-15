import { useQuery } from '@tanstack/react-query'

const PROXY = '/.netlify/functions/proxy?url='

// OI data point
export interface OIDataPoint {
  timestamp: number
  openInterest: number
  price: number
  fundingRate: number
  binanceFundingRate: number // Binance specific funding rate
  oiWeightedFunding: number  // OI * Funding Rate
  oiChange: number           // % change from previous
  isSpike: boolean           // Sudden change indicator
}

// Store historical data (in-memory only)
let oiHistory: OIDataPoint[] = []
const MAX_HISTORY = 120 // 10 minutes of 5s intervals

// Detect OI spike (>5% change)
const SPIKE_THRESHOLD = 0.05

async function fetchWithTimeout(url: string, timeout = 5000): Promise<any> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

// Fetch Binance Futures OI
async function fetchBinanceOI(): Promise<{ oi: number; price: number; fundingRate: number } | null> {
  try {
    // Fetch OI and premium index (contains current funding rate) in parallel
    const [oiRes, premiumRes] = await Promise.all([
      fetchWithTimeout('https://fapi.binance.com/fapi/v1/openInterest?symbol=COAIUSDT'),
      fetchWithTimeout('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=COAIUSDT'),
    ])

    const oi = parseFloat(oiRes.openInterest) || 0
    const price = parseFloat(premiumRes.markPrice) || 0
    const fundingRate = parseFloat(premiumRes.lastFundingRate) || 0

    return { oi, price, fundingRate }
  } catch (e) {
    console.error('Binance OI fetch error:', e)
    return null
  }
}

// Fetch Bitget OI
async function fetchBitgetOI(): Promise<{ oi: number; fundingRate: number } | null> {
  try {
    const oiUrl = PROXY + encodeURIComponent('https://api.bitget.com/api/v2/mix/market/open-interest?symbol=COAIUSDT&productType=USDT-FUTURES')
    const fundingUrl = PROXY + encodeURIComponent('https://api.bitget.com/api/v2/mix/market/current-fund-rate?symbol=COAIUSDT&productType=USDT-FUTURES')

    const [oiRes, fundingRes] = await Promise.all([
      fetchWithTimeout(oiUrl),
      fetchWithTimeout(fundingUrl),
    ])

    const oi = oiRes?.data?.openInterestList?.[0]?.size
      ? parseFloat(oiRes.data.openInterestList[0].size)
      : 0
    const fundingRate = fundingRes?.data?.fundingRate
      ? parseFloat(fundingRes.data.fundingRate)
      : 0

    return { oi, fundingRate }
  } catch (e) {
    console.error('Bitget OI fetch error:', e)
    return null
  }
}

// Aggregate OI data from multiple exchanges
async function fetchAggregatedOI(): Promise<OIDataPoint> {
  const timestamp = Date.now()

  // Fetch from exchanges in parallel
  const [binance, bitget] = await Promise.all([
    fetchBinanceOI(),
    fetchBitgetOI(),
  ])

  // Use Binance as primary source (most reliable for futures data)
  let totalOI = binance?.oi || 0
  let price = binance?.price || 0
  const binanceFundingRate = binance?.fundingRate || 0
  let avgFundingRate = binanceFundingRate

  // Add Bitget OI if available
  if (bitget?.oi) {
    totalOI += bitget.oi
    // Average funding rates
    if (bitget.fundingRate && avgFundingRate) {
      avgFundingRate = (avgFundingRate + bitget.fundingRate) / 2
    } else if (bitget.fundingRate) {
      avgFundingRate = bitget.fundingRate
    }
  }

  // Calculate OI weighted funding (funding rate impact)
  const oiWeightedFunding = totalOI * avgFundingRate

  // Calculate change from previous
  const prevOI = oiHistory.length > 0 ? oiHistory[oiHistory.length - 1].openInterest : totalOI
  const oiChange = prevOI > 0 ? ((totalOI - prevOI) / prevOI) : 0

  // Detect spike
  const isSpike = Math.abs(oiChange) > SPIKE_THRESHOLD

  const dataPoint: OIDataPoint = {
    timestamp,
    openInterest: totalOI,
    price,
    fundingRate: avgFundingRate,
    binanceFundingRate,
    oiWeightedFunding,
    oiChange,
    isSpike,
  }

  // Add to history
  oiHistory.push(dataPoint)
  if (oiHistory.length > MAX_HISTORY) {
    oiHistory.shift()
  }

  return dataPoint
}

// Get OI history for charting
export function getOIHistory(): OIDataPoint[] {
  return [...oiHistory]
}

// Clear history (for testing)
export function clearOIHistory(): void {
  oiHistory = []
}

// Hook for real-time OI data
export function useOpenInterest(refetchInterval = 5000) {
  return useQuery({
    queryKey: ['openInterest'],
    queryFn: fetchAggregatedOI,
    refetchInterval,
    staleTime: 3000,
  })
}

// Format OI for display
export function formatOI(oi: number): string {
  if (oi >= 1000000) return (oi / 1000000).toFixed(2) + 'M'
  if (oi >= 1000) return (oi / 1000).toFixed(1) + 'K'
  return oi.toFixed(0)
}

// Format funding rate
export function formatFundingRate(rate: number): string {
  return (rate * 100).toFixed(4) + '%'
}

// Get OI trend (comparing to average)
export function getOITrend(history: OIDataPoint[]): 'rising' | 'falling' | 'stable' {
  if (history.length < 5) return 'stable'

  const recent = history.slice(-5)
  const avgRecent = recent.reduce((sum, p) => sum + p.openInterest, 0) / recent.length
  const older = history.slice(-10, -5)

  if (older.length === 0) return 'stable'

  const avgOlder = older.reduce((sum, p) => sum + p.openInterest, 0) / older.length
  const change = (avgRecent - avgOlder) / avgOlder

  if (change > 0.02) return 'rising'
  if (change < -0.02) return 'falling'
  return 'stable'
}
