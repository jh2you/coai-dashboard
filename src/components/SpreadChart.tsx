import { useEffect, useRef, useCallback } from 'react'
import { usePrices, calculateSpread } from '../hooks/usePrices'
import type { SpreadPoint } from '../types'

// Format number
function fmt(n: number | null, decimals = 8): string {
  if (n == null || isNaN(n)) return '-'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: decimals }).format(n)
}

// Store for spread history (persists across re-renders)
const spreadHistory: SpreadPoint[] = []
const MAX_HISTORY = 480

export default function SpreadChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { data: prices } = usePrices(5000)

  // Calculate current spread (Bitget - Gate.io)
  const spread = prices ? calculateSpread(prices, 'bitget', 'gate') : null

  // Update history and draw chart
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx || spreadHistory.length < 2) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth || 600
    const h = canvas.clientHeight || 160

    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)

    // Grid background
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= 4; i++) {
      if (i === 2) continue // Center line drawn separately
      const yPos = (i / 4) * h
      ctx.beginPath()
      ctx.moveTo(0, yPos)
      ctx.lineTo(w, yPos)
      ctx.stroke()
    }

    const vals = spreadHistory.map((p) => p.raw)
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const pad = Math.max(1e-10, (max - min) * 0.15)
    const ymin = Math.min(min - pad, 0)
    const ymax = Math.max(max + pad, 0)
    const x = (i: number) => (i / (spreadHistory.length - 1)) * w
    const y = (v: number) => h - ((v - ymin) / (ymax - ymin)) * h

    // Center baseline (0)
    const zy = y(0)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)'
    ctx.lineWidth = 1
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(0, zy)
    ctx.lineTo(w, zy)
    ctx.stroke()
    ctx.setLineDash([])

    // Data line
    let prev = spreadHistory[0]
    for (let i = 1; i < spreadHistory.length; i++) {
      const cur = spreadHistory[i]
      const col = cur.raw >= 0 ? '#6366f1' : '#ef4444'

      // Main line
      ctx.strokeStyle = col
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x(i - 1), y(prev.raw))
      ctx.lineTo(x(i), y(cur.raw))
      ctx.stroke()

      // Data point
      ctx.fillStyle = col
      ctx.beginPath()
      ctx.arc(x(i), y(cur.raw), 2.5, 0, Math.PI * 2)
      ctx.fill()

      prev = cur
    }
  }, [])

  // Update spread history when spread changes
  useEffect(() => {
    if (spread != null) {
      spreadHistory.push({ t: Date.now(), raw: spread })
      if (spreadHistory.length > MAX_HISTORY) {
        spreadHistory.shift()
      }
      draw()
    }
  }, [spread, draw])

  // Redraw on resize
  useEffect(() => {
    const handleResize = () => draw()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [draw])

  // Export CSV
  const handleExportCsv = () => {
    if (!spreadHistory.length) {
      alert('데이터 없음')
      return
    }
    const header = ['timestamp_ms', 'local_time', 'spread_raw']
    const rows = spreadHistory.map((p) => [
      p.t,
      `"${new Date(p.t).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}"`,
      p.raw,
    ])
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'spread_bitget_gate_coai.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="card card-spacing">
      <div className="row row-between">
        <div>
          <div className="muted">Bitget-Gate 스프레드</div>
          <div className="price k price-sm">{fmt(spread)}</div>
        </div>
        <div className="legend">
          <span className="dot" style={{ background: 'var(--accent)' }} /> 양수
          <span className="dot" style={{ background: 'var(--error)' }} /> 음수
          <button className="btn" onClick={handleExportCsv}>
            CSV 저장
          </button>
        </div>
      </div>
      <div style={{ marginTop: '16px' }}>
        <canvas ref={canvasRef} height={160} />
      </div>
    </div>
  )
}
