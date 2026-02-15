import { useEffect, useState } from 'react'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts'
import {
  useOpenInterest,
  getOIHistory,
  formatOI,
  formatFundingRate,
  getOITrend,
  type OIDataPoint,
} from '../hooks/useOpenInterest'

// Custom tooltip
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null

  const data = payload[0].payload as OIDataPoint
  const time = new Date(data.timestamp).toLocaleTimeString('ko-KR')

  return (
    <div className="oi-tooltip">
      <div className="oi-tooltip-time">{time}</div>
      <div className="oi-tooltip-row">
        <span>OI</span>
        <span className="oi-tooltip-value">{formatOI(data.openInterest)}</span>
      </div>
      <div className="oi-tooltip-row">
        <span>가격</span>
        <span className="oi-tooltip-value">${data.price.toFixed(4)}</span>
      </div>
      <div className="oi-tooltip-row">
        <span>펀딩비</span>
        <span className={`oi-tooltip-value ${data.binanceFundingRate >= 0 ? 'positive' : 'negative'}`}>
          {formatFundingRate(data.binanceFundingRate)}
        </span>
      </div>
      <div className="oi-tooltip-row">
        <span>OI 변화</span>
        <span className={`oi-tooltip-value ${data.oiChange >= 0 ? 'positive' : 'negative'}`}>
          {(data.oiChange * 100).toFixed(2)}%
        </span>
      </div>
      {data.isSpike && (
        <div className="oi-tooltip-spike">⚠️ OI 급변 감지!</div>
      )}
    </div>
  )
}

// Trend indicator
function TrendIndicator({ trend }: { trend: 'rising' | 'falling' | 'stable' }) {
  const config = {
    rising: { icon: '↑', color: 'var(--success)', text: '상승세' },
    falling: { icon: '↓', color: 'var(--error)', text: '하락세' },
    stable: { icon: '→', color: 'var(--muted)', text: '보합' },
  }
  const { icon, color, text } = config[trend]

  return (
    <span className="oi-trend" style={{ color }}>
      {icon} {text}
    </span>
  )
}

// Enhanced Signal indicator (price vs OI relationship with trend analysis)
function SignalIndicator({ history }: { history: OIDataPoint[] }) {
  if (history.length < 3) return null

  const recent = history.slice(-5)
  const priceChange = recent.length > 1
    ? (recent[recent.length - 1].price - recent[0].price) / recent[0].price
    : 0
  const oiChange = recent.length > 1
    ? (recent[recent.length - 1].openInterest - recent[0].openInterest) / recent[0].openInterest
    : 0

  // Thresholds
  const priceThreshold = 0.003 // 0.3%
  const oiThreshold = 0.005 // 0.5%

  let signal = { text: '', subText: '', color: 'var(--muted)', icon: '' }

  // 추세 강화: 가격과 OI가 같은 방향
  if (priceChange > priceThreshold && oiChange > oiThreshold) {
    signal = {
      text: '상승 추세 강화',
      subText: '롱 진입 증가',
      color: 'var(--success)',
      icon: '📈',
    }
  } else if (priceChange < -priceThreshold && oiChange > oiThreshold) {
    signal = {
      text: '하락 추세 강화',
      subText: '숏 진입 증가',
      color: 'var(--error)',
      icon: '📉',
    }
  }
  // 추세 반전: 가격과 OI가 반대 방향
  else if (priceChange > priceThreshold && oiChange < -oiThreshold) {
    signal = {
      text: '하락 반전 가능',
      subText: '숏 청산 중 (약한 상승)',
      color: 'var(--warning)',
      icon: '⚠️',
    }
  } else if (priceChange < -priceThreshold && oiChange < -oiThreshold) {
    signal = {
      text: '상승 반전 가능',
      subText: '롱 청산 중 (투매)',
      color: 'var(--warning)',
      icon: '🔄',
    }
  }

  if (!signal.text) return null

  return (
    <div className="oi-signal-box" style={{ borderColor: signal.color }}>
      <div className="oi-signal-main" style={{ color: signal.color }}>
        {signal.icon} {signal.text}
      </div>
      {signal.subText && (
        <div className="oi-signal-sub">{signal.subText}</div>
      )}
    </div>
  )
}

