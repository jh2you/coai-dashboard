// Exchange price data
export interface ExchangePrice {
  key: string
  label: string
  price: number | null
  link: string
  unavailable?: boolean
}

// Order book data for bid/ask ratio
export interface OrderBookData {
  exchange: string
  bidVolume: number  // Total bid volume
  askVolume: number  // Total ask volume
  bidRatio: number   // Bid percentage (0-100)
  askRatio: number   // Ask percentage (0-100)
}

// Price with deviation from reference (Bitget)
export interface PriceWithDeviation extends ExchangePrice {
  deviation: number | null  // % deviation from Bitget
}

// Spread data point for chart
export interface SpreadPoint {
  t: number  // timestamp
  raw: number  // spread value
}

// On-chain transaction
export interface TokenTransaction {
  hash: string
  timeStamp: string
  from: string
  to: string
  value: string
  tokenDecimal: string
  tokenSymbol: string
}

// CEX wallet balance
export interface WalletBalance {
  exchange: string
  wallet: string
  symbol: string
  decimals: number
  balance: number
  totalIn: number
  totalOut: number
  netFlow: number
}

// API response for wallet balances
export interface WalletBalanceResponse {
  contract: string
  hours: number
  updatedAt: number
  results: WalletBalance[]
}
