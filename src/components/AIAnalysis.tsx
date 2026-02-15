import { useState } from 'react'
import { useOpenInterest, getOIHistory, getOITrend } from '../hooks/useOpenInterest'

interface AnalysisResult {
  analysis: string
  timestamp: number
  model: string
}

export default function AIAnalysis() {
  const { data: latestOI } = useOpenInterest(5000)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAnalyze = async () => {
    if (!latestOI) {
      setError('시장 데이터를 먼저 로드해주세요')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const history = getOIHistory()

      // 최근 10분 데이터 (5초 간격 = 120개)
      const last10Min = history.slice(-120)

      // 1분 간격으로 샘플링 (12개 포인트)
      const sampled: Array<{time: string, oi: number, price: number, funding: number}> = []
      for (let i = 0; i < last10Min.length; i += 10) {
        const point = last10Min[i]
        sampled.push({
          time: new Date(point.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          oi: Math.round(point.openInterest),
          price: point.price,
          funding: point.binanceFundingRate
        })
      }
      // 마지막 포인트 항상 포함
      if (last10Min.length > 0) {
        const lastPoint = last10Min[last10Min.length - 1]
        const lastSampled = sampled[sampled.length - 1]
        if (!lastSampled || lastSampled.time !== new Date(lastPoint.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })) {
          sampled.push({
            time: new Date(lastPoint.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
            oi: Math.round(lastPoint.openInterest),
            price: lastPoint.price,
            funding: lastPoint.binanceFundingRate
          })
        }
      }

      // Calculate price and OI change (10분 전 대비)
      let priceChange = 0
      let oiChange = 0
      if (last10Min.length > 1) {
        priceChange = (last10Min[last10Min.length - 1].price - last10Min[0].price) / last10Min[0].price
        oiChange = (last10Min[last10Min.length - 1].openInterest - last10Min[0].openInterest) / last10Min[0].openInterest
      }

      const marketData = {
        price: latestOI.price,
        oi: latestOI.openInterest,
        fundingRate: latestOI.binanceFundingRate,
        oiChange,
        priceChange,
        oiTrend: getOITrend(history),
        history: sampled // 10분 히스토리 (1분 간격)
      }

      const response = await fetch('/.netlify/functions/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketData })
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || 'API 요청 실패')
      }

      const data = await response.json()
      setAnalysis(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '분석 중 오류 발생')
    } finally {
      setIsLoading(false)
    }
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <div className="ai-analysis">
      <div className="ai-analysis-header">
        <div className="ai-analysis-title">
          <span className="ai-icon">🤖</span>
          AI 시장 분석
          <span className="ai-model">GPT-4o</span>
        </div>
        <button
          className="btn btn-ai"
          onClick={handleAnalyze}
          disabled={isLoading || !latestOI}
        >
          {isLoading ? '분석 중...' : '분석하기'}
        </button>
      </div>

      {error && (
        <div className="ai-analysis-error">
          {error}
        </div>
      )}

      {analysis && !error && (
        <div className="ai-analysis-result">
          <div className="ai-analysis-content">
            {analysis.analysis}
          </div>
          <div className="ai-analysis-meta">
            {formatTime(analysis.timestamp)} 분석
          </div>
        </div>
      )}

      {!analysis && !error && !isLoading && (
        <div className="ai-analysis-placeholder">
          버튼을 눌러 현재 시장 상황을 AI로 분석하세요
        </div>
      )}
    </div>
  )
}