export default function OpenInterestChart() {
  const { data: latestOI, isLoading } = useOpenInterest(5000)
  const [history, setHistory] = useState<OIDataPoint[]>([])

  // Update history when new data arrives
  useEffect(() => {
    if (latestOI) {
      setHistory(getOIHistory())
    }
  }, [latestOI])

  const trend = getOITrend(history)
  const avgOI = history.length > 0
    ? history.reduce((sum, p) => sum + p.openInterest, 0) / history.length
    : 0

  // Format X axis
  const formatXAxis = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Get bar color based on OI change and spike
  const getBarColor = (entry: OIDataPoint) => {
    if (entry.isSpike) return '#fbbf24' // Warning yellow for spikes
    if (entry.oiChange > 0) return 'rgba(52, 211, 153, 0.8)' // Green
    return 'rgba(248, 113, 113, 0.8)' // Red
  }

  return (
    <div>
      <div className="row row-between" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span className="price k" style={{ fontSize: '24px' }}>
            {latestOI ? formatOI(latestOI.openInterest) : '-'}
          </span>
          <TrendIndicator trend={trend} />
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="muted" style={{ marginBottom: '4px' }}>바이낸스 선물 펀딩비</div>
          <div className="k" style={{
            fontSize: '18px',
            fontWeight: 600,
            color: latestOI && latestOI.binanceFundingRate >= 0 ? 'var(--success)' : 'var(--error)'
          }}>
            {latestOI ? formatFundingRate(latestOI.binanceFundingRate) : '-'}
          </div>
          <SignalIndicator history={history} />
        </div>
      </div>

      {isLoading && history.length === 0 ? (
        <div className="oi-chart-skeleton">
          <div className="skeleton" style={{ height: '200px', borderRadius: '8px' }} />
        </div>
      ) : (
        <div style={{ width: '100%', height: 200 }}>
          <ResponsiveContainer>
            <ComposedChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="oiGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.2} />
                </linearGradient>
              </defs>

              <XAxis
                dataKey="timestamp"
                tickFormatter={formatXAxis}
                stroke="var(--muted)"
                tick={{ fill: 'var(--muted)', fontSize: 10 }}
                axisLine={{ stroke: 'var(--border)' }}
                tickLine={false}
                interval="preserveStartEnd"
              />

              <YAxis
                yAxisId="oi"
                orientation="right"
                tickFormatter={formatOI}
                stroke="var(--muted)"
                tick={{ fill: 'var(--muted)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                domain={['auto', 'auto']}
              />

              <YAxis
                yAxisId="price"
                orientation="left"
                tickFormatter={(v) => v.toFixed(4)}
                stroke="var(--muted)"
                tick={{ fill: 'var(--muted)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                domain={['auto', 'auto']}
                hide
              />

              <YAxis
                yAxisId="funding"
                orientation="left"
                tickFormatter={(v) => (v * 100).toFixed(2) + '%'}
                stroke="var(--muted)"
                tick={{ fill: 'var(--muted)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                domain={['auto', 'auto']}
                hide
              />

              <Tooltip content={<CustomTooltip />} />

              {/* Average OI reference line */}
              {avgOI > 0 && (
                <ReferenceLine
                  yAxisId="oi"
                  y={avgOI}
                  stroke="var(--accent)"
                  strokeDasharray="5 5"
                  strokeOpacity={0.5}
                />
              )}

              {/* OI Bars */}
              <Bar
                yAxisId="oi"
                dataKey="openInterest"
                radius={[4, 4, 0, 0]}
                maxBarSize={20}
              >
                {history.map((entry, index) => (
                  <Cell key={index} fill={getBarColor(entry)} />
                ))}
              </Bar>

              {/* Price Line */}
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="price"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: 'var(--accent)' }}
              />

              {/* Funding Rate Line */}
              <Line
                yAxisId="funding"
                type="monotone"
                dataKey="binanceFundingRate"
                stroke="#f59e0b"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                dot={false}
                activeDot={{ r: 3, fill: '#f59e0b' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="legend" style={{ marginTop: '12px', justifyContent: 'center' }}>
        <span className="dot" style={{ background: 'rgba(52, 211, 153, 0.8)' }} /> OI 증가
        <span className="dot" style={{ background: 'rgba(248, 113, 113, 0.8)' }} /> OI 감소
        <span className="dot" style={{ background: '#fbbf24' }} /> 급변
        <span style={{ color: 'var(--accent)' }}>—</span> 가격
        <span style={{ color: '#f59e0b' }}>┄</span> 펀딩비
      </div>
    </div>
  )
}
