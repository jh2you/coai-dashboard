import { useEffect, useRef, useState } from 'react'
import { usePrices, useOrderBooks } from '../hooks/usePrices'
import { SkeletonCard, SkeletonTable, SkeletonGauge } from './Skeleton'

// Format number with specified decimals
function fmt(n: number | null | undefined, decimals = 6): string {
  if (n == null || isNaN(n)) return '-'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: decimals }).format(n)
}

// Format deviation percentage
function fmtDeviation(deviation: number | null): { text: string; className: string; highlight: boolean } {
  if (deviation == null) return { text: '-', className: 'deviation-neutral', highlight: false }
  const sign = deviation >= 0 ? '+' : ''
  const text = `${sign}${deviation.toFixed(3)}%`
  const highlight = Math.abs(deviation) >= 0.5
  const className = deviation > 0
    ? (highlight ? 'deviation-highlight-positive' : 'deviation-positive')
    : deviation < 0
    ? (highlight ? 'deviation-highlight-negative' : 'deviation-negative')
    : 'deviation-neutral'
  return { text, className, highlight }
}

// Format volume for display
function fmtVolume(vol: number): string {
  if (vol >= 1000000) return (vol / 1000000).toFixed(1) + 'M'
  if (vol >= 1000) return (vol / 1000).toFixed(1) + 'K'
  return vol.toFixed(0)
}

// Hook to track price changes for animation
function usePriceFlash(price: number | null | undefined, key: string) {
  const prevPrice = useRef<number | null>(null)
  const [flashClass, setFlashClass] = useState('')

  useEffect(() => {
    if (price != null && prevPrice.current != null) {
      if (price > prevPrice.current) {
        setFlashClass('price-flash-up')
      } else if (price < prevPrice.current) {
        setFlashClass('price-flash-down')
      }
      const timer = setTimeout(() => setFlashClass(''), 500)
      return () => clearTimeout(timer)
    }
    prevPrice.current = price ?? null
  }, [price, key])

  return flashClass
}

// Order book gauge bar component
function OrderBookGauge({ bidRatio, askRatio, bidVolume, askVolume }: {
  bidRatio: number
  askRatio: number
  bidVolume: number
  askVolume: number
}) {
  return (
    <div className="gauge-container">
      <span className="gauge-label" style={{ color: 'var(--success)' }}>
        {fmtVolume(bidVolume)}
      </span>
      <div className="gauge-bar">
        <div className="gauge-bid" style={{ width: `${bidRatio}%` }}>
          {bidRatio >= 15 && `${bidRatio.toFixed(0)}%`}
        </div>
        <div className="gauge-ask" style={{ width: `${askRatio}%` }}>
          {askRatio >= 15 && `${askRatio.toFixed(0)}%`}
        </div>
      </div>
      <span className="gauge-label" style={{ color: 'var(--error)' }}>
        {fmtVolume(askVolume)}
      </span>
    </div>
  )
}

// Price cell with flash animation
function PriceCell({ price, exchangeKey }: { price: number | null | undefined; exchangeKey: string }) {
  const flashClass = usePriceFlash(price, exchangeKey)
  return (
    <td className={`k ${flashClass}`}>
      {fmt(price)}
    </td>
  )
}

export default function PriceTable() {
  const { data: prices, isLoading: pricesLoading, dataUpdatedAt } = usePrices(5000)
  const { data: orderBooks, isLoading: orderBooksLoading } = useOrderBooks(5000)

  // Find min and max prices (excluding Binance futures)
  const spotPrices = prices?.filter(p => p.key !== 'binance' && p.price != null) || []
  const minPrice = spotPrices.length ? spotPrices.reduce((min, p) => (p.price! < min.price! ? p : min)) : null
  const maxPrice = spotPrices.length ? spotPrices.reduce((max, p) => (p.price! > max.price! ? p : max)) : null

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' })
    : '-'

  // Show skeleton while loading
  if (pricesLoading && !prices) {
    return (
      <>
        <div className="cards">
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="card card-spacing">
          <SkeletonTable rows={4} cols={6} />
        </div>
      </>
    )
  }

  return (
    <>
      {/* Min/Max Price Cards */}
      <div className="cards">
        <div className="card">
          <div className="muted">최저가</div>
          <div className="price k">{minPrice ? fmt(minPrice.price) : '-'}</div>
          <div className="muted">{minPrice?.label || '-'}</div>
        </div>
        <div className="card">
          <div className="muted">최고가</div>
          <div className="price k">{maxPrice ? fmt(maxPrice.price) : '-'}</div>
          <div className="muted">{maxPrice?.label || '-'}</div>
        </div>
      </div>

      {/* Price Table */}
      <div className="card card-spacing">
        <div className="toolbar" style={{ marginBottom: '16px' }}>
          <div className="muted">
            🔄 <span className="k">5초</span> 자동 갱신
          </div>
          <div className="muted">
            업데이트: <span className="k">{lastUpdated}</span>
          </div>
          <div className="spacer" />
          {(pricesLoading || orderBooksLoading) && <span className="spinner" />}
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>거래소</th>
                <th>가격</th>
                <th>괴리율</th>
                <th className="hide-mobile">호가 비율</th>
                <th className="hide-mobile">상태</th>
                <th>링크</th>
              </tr>
            </thead>
            <tbody>
              {prices?.map((ex) => {
                const deviation = fmtDeviation(ex.deviation)
                const orderBook = orderBooks?.find(ob => ob.exchange === ex.label)

                return (
                  <tr key={ex.key}>
                    <td>{ex.label}</td>
                    <PriceCell price={ex.price} exchangeKey={ex.key} />
                    <td>
                      {ex.key === 'bitget' ? (
                        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>기준</span>
                      ) : (
                        <span className={deviation.className}>{deviation.text}</span>
                      )}
                    </td>
                    <td className="hide-mobile">
                      {orderBook ? (
                        <OrderBookGauge
                          bidRatio={orderBook.bidRatio}
                          askRatio={orderBook.askRatio}
                          bidVolume={orderBook.bidVolume}
                          askVolume={orderBook.askVolume}
                        />
                      ) : (
                        <SkeletonGauge />
                      )}
                    </td>
                    <td className="hide-mobile">
                      {ex.unavailable ? (
                        <span className="status err">미상장</span>
                      ) : ex.price != null ? (
                        <span className="status ok">정상</span>
                      ) : (
                        <span className="status err">에러</span>
                      )}
                    </td>
                    <td>
                      <a className="link" href={ex.link} target="_blank" rel="noopener noreferrer">
                        거래 ↗
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
