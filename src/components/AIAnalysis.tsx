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
      const recent = history.slice(-5)

      // Calculate price and OI change
      let priceChange = 0
      let oiChange = 0
      if (recent.length > 1) {
        priceChange = (recent[recent.length - 1].price - recent[0].price) / recent[0].price
        oiChange = (recent[recent.length - 1].openInterest - recent[0].openInterest) / recent[0].openInterest
      }

      const marketData = {
        price: latestOI.price,
        oi: latestOI.openInterest,
        fundingRate: latestOI.binanceFundingRate,
        oiChange,
        priceChange,
        oiTrend: getOITrend(history)
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
